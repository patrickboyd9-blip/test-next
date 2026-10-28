import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

import fontkit from "@pdf-lib/fontkit"
import { PDFDocument } from "pdf-lib"

import { MEDICARE_AGENT_DISCLAIMER } from "../campaign-creator/medicare-compliance"
import { buildPostcard5x8PrintSpec } from "./postcard-5x8-print-spec"
import { encodeSolidPng } from "./raster"
import {
  addressBackDisclaimerPlacement,
  addressBackPlan,
  addressBackQrPlacement,
  addressSideContentRect,
  disclaimerPrintFits,
  assertPostcardPrintPdf,
  assertPrintImageDpi,
  postcardPrintLines,
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

test("a Medicare disclaimer fits the address-side content box and stays off the QR", async () => {
  const spec = buildPostcard5x8PrintSpec()
  const content = addressSideContentRect(spec)
  const band = addressBackDisclaimerPlacement(content, MEDICARE_AGENT_DISCLAIMER)
  assert.ok(band)
  assert.equal(containsRect(content, band!), true)
  for (const keepOut of spec.keepOuts) {
    assert.equal(rectsOverlap(band!, keepOut.canvas), false)
  }
  const qr = addressBackQrPlacement(content, true, true, band!.heightInches)
  assert.ok(qr)
  assert.equal(rectsOverlap(band!, qr!), false)
  assert.equal(containsRect(content, qr!), true)

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(
    readFileSync(path.join(process.cwd(), "lib/print-spec/fonts/SourceSans3-Regular.ttf"))
  )
  const fit = disclaimerPrintFits(font, MEDICARE_AGENT_DISCLAIMER, band!)
  assert.equal(fit.fits, true)
  assert.ok(fit.size >= 8)

  const plan = addressBackPlan({
    ...SAMPLE_POSTCARD_COPY,
    disclaimer: MEDICARE_AGENT_DISCLAIMER,
    offer: "They book a plan review",
  })
  assert.equal(plan.disclaimer, MEDICARE_AGENT_DISCLAIMER)
  assert.equal(plan.offer, "You book a plan review")
  const lines = postcardPrintLines({
    headline: "Free Plan Review",
    disclaimer: MEDICARE_AGENT_DISCLAIMER,
  })
  assert.ok(lines.includes(MEDICARE_AGENT_DISCLAIMER))

  const rendered = await renderPostcardPrintPdf({
    copy: {
      businessName: "Harbor Advisors",
      headline: "Free Plan Review",
      body: "We walk through the plans we offer in your area.",
      offer: "Free plan review",
      callToAction: "Scan for a review",
      phone: "555-0142",
      website: "harbor.example",
      qrPayload: "https://harbor.example/review",
      disclaimer: MEDICARE_AGENT_DISCLAIMER,
    },
  })
  await assertPostcardPrintPdf(rendered.bytes)
  assert.equal(rendered.bytes.byteLength > 1000, true)
})

test("print lines keep a provided phone and website", () => {
  const lines = postcardPrintLines({
    headline: "Small Leaks Start Quiet",
    phone: "222-333-4456",
    website: "www.abcroofers.com",
    qrPayload: "https://www.abcroofers.com/book",
  })
  assert.ok(lines.includes("222-333-4456"))
  assert.ok(lines.includes("www.abcroofers.com"))
})

test("a photograph under 300 DPI is refused", () => {
  assert.throws(
    () => assertPrintImageDpi({ width: 800, height: 500 }),
    /300 DPI/
  )
})

test("print PDF is two 612 by 396 point pages with embedded fonts", async () => {
  const preview = encodeSolidPng(1024, 1024, [10, 20, 30])
  const enlarged = await renderPostcardPrintPdf({
    copy: { headline: "The house cools down again" },
    image: { bytes: preview, width: 1024, height: 1024 },
  })
  assert.equal(enlarged.artwork, "final-photo")
  assert.ok(enlarged.imageDpi.x >= 300)
  assert.ok(enlarged.imageDpi.y >= 300)

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
