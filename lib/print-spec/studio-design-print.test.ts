import assert from "node:assert/strict"
import { test } from "node:test"

import { PDFDocument } from "pdf-lib"

import { qrPaintDecodes } from "@/lib/campaign-creator/studio-qr"
import { directDesign } from "@/lib/design-intelligence/art-director"
import {
  composeGridCard,
  paintedTextRects,
  rectsIntersect,
  seatThumbnailFrame,
  textInsideSafe,
} from "@/lib/design-intelligence/grid-composer"
import { selectReferences } from "@/lib/design-intelligence/select"
import { headIsClipped, personFocal } from "@/lib/design-intelligence/subject-crop"
import { trimKeepOuts } from "@/lib/postcard-layouts/compose"

import { buildPostcard5x8PrintSpec } from "./postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "./postcard-6x9-print-spec"
import { renderStudioDesignPdf, selectPrintDesign } from "./render-template-postcard-pdf"

const brief = {
  goal: "Book a free roof inspection",
  offer: "Free inspection",
  phone: "(619) 555-0148",
  website: "https://northline.example/book",
  businessInfo: { name: "Northline Roofing" },
}

test("a thumbnail frame at 0.23 in is seated inside the 0.25 in margin", () => {
  const seated = seatThumbnailFrame({ x: 0.23, y: 4.08, w: 1.74, h: 0.64 }, "5x8")
  assert.equal(textInsideSafe(seated, "5x8"), true)
  assert.ok(seated.x >= 0.25)
  assert.ok(seated.y + seated.h <= 5 - 0.25 + 0.001)
})

test("a short photo band clips a head and a full-height portrait does not", () => {
  assert.equal(
    headIsClipped({
      id: "band",
      role: "photo",
      treatment: "cover",
      bleed: true,
      rect: { x: 0, y: 0, w: 8, h: 2.1 },
      focal: { x: 0.5, y: 0.5 },
    }),
    true
  )
  assert.equal(
    headIsClipped({
      id: "portrait",
      role: "photo",
      treatment: "cover",
      bleed: true,
      rect: { x: 3.7, y: 0, w: 4.3, h: 5 },
      focal: personFocal(),
    }),
    false
  )
})

test("the print pdf is the preview design for 5x8 and 6x9", async () => {
  const selection = selectReferences([], brief)
  const directed = directDesign({ brief, selection, trim: "5x8", slot: 0 })
  const spec = {
    headline: "A dry, safe home starts here.",
    offer: "Free inspection",
    phone: brief.phone,
    website: brief.website,
    qrDestination: brief.website,
  }
  for (const size of ["5x8", "6x9"] as const) {
    const rationale = { ...directed.rationale, format: { trim: size, orientation: "landscape" as const } }
    const preview = composeGridCard({
      rationale,
      spec,
      businessName: "Northline Roofing",
      disclaimer: "Licensed and local.",
    })
    const chosen = selectPrintDesign({
      rationale,
      studio: preview,
      templateId: "hero_scrim",
    })
    assert.equal(chosen.source, "studio")
    if (chosen.source !== "studio") continue
    assert.equal(chosen.card, preview)

    const payload = "https://northline.example/book"
    assert.equal(qrPaintDecodes(payload), true)
    const printed = await renderStudioDesignPdf({
      card: chosen.card,
      copy: {
        headline: spec.headline,
        offer: spec.offer,
        businessName: "Northline Roofing",
        phone: spec.phone,
        website: "northline.example/book",
        qrPayload: payload,
        disclaimer: "Licensed and local.",
      },
    })
    assert.equal(printed.design, preview)
    assert.equal(preview.front.lockup?.qrLabel, "Scan to book")
    assert.match(preview.front.lockup?.phone?.text ?? "", /555-0148/)
    assert.match(preview.front.lockup?.website?.text ?? "", /northline/)
    assert.equal(textInsideSafe(preview.front.lockup!.qrRect, size), true)
    for (const box of paintedTextRects(preview.front)) {
      assert.equal(textInsideSafe(box.rect, size), true, `${size} ${box.role}`)
    }
    for (const text of preview.back.texts) {
      assert.equal(textInsideSafe(text.rect, size), true, `${size} back ${text.role}`)
      for (const keepOut of trimKeepOuts(size)) {
        assert.equal(rectsIntersect(text.rect, keepOut), false, `${size} ${text.text} touches ${keepOut.id}`)
      }
    }
    assert.match(preview.back.texts.map((text) => text.text).join(" "), /Licensed and local/)

    const geometry = size === "6x9" ? buildPostcard6x9PrintSpec() : buildPostcard5x8PrintSpec()
    assert.equal(geometry.bleedInchesPerSide, 0.25)
    assert.equal(geometry.recommendedSafeTextInsetInches, 0.25)
    const doc = await PDFDocument.load(printed.bytes)
    assert.equal(doc.getPageCount(), 2)
    const page = doc.getPage(0)
    const pageSize = page.getSize()
    assert.ok(Math.abs(pageSize.width - geometry.pdfPagePoints.widthPoints) < 0.05)
    assert.ok(Math.abs(pageSize.height - geometry.pdfPagePoints.heightPoints) < 0.05)
    const trim = page.getTrimBox()
    assert.ok(Math.abs(trim.width - geometry.finishedTrimInches.widthInches * 72) < 0.2)
    assert.ok(Math.abs(trim.height - geometry.finishedTrimInches.heightInches * 72) < 0.2)
  }
})
