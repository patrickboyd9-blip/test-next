/**
 * Postcard pages for Photoshop pixels and InDesign points.
 * 300 pixels per inch. The page already includes 0.25 in of bleed.
 * 5×8 is 8.5×5.5 in. 6×9 is 9.5×6.5 in.
 */
const POINTS = 72
const PIXELS_PER_INCH = 300

function size(id, label, pageW, pageH, trimW, trimH, panelW, panelH, barW, barH) {
  const scale = PIXELS_PER_INCH / POINTS
  const bleed = 0.25 * POINTS
  const trimRight = bleed + trimW * POINTS
  const trimBottom = bleed + trimH * POINTS
  const safe = 0.25 * POINTS
  const box = (x, y, width, height) => ({
    x: x * scale,
    y: y * scale,
    width: width * scale,
    height: height * scale,
  })
  return {
    id,
    label,
    page: { width: pageW * PIXELS_PER_INCH, height: pageH * PIXELS_PER_INCH },
    inches: { pageWidth: pageW, pageHeight: pageH, trimWidth: trimW, trimHeight: trimH, bleed: 0.25 },
    points: { width: pageW * POINTS, height: pageH * POINTS },
    trim: box(bleed, bleed, trimW * POINTS, trimH * POINTS),
    safe: box(bleed + safe, bleed + safe, trimW * POINTS - safe * 2, trimH * POINTS - safe * 2),
    address: box(trimRight - panelW, trimBottom - panelH, panelW, panelH),
    barcode: box(trimRight - barW, trimBottom - barH, barW, barH),
    minPixelsPerInch: 300,
  }
}

const POSTCARD_SIZES = {
  "5x8": size("5x8", "5 × 8 postcard", 8.5, 5.5, 8, 5, 265.5, 208, 433, 46),
  "6x9": size("6x9", "6 × 9 postcard", 9.5, 6.5, 9, 6, 263, 213, 432, 47),
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

const api = { POINTS, PIXELS_PER_INCH, POSTCARD_SIZES, overlaps, reservedHits }
if (typeof module !== "undefined" && module.exports) module.exports = api
