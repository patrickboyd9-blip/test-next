/* Modern Mail postcard setup for Figma. Guides are locked and hidden during export. */

const POINTS = 72

function size(id, label, pageW, pageH, trimW, trimH, panelW, panelH, barW, barH) {
  const bleed = 0.25 * POINTS
  const trimRight = bleed + trimW * POINTS
  const trimBottom = bleed + trimH * POINTS
  const safe = 0.25 * POINTS
  return {
    id,
    label,
    page: { width: pageW * POINTS, height: pageH * POINTS },
    trim: { x: bleed, y: bleed, width: trimW * POINTS, height: trimH * POINTS },
    safe: { x: bleed + safe, y: bleed + safe, width: trimW * POINTS - safe * 2, height: trimH * POINTS - safe * 2 },
    address: { x: trimRight - panelW, y: trimBottom - panelH, width: panelW, height: panelH },
    barcode: { x: trimRight - barW, y: trimBottom - barH, width: barW, height: barH },
  }
}

const SIZES = {
  "5x8": size("5x8", "5 × 8 postcard", 8.5, 5.5, 8, 5, 265.5, 208, 433, 46),
  "6x9": size("6x9", "6 × 9 postcard", 9.5, 6.5, 9, 6, 263, 213, 432, 47),
}

const GUIDE = "Modern Mail guides"

figma.showUI(__html__, { width: 360, height: 560 })

figma.ui.onmessage = async (message) => {
  if (message.type === "create") {
    const spec = SIZES[message.size] || SIZES["5x8"]
    const created = []
    for (const face of ["front", "back"]) {
      const frame = figma.createFrame()
      frame.name = face === "front" ? "Postcard front" : "Postcard back"
      frame.resize(spec.page.width, spec.page.height)
      frame.x = created.length * (spec.page.width + 40)
      frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]
      await addGuides(frame, spec, face)
      created.push(frame)
    }
    figma.currentPage.selection = created
    figma.viewport.scrollAndZoomIntoView(created)
    figma.ui.postMessage({ type: "created", count: created.length })
    return
  }
  if (message.type === "check") {
    const warnings = []
    for (const node of figma.currentPage.selection) {
      if (node.type !== "FRAME") continue
      const spec = specFor(node.width, node.height)
      if (!spec) {
        warnings.push(`${node.name} is not a 5×8 or 6×9 postcard page.`)
        continue
      }
      warnings.push(...(await checkFrame(node, spec)))
    }
    if (figma.currentPage.selection.length === 0) warnings.push("Select the front or the back first.")
    figma.ui.postMessage({ type: "warnings", warnings })
    return
  }
  if (message.type === "export") {
    const files = []
    for (const node of figma.currentPage.selection) {
      if (node.type !== "FRAME") continue
      const guides = node.findOne((child) => child.name === GUIDE)
      if (guides) guides.visible = false
      const bytes = await node.exportAsync({ format: "PDF" })
      if (guides) guides.visible = true
      const face = /back/i.test(node.name) ? "back" : "front"
      files.push({ face, fileName: `${face}.pdf`, base64: figma.base64Encode(bytes) })
    }
    figma.ui.postMessage({ type: "files", files })
  }
}

function specFor(width, height) {
  return Object.values(SIZES).find((item) => Math.abs(item.page.width - width) < 1.5 && Math.abs(item.page.height - height) < 1.5)
}

async function addGuides(frame, spec, face) {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" })
  const layer = figma.createFrame()
  layer.name = GUIDE
  layer.locked = true
  layer.resize(spec.page.width, spec.page.height)
  layer.fills = []
  outline(layer, spec.trim, "Trim")
  outline(layer, spec.safe, "Safe area")
  if (face === "back") {
    block(layer, spec.address, "Address area")
    block(layer, spec.barcode, "Barcode area")
  }
  frame.appendChild(layer)
}

function outline(parent, rect, label) {
  const box = figma.createRectangle()
  box.name = label
  box.x = rect.x
  box.y = rect.y
  box.resize(rect.width, rect.height)
  box.fills = []
  box.strokes = [{ type: "SOLID", color: { r: 0.2, g: 0.55, b: 0.75 } }]
  box.strokeWeight = 1
  box.locked = true
  parent.appendChild(box)
}

function block(parent, rect, label) {
  const box = figma.createRectangle()
  box.name = label
  box.x = rect.x
  box.y = rect.y
  box.resize(rect.width, rect.height)
  box.fills = [{ type: "SOLID", color: { r: 0.93, g: 0.96, b: 0.98 }, opacity: 0.85 }]
  box.strokes = [{ type: "SOLID", color: { r: 0.1, g: 0.35, b: 0.5 } }]
  box.strokeWeight = 1
  box.locked = true
  const text = figma.createText()
  text.name = `${label} label`
  text.characters = label
  text.fontSize = 11
  text.x = rect.x + 6
  text.y = rect.y + 6
  text.locked = true
  parent.appendChild(box)
  parent.appendChild(text)
}

async function checkFrame(frame, spec) {
  const warnings = []
  const back = /back/i.test(frame.name)
  for (const child of frame.children) {
    if (child.name === GUIDE) continue
    if (child.type === "RECTANGLE" && child.fills && child.fills.some((fill) => fill.type === "IMAGE")) {
      const fill = child.fills.find((item) => item.type === "IMAGE")
      if (fill && fill.imageHash) {
        const image = figma.getImageByHash(fill.imageHash)
        if (image) {
          const pixels = await image.getSizeAsync()
          const inches = child.width / POINTS
          if (inches > 0 && pixels.width / inches < 300) warnings.push(`${frame.name} has a picture under 300 pixels per inch.`)
        }
      }
    }
    if (back && hitsReserved(child, spec)) warnings.push(`${frame.name} has artwork in the address or barcode area.`)
  }
  return warnings
}

function hitsReserved(node, spec) {
  const box = { x: node.x, y: node.y, width: node.width, height: node.height }
  return overlap(box, spec.address) || overlap(box, spec.barcode)
}

function overlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}
