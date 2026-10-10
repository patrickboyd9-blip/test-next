import assert from "node:assert/strict"
import { test } from "node:test"

import { resolveStudioContact } from "@/lib/campaign-creator/studio-contact"
import type { CreativeSpec } from "@/lib/campaign-creator/types"

import {
  CTA_CONTRAST_MIN,
  HEADLINE_CONTRAST_MIN,
  PRINT_MIN_PT,
  SPLIT_PHOTO_SHARE_MIN,
  contrastRatio,
  fitTextLine,
  layoutIssueCopy,
  photoScrimGradient,
  postcardBackRegions,
  postcardLayoutFamily,
  rectContains,
  rectsIntersect,
  resolvePostcardLayout,
} from "./postcard-layout-qa"

function spec(overrides: Partial<CreativeSpec> = {}): CreativeSpec {
  return {
    layoutVariant: "image_grounded",
    headline: "Free roof inspection, including a complimentary gutter check",
    body: "ABC Roofers looks at the roof and the gutters.",
    callToAction: "Book a free inspection",
    offer: "Free roof inspection",
    phone: "(619) 555-0148",
    website: "https://abcroofers.com",
    qrDestination: "https://abcroofers.com/inspect",
    visualDirection: "Rooflines after rain.",
    tone: "Clear",
    palette: ["#2d6a4f", "#f6f1e7", "#f3ead7"],
    imagery: "stock_generic_local",
    leadJob: "offer",
    imageryRole: "neighborhood",
    ...overrides,
  }
}

test("pale type on a cream photo panel is repaired above the contrast minimum", () => {
  const plan = resolvePostcardLayout({
    spec: spec(),
    showWordmark: true,
  })
  assert.equal(plan.family, "photo-dominant")
  assert.equal(plan.photoShare, 1)
  assert.ok(plan.scrimRect)
  const ratio = contrastRatio(plan.colors.headline, plan.colors.scrim)
  assert.ok(ratio >= HEADLINE_CONTRAST_MIN, `headline contrast ${ratio}`)
  assert.ok(
    contrastRatio(plan.colors.ctaInk, plan.colors.ctaFill) >= CTA_CONTRAST_MIN
  )
  assert.equal(
    plan.issues.filter((issue) => issue.code === "contrast").length,
    0
  )
  assert.equal(plan.hero, "Free roof inspection")
  assert.match(plan.subheadline, /gutter/i)
})

test("a long green-card headline fits without dropping under the print minimum", () => {
  const plan = resolvePostcardLayout({
    spec: spec({
      layoutVariant: "type_primary_split",
      headline: "Your roof may already be letting water in after last week's storm",
      palette: ["#1b4332", "#d8f3dc", "#fefae0"],
      imageryRole: "consequence",
    }),
    showWordmark: true,
  })
  assert.equal(plan.family, "split")
  assert.ok(plan.photoShare >= SPLIT_PHOTO_SHARE_MIN)
  assert.ok(headlineWords(plan.headline) <= 8, plan.headline)
  assert.equal(plan.headline, "Your roof may already be letting water in")
  assert.match(plan.subheadline, /After last week's storm/)
  assert.ok(plan.typePt.headline >= PRINT_MIN_PT.headline)
  assert.ok(plan.typePt.subhead >= PRINT_MIN_PT.subhead)
  assert.ok(plan.typePt.cta >= PRINT_MIN_PT.cta)
  assert.ok(plan.typePt.contact >= PRINT_MIN_PT.contact)
  assert.equal(plan.issues.length, 0, JSON.stringify(plan.issues))
  assert.ok(contrastRatio(plan.colors.headline, plan.colors.field) >= HEADLINE_CONTRAST_MIN)
})

test("an offer already written into the subhead is pulled out so it can be larger than the body", () => {
  const plan = resolvePostcardLayout({
    spec: spec({
      layoutVariant: "banded_split",
      headline: "A local crew that shows up when the weather turns on your street",
      subheadline: "Free roof inspection. Chula Vista.",
      leadJob: "trust",
      imageryRole: "crew",
    }),
    showWordmark: true,
  })
  assert.equal(plan.headline, "A local crew that shows up")
  assert.match(plan.subheadline, /Chula Vista/)
  assert.doesNotMatch(plan.subheadline, /Free roof inspection/i)
  assert.equal(plan.offerLine, "Free roof inspection")
})

test("split layouts keep at least 55% of the card for the photograph", () => {
  for (const layoutVariant of ["type_primary_split", "peer_split", "banded_split"] as const) {
    const plan = resolvePostcardLayout({
      spec: spec({ layoutVariant, imageryRole: "crew", leadJob: "trust" }),
    })
    assert.equal(plan.family, "split")
    assert.ok(plan.photoShare >= SPLIT_PHOTO_SHARE_MIN, layoutVariant)
    assert.ok(plan.photoRect)
  }
})

test("type-led is only the no-photo piece or an explicit accent witness", () => {
  const typeOnly = resolvePostcardLayout({
    spec: spec({ layoutVariant: "type_only", imageryRole: "none", imagery: "none" }),
  })
  assert.equal(postcardLayoutFamily(typeOnly), "type-led")
  assert.equal(typeOnly.photoShare, 0)
  assert.equal(typeOnly.photoRect, null)

  const accent = resolvePostcardLayout({
    spec: spec({
      layoutVariant: "type_primary_split",
      imagePresence: "accent",
      typeRole: "copy",
    }),
  })
  assert.equal(accent.family, "type-led")
  assert.ok(accent.photoShare < SPLIT_PHOTO_SHARE_MIN)
  assert.ok(accent.photoRect)
})

test("front type stays inside the safe inset and the back keeps creative type out of the address keep-out", () => {
  const back = postcardBackRegions()
  const families = [
    spec(),
    spec({ layoutVariant: "peer_split", leadJob: "trust", imageryRole: "crew" }),
    spec({ layoutVariant: "banded_split", leadJob: "urgency", imageryRole: "crew" }),
    spec({ layoutVariant: "type_primary_split" }),
    spec({ layoutVariant: "type_only", imageryRole: "none", imagery: "none" }),
  ]
  for (const next of families) {
    const plan = resolvePostcardLayout({ spec: next })
    assert.ok(rectContains(back.safe, plan.textColumn), plan.layoutVariant)
    if (plan.photoRect && plan.family !== "photo-dominant") {
      assert.equal(rectsIntersect(plan.textColumn, plan.photoRect), false, plan.layoutVariant)
    }
  }
  assert.equal(rectsIntersect(back.returnAddress, back.mailingPanel), false)
  assert.equal(rectsIntersect(back.returnAddress, back.barcodeStrip), false)
  assert.equal(rectsIntersect(back.indicia, back.mailingPanel), false)
  assert.equal(rectsIntersect(back.indicia, back.barcodeStrip), false)
  assert.ok(rectContains(back.safe, back.returnAddress))
  assert.ok(rectContains(back.safe, back.indicia))
})

test("a line that cannot fit at the print minimum stays an issue", () => {
  const fitted = fitTextLine({
    text: "Supercalifragilisticexpialidocious ".repeat(12).trim(),
    widthIn: 1.1,
    heightIn: 0.2,
    minPt: PRINT_MIN_PT.headline,
    maxPt: 48,
    em: 0.62,
    lineHeight: 1,
  })
  assert.equal(fitted.overflows, true)
  assert.equal(fitted.fontPt, PRINT_MIN_PT.headline)
  assert.match(layoutIssueCopy({ code: "overflow", role: "headline", detail: "" }), /doesn't fit/)
})

test("a type-led booking card fails AF7 when the QR cannot be encoded", () => {
  const plan = resolvePostcardLayout({
    spec: spec({
      layoutVariant: "type_only",
      imageryRole: "none",
      imagery: "none",
      headline: "Book In Seconds",
      palette: ["#1e3a5f", "#F5C518", "#f4f1ea"],
      phone: undefined,
      website: undefined,
      qrDestination: "not a destination",
    }),
  })
  const af7 = plan.rubric.find((check) => check.id === "AF7")
  assert.equal(af7?.pass, false, af7?.detail)
  assert.match(af7?.detail ?? "", /missing or will not scan/)
  assert.ok(plan.issues.some((issue) => issue.code === "qr"))
  assert.match(layoutIssueCopy({ code: "qr", role: "contact", detail: "" }), /will not scan/)
})

test("the QR check uses the code the card paints, including the brief website", () => {
  const next = spec({
    layoutVariant: "type_only",
    imageryRole: "none",
    imagery: "none",
    headline: "Your Table Is Waiting",
    phone: undefined,
    website: undefined,
    qrDestination: "Reserve a table",
  })
  const withoutBrief = resolvePostcardLayout({ spec: next })
  assert.ok(withoutBrief.issues.some((issue) => issue.code === "qr"))

  const contact = resolveStudioContact(next, {
    businessName: "Jordan's Plumbing",
    website: "https://jordans.example/book",
  })
  const plan = resolvePostcardLayout({ spec: next, contact })
  const af7 = plan.rubric.find((check) => check.id === "AF7")
  assert.equal(af7?.pass, true, af7?.detail)
  assert.equal(plan.issues.some((issue) => issue.code === "qr"), false)
  assert.equal(contact.qrPayload, "https://jordans.example/book")
})

test("a type-led booking URL decodes, so AF7 passes", () => {
  const plan = resolvePostcardLayout({
    spec: spec({
      layoutVariant: "type_only",
      imageryRole: "none",
      imagery: "none",
      headline: "Book In Seconds",
      palette: ["#1e3a5f", "#F5C518", "#f4f1ea"],
    }),
  })
  assert.equal(plan.family, "type-led")
  const af7 = plan.rubric.find((check) => check.id === "AF7")
  assert.equal(af7?.pass, true, af7?.detail)
  assert.match(af7?.detail ?? "", /it scans/)
})

test("photo-led type sits on a gradient that stays opaque under the words", () => {
  const plan = resolvePostcardLayout({ spec: spec() })
  assert.equal(plan.family, "photo-dominant")
  assert.ok(plan.scrimRect)
  assert.ok(plan.scrimRect.w > plan.textColumn.w)
  assert.ok(plan.colors.scrimOpacity >= 0.88)
  const gradient = photoScrimGradient(plan)
  assert.match(gradient ?? "", /linear-gradient\(90deg/)
  const overWhite = composite(plan.colors.scrim, "#ffffff", plan.colors.scrimOpacity)
  const overBlack = composite(plan.colors.scrim, "#000000", plan.colors.scrimOpacity)
  assert.ok(contrastRatio(plan.colors.headline, overWhite) >= HEADLINE_CONTRAST_MIN)
  assert.ok(contrastRatio(plan.colors.ink, overBlack) >= HEADLINE_CONTRAST_MIN)
  const solidStop = Number(gradient?.match(/(\d+\.\d+)%/)?.[1])
  const textRight = ((plan.textColumn.x + plan.textColumn.w) / plan.scrimRect.w) * 100
  assert.ok(solidStop + 0.2 >= textRight, `solid ${solidStop} text ${textRight}`)
})

test("a pale split panel takes a bolder color from the campaign palette", () => {
  const plan = resolvePostcardLayout({
    spec: spec({
      layoutVariant: "peer_split",
      headline: "See The Transformation",
      subheadline: "One finished roof.",
      callToAction: "Book the inspection",
      palette: ["#1e3a5f", "#8aa4b5", "#f6f1e7"],
      leadJob: "trust",
      imageryRole: "neighborhood",
    }),
    showWordmark: true,
  })
  assert.equal(plan.family, "split")
  assert.ok(plan.photoShare + 0.001 >= 0.55, String(plan.photoShare))
  assert.equal(plan.colors.field.toLowerCase(), "#1e3a5f")
  assert.equal(plan.headlineWeight, 800)
  assert.ok(contrastRatio(plan.colors.headline, plan.colors.field) >= HEADLINE_CONTRAST_MIN)
  assert.equal(plan.issues.filter((issue) => issue.code === "contrast" || issue.code === "photo-share").length, 0)
})

test("scrim contrast holds over both a white and a black photograph", () => {
  const plan = resolvePostcardLayout({ spec: spec() })
  const overWhite = composite(plan.colors.scrim, "#ffffff", plan.colors.scrimOpacity)
  const overBlack = composite(plan.colors.scrim, "#000000", plan.colors.scrimOpacity)
  assert.ok(contrastRatio(plan.colors.headline, overWhite) >= HEADLINE_CONTRAST_MIN)
  assert.ok(contrastRatio(plan.colors.headline, overBlack) >= HEADLINE_CONTRAST_MIN)
})

function headlineWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length
}

function composite(scrim: string, photo: string, opacity: number): string {
  const left = rgb(scrim)
  const right = rgb(photo)
  const mixed = left.map((channel, index) =>
    Math.round(channel * opacity + right[index] * (1 - opacity))
  )
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
}

function rgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "")
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ]
}
