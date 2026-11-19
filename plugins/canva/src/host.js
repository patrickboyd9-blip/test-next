/**
 * Modern Mail page setup for the Canva Apps SDK.
 * The starter passes `@canva/design` in as `design`.
 * Guide marks are deleted before the print file is made, then put back.
 */
const GUIDE = "Modern Mail guide"

function createHost(design, sizes) {
  return {
    async create(sizeId) {
      const spec = sizes[sizeId] || sizes["5x8"]
      await design.addPage({
        title: "Postcard front",
        dimensions: { width: spec.page.width, height: spec.page.height },
      })
      await draw(design, spec, false)
      await design.addPage({
        title: "Postcard back",
        dimensions: { width: spec.page.width, height: spec.page.height },
      })
      await draw(design, spec, true)
    },

    async warnings(sizeId, page, images) {
      const spec = sizes[sizeId]
      const notes = []
      if (!spec || Math.abs(page.width - spec.page.width) > 2 || Math.abs(page.height - spec.page.height) > 2) {
        notes.push("This page is not a 5×8 or 6×9 postcard.")
        return notes
      }
      for (const image of images || []) {
        if (image.guide) continue
        const inches = image.width / 300
        if (inches > 0 && image.pixels / inches < 300) notes.push("A picture is under 300 pixels per inch.")
        if (page.back && (overlaps(image, spec.address) || overlaps(image, spec.barcode))) {
          notes.push("Artwork covers the address or barcode area.")
        }
      }
      return notes
    },

    async exportPdf() {
      await design.openDesign({ type: "all_pages" }, async (session) => {
        for (const pageRef of session.pageRefs.toArray()) {
          if (pageRef.type !== "absolute" || pageRef.locked) continue
          await session.helpers.openPage(pageRef, async (pageResult) => {
            const spec = specForPage(sizes, pageResult.page.dimensions)
            const back = pageLooksLikeBack(pageResult)
            pageResult.page.elements.forEach((element) => {
              if (isGuide(element, spec, back)) pageResult.page.elements.delete(element)
            })
          })
        }
        await session.sync()
      })
      const result = await design.requestExport({ acceptedFileTypes: ["pdf_standard"] })
      await design.openDesign({ type: "all_pages" }, async (session) => {
        for (const pageRef of session.pageRefs.toArray()) {
          if (pageRef.type !== "absolute" || pageRef.locked) continue
          await session.helpers.openPage(pageRef, async (pageResult) => {
            const back = /back/i.test(pageRef.title || "")
            const spec = specForPage(sizes, pageResult.page.dimensions)
            if (spec) insertGuides(session, pageResult, spec, back)
          })
        }
        await session.sync()
      })
      return result
    },
  }
}

async function draw(design, spec, back) {
  await design.openDesign({ type: "current_page" }, async (session) => {
    if (session.page.type !== "absolute" || session.page.locked) return
    insertGuides(session, session, spec, back)
    await session.sync()
  })
}

function insertGuides(session, pageSession, spec, back) {
  outline(session, pageSession, spec.trim, "Trim")
  outline(session, pageSession, spec.safe, "Safe area")
  if (back) {
    block(session, pageSession, spec.address, "Address area")
    block(session, pageSession, spec.barcode, "Barcode area")
  }
}

function outline(session, pageSession, rect, label) {
  const shape = session.helpers.elementStateBuilder.createShapeElement({
    top: rect.y,
    left: rect.x,
    width: rect.width,
    height: rect.height,
    viewBox: { top: 0, left: 0, width: rect.width, height: rect.height },
    paths: [
      {
        d: `M 0 0 H ${rect.width} V ${rect.height} H 0 Z`,
        fill: { colorContainer: { type: "solid", color: "#000000", opacity: 0 } },
        stroke: { weight: 1, color: "#1d6f8a", align: "inset" },
      },
    ],
  })
  pageSession.page.elements.insertAfter(undefined, shape)
  labelOf(session, pageSession, rect, label)
}

function block(session, pageSession, rect, label) {
  const shape = session.helpers.elementStateBuilder.createShapeElement({
    top: rect.y,
    left: rect.x,
    width: rect.width,
    height: rect.height,
    viewBox: { top: 0, left: 0, width: rect.width, height: rect.height },
    paths: [
      {
        d: `M 0 0 H ${rect.width} V ${rect.height} H 0 Z`,
        fill: { colorContainer: { type: "solid", color: "#e8f4f8" } },
        stroke: { weight: 1, color: "#1d6f8a", align: "inset" },
      },
    ],
  })
  pageSession.page.elements.insertAfter(undefined, shape)
  labelOf(session, pageSession, rect, label)
}

function labelOf(session, pageSession, rect, label) {
  const text = session.helpers.elementStateBuilder.createTextElement({
    top: rect.y + 8,
    left: rect.x + 8,
    width: Math.max(80, rect.width - 16),
    rotation: 0,
    transparency: 0,
    text: { regions: [{ text: `${GUIDE}: ${label}`, formatting: { fontSize: 14, color: "#1d6f8a" } }] },
  })
  pageSession.page.elements.insertAfter(undefined, text)
}

function isGuide(element, spec, back) {
  if (element.type === "text" && element.text && String(element.text.readPlaintext()).includes(GUIDE)) return true
  if (!spec || element.top == null) return false
  const rects = [spec.trim, spec.safe]
  if (back) rects.push(spec.address, spec.barcode)
  return rects.some(
    (rect) =>
      Math.abs(element.top - rect.y) < 2 &&
      Math.abs(element.left - rect.x) < 2 &&
      Math.abs(element.width - rect.width) < 2 &&
      Math.abs(element.height - rect.height) < 2,
  )
}

function pageLooksLikeBack(pageResult) {
  let back = false
  pageResult.page.elements.forEach((element) => {
    if (element.type === "text" && element.text && String(element.text.readPlaintext()).includes("Address area")) back = true
  })
  return back
}

function specForPage(sizes, dimensions) {
  if (!dimensions) return null
  return Object.values(sizes).find((item) => Math.abs(item.page.width - dimensions.width) < 2 && Math.abs(item.page.height - dimensions.height) < 2)
}

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

if (typeof module !== "undefined" && module.exports) module.exports = { createHost, GUIDE }
