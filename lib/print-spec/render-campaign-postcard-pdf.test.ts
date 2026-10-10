import assert from "node:assert/strict"
import { test } from "node:test"

import { buildPostcard5x8PrintSpec } from "./postcard-5x8-print-spec"
import { encodeSolidPng } from "./raster"
import {
  addressSideContentRect,
  assertPostcardPrintPdf,
  assertPrintImageDpi,
  rectsOverlap,
  renderPostcardPrintPdf,
} from "./render-campaign-postcard-pdf"

test("address-side copy stays out of the catalog keep-outs", () => {
  const spec = buildPostcard5x8PrintSpec()
  const content = addressSideContentRect(spec)
  for (const keepOut of spec.keepOuts) {
    assert.equal(rectsOverlap(content, keepOut.canvas), false)
  }
  assert.equal(spec.pdfPagePoints.widthPoints, 612)
  assert.equal(spec.pdfPagePoints.heightPoints, 396)
})

test("a photograph under 300 DPI is refused", () => {
  assert.throws(
    () => assertPrintImageDpi({ width: 800, height: 500 }),
    /300 DPI/
  )
})

test("print PDF is two 612 by 396 point pages with embedded fonts", async () => {
  const tiny = encodeSolidPng(32, 32, [10, 20, 30])
  await assert.rejects(
    () =>
      renderPostcardPrintPdf({
        copy: { headline: "Too small" },
        image: { bytes: tiny, width: 32, height: 32 },
      }),
    /300 DPI/
  )

  const rendered = await renderPostcardPrintPdf({
    copy: {
      businessName: "Northwind HVAC",
      headline: "A quieter house",
      body: "The crew checks the system and tells you what it needs.",
      offer: "Free inspection",
      callToAction: "Call to book",
      phone: "555-0100",
      website: "northwind.example",
    },
    plateColor: [24, 58, 82],
  })
  assert.equal(rendered.artwork, "type-plate")
  assert.ok(rendered.imageDpi.x >= 300)
  assert.ok(rendered.imageDpi.y >= 300)
  await assertPostcardPrintPdf(rendered.bytes)
  assert.ok(rendered.bytes.byteLength > 1000)
})
