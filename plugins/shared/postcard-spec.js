/**
 * Postcard page sizes for design tools.
 * Units are points (72 per inch), which match a Figma frame and a PDF page.
 * Guides are not printed.
 */
const POINTS = 72

function size(id, label, pageW, pageH, trimW, trimH, panelW, panelH, barW, barH) {
  const bleed = 0.25 * POINTS
  const trimX = bleed
  const trimY = bleed
  const trimRight = trimX + trimW * POINTS
  const trimBottom = trimY + trimH * POINTS
  const safe = 0.25 * POINTS
  return {
    id,
    label,
    page: { width: pageW * POINTS, height: pageH * POINTS },
    inches: { pageWidth: pageW, pageHeight: pageH, trimWidth: trimW, trimHeight: trimH, bleed: 0.25 },
    trim: { x: trimX, y: trimY, width: trimW * POINTS, height: trimH * POINTS },
    safe: {
      x: trimX + safe,
      y: trimY + safe,
      width: trimW * POINTS - safe * 2,
      height: trimH * POINTS - safe * 2,
    },
    address: {
      x: trimRight - panelW,
      y: trimBottom - panelH,
      width: panelW,
      height: panelH,
    },
    barcode: {
      x: trimRight - barW,
      y: trimBottom - barH,
      width: barW,
      height: barH,
    },
    minPixelsPerInch: 300,
  }
}

const POSTCARD_SIZES = {
  "5x8": size("5x8", "5 × 8 postcard", 8.5, 5.5, 8, 5, 265.5, 208, 433, 46),
  "6x9": size("6x9", "6 × 9 postcard", 9.5, 6.5, 9, 6, 263, 213, 432, 47),
}

function nearly(a, b, tolerance) {
  return Math.abs(a - b) <= tolerance
}

function pageMatches(sizeId, width, height) {
  const spec = POSTCARD_SIZES[sizeId]
  if (!spec) return false
  return nearly(width, spec.page.width, 1.5) && nearly(height, spec.page.height, 1.5)
}

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function reservedHits(sizeId, boxes) {
  const spec = POSTCARD_SIZES[sizeId]
  if (!spec) return []
  const hits = []
  for (const box of boxes) {
    if (box.guide) continue
    if (overlaps(box, spec.address)) hits.push("The address area on the back must stay empty.")
    if (overlaps(box, spec.barcode)) hits.push("The barcode area on the back must stay empty.")
  }
  return [...new Set(hits)]
}

const api = { POINTS, POSTCARD_SIZES, pageMatches, reservedHits, overlaps }

if (typeof module !== "undefined" && module.exports) module.exports = api
