/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * One Modern Mail plugin for Photoshop and InDesign.
 * Guide layers are locked. They are hidden, and in InDesign they are not printable,
 * so they stay out of the PDF.
 */
const GUIDE = "Modern Mail guides"

function guideRects(spec, back) {
  const rects = [
    { ...spec.trim, label: "Trim" },
    { ...spec.safe, label: "Safe area" },
  ]
  if (back) {
    rects.push({ ...spec.address, label: "Address area" })
    rects.push({ ...spec.barcode, label: "Barcode area" })
  }
  return rects
}

function createHost(hosts, sizes) {
  return {
    async create(sizeId) {
      const spec = sizes[sizeId] || sizes["5x8"]
      if (hosts.photoshop) return createPhotoshop(hosts.photoshop, spec)
      if (hosts.indesign) return createInDesign(hosts.indesign, spec)
      return { host: "preview", width: spec.page.width, height: spec.page.height }
    },
    warnings(sizeId, page, marks) {
      const spec = sizes[sizeId]
      const notes = []
      if (!spec || Math.abs(page.width - spec.page.width) > 2 || Math.abs(page.height - spec.page.height) > 2) {
        notes.push("This page is not a 5×8 or 6×9 postcard.")
        return notes
      }
      if (page.resolution && page.resolution < 300) notes.push("This page is under 300 pixels per inch.")
      for (const mark of marks || []) {
        if (mark.guide) continue
        const inches = mark.width / (page.resolution || 300)
        if (mark.pixels && inches > 0 && mark.pixels / inches < 300) notes.push("A picture is under 300 pixels per inch.")
        if (page.back && (overlaps(mark, spec.address) || overlaps(mark, spec.barcode))) {
          notes.push("Artwork covers the address or barcode area.")
        }
      }
      return notes
    },
  }
}

async function createPhotoshop(photoshop, spec) {
  const docs = []
  await photoshop.core.executeAsModal(async () => {
    for (const face of ["front", "back"]) {
      const doc = await photoshop.app.createDocument({
        width: spec.page.width,
        height: spec.page.height,
        resolution: 300,
        mode: "RGBColorMode",
        fill: "white",
        name: face === "front" ? "Postcard front" : "Postcard back",
      })
      doc.layers = doc.layers || []
      for (const rect of guideRects(spec, face === "back")) {
        await photoshop.action.batchPlay(
          [
            {
              _obj: "make",
              _target: [{ _ref: "contentLayer" }],
              using: {
                _obj: "contentLayer",
                name: GUIDE,
                type: {
                  _obj: "solidColorLayer",
                  color: { _obj: "RGBColor", red: 232, grain: 244, blue: 248 },
                },
              },
            },
          ],
          {},
        )
        doc.layers.push({ name: GUIDE, visible: true, locked: true, rect })
      }
      docs.push(doc)
    }
  }, { commandName: "Modern Mail" })
  return docs
}

async function exportPhotoshopPdf(doc, file) {
  const hidden = hideGuideLayers(doc.layers || [])
  await doc.saveAs.pdf(file, { crop: false }, true)
  for (const layer of hidden) layer.visible = true
}

function hideGuideLayers(layers) {
  const hidden = []
  for (const layer of layers) {
    if (layer.name === GUIDE && layer.visible !== false) {
      layer.visible = false
      hidden.push(layer)
    }
  }
  return hidden
}

function createInDesign(indesign, spec) {
  const doc = indesign.app.documents.add()
  doc.documentPreferences.facingPages = false
  doc.documentPreferences.pageWidth = `${spec.inches.pageWidth} in`
  doc.documentPreferences.pageHeight = `${spec.inches.pageHeight} in`
  const layer = doc.layers.add({ name: GUIDE })
  layer.printable = false
  layer.locked = false
  drawInDesignPage(doc.pages[0], layer, spec, false)
  const back = doc.pages.add()
  drawInDesignPage(back, layer, spec, true)
  layer.locked = true
  return doc
}

function drawInDesignPage(page, layer, spec, back) {
  const scale = 72 / 300
  for (const rect of guideRects(spec, back)) {
    const frame = page.rectangles.add({ itemLayer: layer, name: GUIDE })
    frame.geometricBounds = [
      rect.y * scale,
      rect.x * scale,
      (rect.y + rect.height) * scale,
      (rect.x + rect.width) * scale,
    ]
    frame.locked = true
    frame.name = GUIDE
  }
}

function exportInDesignPdf(doc, file) {
  const layer = findGuideLayer(doc)
  const wasVisible = layer ? layer.visible : true
  if (layer) layer.visible = false
  doc.exportFile("pdf", file)
  if (layer) layer.visible = wasVisible
}

function findGuideLayer(doc) {
  const layers = doc.layers.items || doc.layers
  for (const layer of layers) {
    if (layer.name === GUIDE) return layer
  }
  return null
}

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function installPanel() {
  if (typeof document === "undefined" || typeof require !== "function") return
  let photoshop = null
  let indesign = null
  try {
    photoshop = require("photoshop")
  } catch {
    photoshop = null
  }
  try {
    indesign = require("indesign")
  } catch {
    indesign = null
  }
  if (!photoshop && !indesign) return
  const { POSTCARD_SIZES } = require("./spec.js")
  const api = createHost({ photoshop, indesign }, POSTCARD_SIZES)
  const create = document.getElementById("create")
  const send = document.getElementById("send")
  const status = document.getElementById("status")
  if (create) {
    create.addEventListener("click", () => {
      const size = document.getElementById("size").value
      void api.create(size).catch(() => {
        if (status) status.textContent = "The pages could not be created."
      })
    })
  }
  if (send) {
    send.addEventListener("click", async () => {
      const size = document.getElementById("size").value
      const spec = POSTCARD_SIZES[size]
      try {
        if (photoshop && photoshop.app.activeDocument) {
          const doc = photoshop.app.activeDocument
          const notes = api.warnings(size, {
            width: doc.width,
            height: doc.height,
            resolution: doc.resolution,
            back: /back/i.test(doc.name || ""),
          }, [])
          if (notes.length) {
            if (status) status.textContent = notes.join(" ")
            return
          }
          const folder = await require("uxp").storage.localFileSystem.getTemporaryFolder()
          const file = await folder.createFile(`${doc.name || "postcard"}.pdf`, { overwrite: true })
          await exportPhotoshopPdf(doc, file)
        }
        if (indesign && indesign.app.activeDocument) {
          const doc = indesign.app.activeDocument
          if (doc.documentPreferences.pageWidth !== `${spec.inches.pageWidth} in`) {
            if (status) status.textContent = "This page is not the postcard size."
            return
          }
          const folder = await require("uxp").storage.localFileSystem.getTemporaryFolder()
          const file = await folder.createFile("postcard.pdf", { overwrite: true })
          exportInDesignPdf(doc, file)
        }
      } catch {
        if (status) status.textContent = "The print file could not be saved."
      }
    })
  }
}

installPanel()

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    GUIDE,
    createHost,
    createPhotoshop,
    exportPhotoshopPdf,
    hideGuideLayers,
    createInDesign,
    exportInDesignPdf,
  }
}
