import assert from "node:assert/strict"
import { inflateSync } from "node:zlib"
import { test } from "node:test"

import { POSTCARD_5X8_V1 } from "../mail-catalog/pieces/postcard-5x8"
import {
  PRINT_SPEC_NON_GOALS,
  buildPostcard5x8PrintSpec,
} from "./postcard-5x8-print-spec"
import { renderPostcard5x8PrintSpecPdf } from "./render-print-spec-pdf"
import {
  renderPostcard5x8GuideRgb,
  renderPostcard5x8PrintSpecPng,
} from "./render-print-spec-png"

test("5x8 print spec copies catalog geometry at 300 DPI in RGB", () => {
  const spec = buildPostcard5x8PrintSpec()
  const physical = POSTCARD_5X8_V1.physical

  assert.equal(spec.catalogId, "postcard_5x8")
  assert.equal(spec.catalogVersion, 1)
  assert.equal(spec.dpi, 300)
  assert.equal(spec.colorSpace, "rgb")
  assert.equal(spec.artworkCanvasInches.widthInches, physical.artworkCanvasInches.widthInches)
  assert.equal(spec.artworkCanvasInches.heightInches, physical.artworkCanvasInches.heightInches)
  assert.equal(spec.finishedTrimInches.widthInches, 8)
  assert.equal(spec.finishedTrimInches.heightInches, 5)
  assert.equal(spec.bleedInchesPerSide, 0.25)
  assert.equal(spec.pixelSize.widthPx, 2550)
  assert.equal(spec.pixelSize.heightPx, 1650)
  assert.deepEqual(spec.mediaBox, [0, 0, 612, 396])
  assert.deepEqual(spec.bleedBox, [0, 0, 612, 396])
  assert.deepEqual(spec.trimBox, [18, 18, 594, 378])
  assert.match(spec.colorPolicy, /RGB/)
  assert.match(spec.colorPolicy, /No CMYK|no CMYK|CMYK conversion/)
  assert.match(spec.colorPolicy, /8\.5/)
  for (const goal of [
    "Click2Mail account login or API credentials",
    "Click2Mail job create, proof, or submit",
    "Payment",
    "Data Axle or any audience purchase",
  ]) {
    assert.equal(PRINT_SPEC_NON_GOALS.includes(goal as never), true, goal)
  }
})

test("address-face keep-outs move from trim top-left onto the canvas", () => {
  const spec = buildPostcard5x8PrintSpec()
  const panel = spec.keepOuts.find((rect) => rect.id === "mailing_panel")
  const barcode = spec.keepOuts.find((rect) => rect.id === "barcode_strip")
  assert.ok(panel)
  assert.ok(barcode)

  assert.equal(panel.trim.xInches, 4.3125)
  assert.equal(panel.trim.yInches, 2.125)
  assert.equal(panel.canvas.xInches, 4.5625)
  assert.equal(panel.canvas.yInches, 2.375)
  assert.equal(panel.pdf.xPoints, 4.5625 * 72)
  assert.equal(panel.pdf.yPoints, 18)

  assert.equal(barcode.trim.xInches, 2)
  assert.equal(barcode.trim.yInches, 4.375)
  assert.equal(barcode.canvas.xInches, 2.25)
  assert.equal(barcode.canvas.yInches, 4.625)
  assert.equal(barcode.pdf.widthPoints, 6 * 72)
  assert.equal(barcode.pdf.heightPoints, 0.625 * 72)
})

test("PDF page boxes match the 8.5 by 5.5 inch canvas and name the RGB limit", () => {
  const pdf = renderPostcard5x8PrintSpecPdf().toString("latin1")
  assert.match(pdf, /^%PDF-1\.4/)
  assert.equal(pdf.includes("%%EOF"), true)
  assert.equal((pdf.match(/\/Type \/Page /g) ?? []).length, 2)
  assert.equal((pdf.match(/\/MediaBox \[0 0 612 396\]/g) ?? []).length, 2)
  assert.equal((pdf.match(/\/TrimBox \[18 18 594 378\]/g) ?? []).length, 2)
  assert.equal((pdf.match(/\/BleedBox \[0 0 612 396\]/g) ?? []).length, 2)
  assert.match(pdf, /No CMYK/)
  assert.match(pdf, /2550 x 1650/)
  assert.match(pdf, /not a mail job/)
  assert.match(pdf, /BaseFont \/Helvetica-Bold/)
  assert.match(pdf, /BaseFont \/Helvetica >>/)
  assert.doesNotMatch(pdf, /Authorization/i)
  assert.doesNotMatch(pdf, /documentClass/)
})

test("PNG raster is 2550 by 1650 RGB at 300 DPI and keeps the address panel off the front", () => {
  const back = renderPostcard5x8GuideRgb("back")
  const front = renderPostcard5x8GuideRgb("front")
  assert.equal(back.widthPx, 2550)
  assert.equal(back.heightPx, 1650)

  const panel = pixel(back.rgb, back.widthPx, 1922, 1144)
  assert.deepEqual(panel, [244, 214, 214])
  const frontPanel = pixel(front.rgb, front.widthPx, 1922, 1144)
  assert.deepEqual(frontPanel, [255, 255, 255])

  const trim = pixel(back.rgb, back.widthPx, 75, 825)
  assert.deepEqual(trim, [28, 28, 28])

  const png = renderPostcard5x8PrintSpecPng("back")
  assert.equal(png[0], 137)
  assert.equal(png.toString("ascii", 1, 4), "PNG")
  assert.equal(png.readUInt32BE(16), 2550)
  assert.equal(png.readUInt32BE(20), 1650)
  assert.equal(png.toString("ascii", 37, 41), "pHYs")
  const pixelsPerMeter = png.readUInt32BE(41)
  assert.equal(pixelsPerMeter, Math.round(300 / 0.0254))

  const idat = png.indexOf(Buffer.from("IDAT"))
  assert.equal(idat > 0, true)
  const compressedLength = png.readUInt32BE(idat - 4)
  const inflated = inflateSync(png.subarray(idat + 4, idat + 4 + compressedLength))
  assert.equal(inflated.length, (1 + 2550 * 3) * 1650)
})

function pixel(
  rgb: Uint8Array,
  widthPx: number,
  x: number,
  y: number
): [number, number, number] {
  const index = (y * widthPx + x) * 3
  return [rgb[index], rgb[index + 1], rgb[index + 2]]
}
