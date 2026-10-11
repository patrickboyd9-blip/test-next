import assert from "node:assert/strict"
import { test } from "node:test"

import { decodeRaster } from "../bring-your-own-design/decode-raster"
import { designTemplate } from "./design-templates"
import { buildPostcard5x8PrintSpec } from "./postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "./postcard-6x9-print-spec"
import { renderDesignTemplatePdf } from "./render-design-template-pdf"
import { renderDesignOverlayPng } from "./render-design-template-png"

test("6x9 template geometry is the full bleed page and the measured keep-out", () => {
  const spec = buildPostcard6x9PrintSpec()
  assert.equal(spec.artworkCanvasInches.widthInches, 9.5)
  assert.equal(spec.artworkCanvasInches.heightInches, 6.5)
  assert.equal(spec.finishedTrimInches.widthInches, 9)
  assert.equal(spec.finishedTrimInches.heightInches, 6)
  assert.equal(spec.bleedInchesPerSide, 0.25)
  assert.equal(spec.recommendedSafeTextInsetInches, 0.25)
  assert.deepEqual(spec.mediaBox, [0, 0, 684, 468])
  assert.deepEqual(spec.bleedBox, [0, 0, 684, 468])
  assert.deepEqual(spec.trimBox, [18, 18, 666, 450])

  const panel = spec.keepOuts.find((item) => item.id === "mailing_panel")
  const strip = spec.keepOuts.find((item) => item.id === "barcode_strip")
  assert.ok(panel)
  assert.ok(strip)
  assert.equal(panel.trim.widthInches, 3.656)
  assert.equal(panel.trim.heightInches, 2.948)
  assert.ok(Math.abs(panel.trim.xInches - (9 - 3.656)) < 1e-9)
  assert.ok(Math.abs(panel.trim.yInches - (6 - 2.948)) < 1e-9)
  assert.equal(strip.trim.widthInches, 6)
  assert.equal(strip.trim.heightInches, 0.625)
  assert.equal(panel.canvas.xInches, panel.trim.xInches + 0.25)
  assert.equal(spec.pixelSize.widthPx, 2850)
  assert.equal(spec.pixelSize.heightPx, 1950)
})

test("5x8 designer template PDF uses the catalog page size", () => {
  const spec = buildPostcard5x8PrintSpec()
  const pdf = renderDesignTemplatePdf(designTemplate("5x8")).toString("latin1")
  assert.match(pdf, /^%PDF-1\.4/)
  assert.equal((pdf.match(/\/MediaBox \[0 0 612 396\]/g) ?? []).length, 2)
  assert.equal((pdf.match(/\/TrimBox \[18 18 594 378\]/g) ?? []).length, 2)
  assert.equal((pdf.match(/\/BleedBox \[0 0 612 396\]/g) ?? []).length, 2)
  assert.match(pdf, /Leave this area empty/)
  assert.match(pdf, /quarter inch of bleed/)
  assert.equal(spec.artworkCanvasInches.widthInches, 8.5)
})

test("6x9 designer template PDF is 9.5 by 6.5 inches", () => {
  const pdf = renderDesignTemplatePdf(designTemplate("6x9")).toString("latin1")
  assert.equal((pdf.match(/\/MediaBox \[0 0 684 468\]/g) ?? []).length, 2)
  assert.equal((pdf.match(/\/Type \/Page /g) ?? []).length, 2)
})

test("overlay PNG is transparent at the print-spec pixel size and tints only the back keep-out", () => {
  const front = renderDesignOverlayPng(buildPostcard5x8PrintSpec(), "front")
  const back = renderDesignOverlayPng(buildPostcard5x8PrintSpec(), "back")
  const decodedFront = decodeRaster(front, "png")
  const decodedBack = decodeRaster(back, "png")
  assert.ok(decodedFront)
  assert.ok(decodedBack)
  assert.equal(decodedFront.width, 2550)
  assert.equal(decodedFront.height, 1650)
  assert.equal(alphaAt(decodedFront.rgba, decodedFront.width, 0, 0), 0)
  assert.equal(alphaAt(decodedFront.rgba, decodedFront.width, 75, 825), 255)
  assert.equal(alphaAt(decodedFront.rgba, decodedFront.width, 1922, 1144), 0)
  assert.ok(alphaAt(decodedBack.rgba, decodedBack.width, 1922, 1144) > 0)

  const six = decodeRaster(renderDesignOverlayPng(buildPostcard6x9PrintSpec(), "back"), "png")
  assert.ok(six)
  assert.equal(six.width, 2850)
  assert.equal(six.height, 1950)
  assert.equal(alphaAt(six.rgba, six.width, 0, 0), 0)
})

function alphaAt(rgba: Uint8Array, width: number, x: number, y: number): number {
  return rgba[(y * width + x) * 4 + 3] ?? 0
}
