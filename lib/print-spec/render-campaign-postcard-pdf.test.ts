import assert from "node:assert/strict"
import { test } from "node:test"

import { buildPostcard5x8PrintSpec } from "./postcard-5x8-print-spec"
import { encodeSolidPng } from "./raster"
import {
  addressBackPlan,
  addressBackQrPlacement,
  addressSideContentRect,
  assertPostcardPrintPdf,
  assertPrintImageDpi,
  rectsOverlap,
  renderPostcardPrintPdf,
  renderSamplePostcardPdf,
  SAMPLE_POSTCARD_COPY,
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

test("address-side sample uses creative fields and keeps the QR out of the keep-outs", () => {
  const plan = addressBackPlan(SAMPLE_POSTCARD_COPY)
  assert.equal(plan.brand, "Northwind HVAC")
  assert.equal(plan.message, "A quieter house")
  assert.equal(plan.offer, "Free inspection")
  assert.equal(plan.phone, "555-0100")
  assert.equal(plan.qrPayload, "https://northwind.example/inspect")
  assert.deepEqual(plan.returnLines, ["100 Market St, Austin, TX 78701"])
  assert.equal(JSON.stringify(SAMPLE_POSTCARD_COPY).includes("Staging sample"), false)

  const spec = buildPostcard5x8PrintSpec()
  const content = addressSideContentRect(spec)
  const qr = addressBackQrPlacement(content, true)
  assert.ok(qr)
  assert.equal(containsRect(content, qr!), true)
  for (const keepOut of spec.keepOuts) {
    assert.equal(rectsOverlap(qr!, keepOut.canvas), false)
  }
})

function containsRect(outer: { xInches: number; yInches: number; widthInches: number; heightInches: number }, inner: { xInches: number; yInches: number; widthInches: number; heightInches: number }): boolean {
  return (
    inner.xInches >= outer.xInches - 0.001 &&
    inner.yInches >= outer.yInches - 0.001 &&
    inner.xInches + inner.widthInches <= outer.xInches + outer.widthInches + 0.001 &&
    inner.yInches + inner.heightInches <= outer.yInches + outer.heightInches + 0.001
  )
}

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

  const sample = await renderSamplePostcardPdf()
  await assertPostcardPrintPdf(sample)
})
