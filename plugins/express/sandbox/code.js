/**
 * Document sandbox for the Modern Mail add-on.
 * The host injects `editor` from express-document-sdk.
 * Guide marks are locked. They are removed from the page before the PDF and put back after.
 */
const GUIDE = "Modern Mail guide"
const guides = []

function createSandbox(editor, sizes) {
  return {
    create(sizeId) {
      const spec = sizes[sizeId] || sizes["5x8"]
      const front = editor.documentRoot.pages.addPage({ width: spec.page.width, height: spec.page.height })
      draw(editor, front.artboards.first, spec, false)
      const back = editor.documentRoot.pages.addPage({ width: spec.page.width, height: spec.page.height })
      draw(editor, back.artboards.first, spec, true)
      return { width: spec.page.width, height: spec.page.height }
    },
    hideGuides() {
      for (const guide of guides) {
        if (guide.node.removeFromParent) guide.node.removeFromParent()
        else guide.node.opacity = 0
      }
    },
    showGuides() {
      for (const guide of guides) {
        if (guide.parent && guide.parent.children) guide.parent.children.append(guide.node)
        else guide.node.opacity = 1
      }
    },
    warnings(sizeId, page, marks) {
      const spec = sizes[sizeId]
      const notes = []
      if (!spec || !pageMatches(spec, page)) {
        notes.push("This page is not a 5×8 or 6×9 postcard.")
        return notes
      }
      for (const mark of marks || []) {
        if (mark.guide) continue
        const inches = mark.width / (page.pixelsPerInch || 300)
        if (inches > 0 && mark.pixels / inches < 300) notes.push("A picture is under 300 pixels per inch.")
        if (page.back && (overlaps(mark, spec.address) || overlaps(mark, spec.barcode))) {
          notes.push("Artwork covers the address or barcode area.")
        }
      }
      return notes
    },
  }
}

function draw(editor, artboard, spec, back) {
  place(editor, artboard, spec.trim, "Trim", false)
  place(editor, artboard, spec.safe, "Safe area", false)
  if (back) {
    place(editor, artboard, spec.address, "Address area", true)
    place(editor, artboard, spec.barcode, "Barcode area", true)
  }
}

function place(editor, parent, rect, label, filled) {
  const shape = editor.createRectangle()
  shape.width = rect.width
  shape.height = rect.height
  shape.translation = { x: rect.x, y: rect.y }
  shape.locked = true
  if (filled && editor.makeColorFill) {
    shape.fill = editor.makeColorFill({ red: 0.91, green: 0.96, blue: 0.97, alpha: 0.85 })
  }
  parent.children.append(shape)
  guides.push({ node: shape, parent })
  if (editor.createText) {
    const text = editor.createText(`${GUIDE}: ${label}`)
    text.translation = { x: rect.x + 8, y: rect.y + 8 }
    text.locked = true
    parent.children.append(text)
    guides.push({ node: text, parent })
  }
}

function pageMatches(spec, page) {
  return Math.abs(page.width - spec.page.width) < 2 && Math.abs(page.height - spec.page.height) < 2
}

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

if (typeof module !== "undefined" && module.exports) module.exports = { createSandbox, GUIDE }

void (async () => {
  try {
    const sdk = await import("add-on-sdk-document-sandbox")
    const { editor } = await import("express-document-sdk")
    const spec = await import("../spec.js")
    const sizes = spec.POSTCARD_SIZES || spec.default.POSTCARD_SIZES
    sdk.default.instance.runtime.exposeApi(createSandbox(editor, sizes))
  } catch {
    /* Opened outside the add-on, including the unit test. */
  }
})()
