import assert from "node:assert/strict"
import { test } from "node:test"

import type { CampaignBrief, CreativeDirection, CreativeSpec } from "@/lib/campaign-creator/types"
import { renderTemplatedPostcardPdf } from "@/lib/print-spec/render-template-postcard-pdf"
import { applyResearchLayouts } from "@/lib/reference-corpus/research-layout"

import { assignTemplates, verticalPaletteForBrief } from "./assign"
import {
  backMessageRect,
  composePostcardFace,
  contentTrimRect,
  safeTrimRect,
  trimKeepOuts,
  trustChipsForCopy,
} from "./compose"
import { POSTCARD_TEMPLATE_IDS, type PostcardSizeId, type PostcardTemplateId } from "./ids"
import { VERTICAL_PALETTES, contrastRatio } from "./palette"
import { customerPhotoUrls, slotPhotoSources } from "./photos"
import { isRoofingProTemplate } from "@/lib/roofing-pro/ids"
import { TEMPLATE_META, rectContains, rectsOverlap, templatesForPalette } from "./templates"

const SIZES: PostcardSizeId[] = ["5x8", "6x9"]

const SAMPLE: Record<string, CreativeSpec> = {
  roofing: {
    headline: "A roof that stays dry",
    subheadline: "We walk it and tell you what can wait.",
    body: "ABC Roofers checks the roof and the gutters.",
    offer: "Free roof inspection",
    callToAction: "Book a free inspection",
    phone: "(619) 555-0148",
    website: "https://abcroofers.com/inspect",
    qrDestination: "https://abcroofers.com/inspect",
  },
  plumbing: {
    headline: "A slow leak costs more",
    subheadline: "We find it before it spreads.",
    body: "Call when a drain needs a look.",
    offer: "Free leak check",
    callToAction: "Book a plumber",
    phone: "(512) 555-0160",
    website: "https://localpipe.example/check",
    qrDestination: "https://localpipe.example/check",
  },
  hvac: {
    headline: "Cool the house before the heat",
    subheadline: "A tune-up takes one visit.",
    body: "Northwind checks the system and the filter.",
    offer: "Free system tune-up",
    callToAction: "Book a tune-up",
    phone: "(512) 555-0194",
    website: "https://northwindair.com/tune-up",
    qrDestination: "https://northwindair.com/tune-up",
  },
  medicare: {
    headline: "Free plan review",
    subheadline: "A local look at the plans we offer.",
    body: "Scan or call and we will walk through the plans we offer in your area.",
    offer: "Free plan review",
    callToAction: "Book a review",
    phone: "(206) 555-0133",
    website: "https://harbor.example/review",
    qrDestination: "https://harbor.example/review",
  },
}

function direction(index: number, layout: CreativeSpec["layoutVariant"]): CreativeDirection {
  return {
    id: `dir-${index}`,
    name: ["First Direction", "Second Direction", "Third Direction"][index] ?? "Direction",
    rationale: "A distinct frame for this campaign and this audience.",
    designedToDrive: "Calls",
    tags: ["Local"],
    recommended: index === 0,
    oneLineDifference: index === 0 ? undefined : "A different frame",
    createdAt: "2026-10-16T00:00:00.000Z",
    spec: {
      layoutVariant: layout,
      headline: "Keep the number",
      body: "You can call when you need a look.",
      callToAction: "Book a time",
      offer: "Free check",
      phone: "(512) 555-0100",
      website: "https://example-local.test",
      visualDirection: "A quiet street.",
      tone: "Calm",
      palette: ["#1f3a4d", "#d7e2ea", "#f4f1ea"],
      imagery: "stock_generic_local",
      leadJob: "trust",
      imageryRole: "neighborhood",
    },
  }
}

test("the catalog is 14 original compositions plus 10 roofing pro templates", () => {
  assert.equal(POSTCARD_TEMPLATE_IDS.length, 24)
  assert.equal(new Set(POSTCARD_TEMPLATE_IDS).size, 24)
  for (const id of POSTCARD_TEMPLATE_IDS) {
    assert.equal(TEMPLATE_META[id].id, id)
  }
})

test("palettes clear 4.5:1 for ink, field, and accent", () => {
  for (const palette of Object.values(VERTICAL_PALETTES)) {
    assert.ok(contrastRatio(palette.ink, palette.paper) >= 4.5, palette.id)
    assert.ok(contrastRatio(palette.fieldInk, palette.field) >= 4.5, `${palette.id} field`)
    assert.ok(contrastRatio(palette.accentInk, palette.accent) >= 4.5, `${palette.id} accent`)
    assert.ok(contrastRatio(palette.accent, palette.paper) >= 4.5, `${palette.id} accent on paper`)
    assert.ok(contrastRatio(palette.offerInk, palette.offerTile) >= 4.5, `${palette.id} offer tile`)
  }
  assert.notEqual(VERTICAL_PALETTES.medicare.offerTile, VERTICAL_PALETTES.roofing.offerTile)
})

test("representative copy fits, stays in the safe zone, and keeps contact", () => {
  for (const size of SIZES) {
    for (const id of POSTCARD_TEMPLATE_IDS) {
      const spec = specFor(id)
      const front = composePostcardFace({
        templateId: id,
        size,
        paletteId: paletteFor(id),
        spec,
        qrPayload: spec.qrDestination,
        businessName: "Harbor Local",
      })
      assert.equal(front.overflows, false, `${id} ${size}`)
      assert.deepEqual(front.missingContact, [], `${id} ${size}`)
      assert.equal(front.lockup?.qrLabel, "Scan to book", `${id} ${size}`)
      assert.ok((front.lockup?.qrInches ?? 0) >= 0.75, `${id} ${size} qr`)
      const safe = safeTrimRect(size)
      for (const text of front.texts) {
        assert.equal(rectContains(safe, text.rect), true, `${id} ${size} ${text.role}`)
        assert.ok(text.fontPt >= 8, `${id} ${text.role}`)
      }
      if (front.lockup) {
        assert.equal(rectContains(safe, front.lockup.rect), true, `${id} lockup`)
        if (front.lockup.phoneBox) {
          assert.equal(rectContains(safe, front.lockup.phoneBox.rect), true, `${id} phone`)
          assert.equal(rectsOverlap(front.lockup.phoneBox.rect, front.lockup.qrRect), false, `${id} phone/qr`)
          if (front.lockup.website) {
            assert.equal(rectsOverlap(front.lockup.phoneBox.rect, front.lockup.website.rect, 0.02), false, `${id} phone/web`)
          }
        }
        assert.equal(rectContains(safe, front.lockup.qrRect), true, `${id} qr`)
      }
      const offer = front.texts.find((text) => text.role === "offer")
      const tile = front.shapes.find((shape) => shape.role === "offer-tile" || shape.role === "coupon")
      assert.ok(tile, `${id} offer tile`)
      if (offer && tile) assert.equal(rectContains(tile.rect, offer.rect, 0.04), true, `${id} offer in tile`)
      const headline = front.texts.find((text) => text.role === "headline")
      const body = front.texts.find((text) => text.role === "body")
      if (offer && headline && !isRoofingProTemplate(id)) assert.ok(offer.fontPt > headline.fontPt, `${id} offer hierarchy`)
      if (offer && headline && isRoofingProTemplate(id)) {
        if (id === "roof_coupon") assert.ok(offer.fontPt > headline.fontPt, `${id} coupon hierarchy`)
        else assert.ok(headline.fontPt > offer.fontPt, `${id} headline hierarchy`)
      }
      if (headline && body && body.lines.length > 0) assert.ok(headline.fontPt >= body.fontPt * 2.5 - 0.01, `${id} headline hierarchy`)
      if (headline && body && body.lines.length > 0) assert.ok(headline.fontPt > body.fontPt, `${id} body hierarchy`)
    }
  }
})

test("a long headline shrinks until it fits", () => {
  const front = composePostcardFace({
    templateId: "hero_scrim",
    paletteId: "roofing",
    spec: {
      ...SAMPLE.roofing,
      headline: "Your roof may already be letting water in",
    },
    qrPayload: SAMPLE.roofing.qrDestination,
  })
  const headline = front.texts.find((text) => text.role === "headline")
  assert.ok(headline)
  assert.equal(headline.overflows, false)
  assert.equal(front.overflows, false)
  assert.ok(headline.fontPt <= 28)
  const coupon = composePostcardFace({
    templateId: "deadline_coupon",
    paletteId: "plumbing",
    spec: {
      ...SAMPLE.plumbing,
      offer: "Free leak check this week for your home",
    },
    qrPayload: SAMPLE.plumbing.qrDestination,
  })
  const offer = coupon.texts.find((text) => text.role === "offer")
  assert.ok(offer)
  assert.equal(offer.overflows, false)
  assert.ok(offer.fontPt < 36)
})

test("back message stays out of the address keep-outs", () => {
  for (const size of SIZES) {
    for (const id of POSTCARD_TEMPLATE_IDS) {
      const disclaimer = id === "medicare_calm" || id === "portrait_aside" || id === "neighbor_letter"
      const back = composePostcardFace({
        templateId: id,
        size,
        face: "back",
        paletteId: paletteFor(id),
        disclaimer,
        spec: specFor(id),
        businessName: "Harbor Local",
      })
      assert.equal(back.overflows, false, `${id} ${size} back`)
      const content = contentTrimRect(size)
      const keepOuts = trimKeepOuts(size)
      const message = backMessageRect(size, disclaimer)
      assert.equal(rectContains(content, message, 0.03), true, `${id} content`)
      for (const keepOut of keepOuts) {
        assert.equal(rectsOverlap(message, keepOut), false, `${id} ${keepOut.id}`)
      }
      for (const text of back.texts) {
        const bound = isRoofingProTemplate(id) ? content : message
        assert.equal(rectContains(bound, text.rect, 0.04), true, `${id} ${text.role}`)
        for (const keepOut of keepOuts) {
          assert.equal(rectsOverlap(text.rect, keepOut), false, `${id} ${text.role} ${keepOut.id}`)
        }
      }
    }
  }
})

test("each vertical gives the three directions different compositions", () => {
  const briefs: Array<[string, CampaignBrief]> = [
    ["roofing", { goal: "Book roof inspections" }],
    ["plumbing", { goal: "Need a plumber for a leaking drain" }],
    ["hvac", { goal: "Book an HVAC tune-up" }],
    ["medicare", { goal: "Book Medicare plan reviews" }],
    ["real_estate", { goal: "Sell a house in Austin" }],
    ["general", { goal: "Invite the neighborhood to a grand opening" }],
  ]
  for (const [name, brief] of briefs) {
    const palette = verticalPaletteForBrief(brief)
    const applied = applyResearchLayouts(brief, [
      direction(0, "type_only"),
      direction(1, "peer_split"),
      direction(2, "image_grounded"),
    ])
    const templates = applied.map((item) => item.spec.layoutHints?.templateId)
    assert.equal(new Set(templates).size, 3, name)
    const allowed = templatesForPalette(palette)
    for (const template of templates) {
      assert.equal(allowed.includes(template as PostcardTemplateId), true, `${name} ${template}`)
    }
    if (name === "medicare") {
      assert.equal(templates.includes("deadline_coupon"), false)
      assert.equal(templates.includes("offer_starburst"), false)
      assert.equal(templates.includes("storm_alert"), false)
      assert.equal(templates.includes("financing_first"), false)
    }
    if (name === "roofing") {
      assert.deepEqual(templates, ["roof_full_bleed", "roof_split", "roof_coupon"])
    }
  }
})

test("roofing copy can choose a matching composition without repeating one", () => {
  const brief: CampaignBrief = { goal: "Book roof inspections" }
  const storm = direction(0, "peer_split")
  storm.spec.headline = "Hail moved through town"
  storm.spec.offer = "Free roof inspection"
  const price = direction(1, "image_grounded")
  price.spec.headline = "A new roof on a payment"
  price.spec.offer = "As low as $89 a month"
  price.recommended = false
  const commercial = direction(2, "type_primary_split")
  commercial.spec.headline = "A commercial flat roof"
  commercial.spec.offer = "Free roof inspection"
  commercial.spec.body = "Membrane restoration for the building."
  commercial.recommended = false
  const applied = assignTemplates(brief, [storm, price, commercial])
  assert.deepEqual(
    applied.map((item) => item.spec.layoutHints?.templateId),
    ["roof_storm", "roof_coupon", "roof_premium"]
  )
})

test("trust chips repeat claims and never invent a badge", () => {
  assert.deepEqual(trustChipsForCopy("Free roof inspection"), [])
  assert.deepEqual(trustChipsForCopy("Free plan review"), [])
  assert.deepEqual(
    trustChipsForCopy("Licensed and insured. 18 years in town."),
    [
      { id: "years", label: "18 years" },
      { id: "licensed", label: "Licensed" },
      { id: "insured", label: "Insured" },
    ]
  )
  const plain = composePostcardFace({
    templateId: "storm_alert",
    paletteId: "roofing",
    spec: SAMPLE.roofing,
    qrPayload: SAMPLE.roofing.qrDestination,
  })
  assert.deepEqual(plain.trust, [])
  assert.equal(plain.texts.some((text) => text.text === "Local"), false)
  const supported = composePostcardFace({
    templateId: "storm_alert",
    paletteId: "roofing",
    spec: { ...SAMPLE.roofing, subheadline: "Licensed and insured" },
    qrPayload: SAMPLE.roofing.qrDestination,
  })
  assert.deepEqual(
    supported.trust.map((chip) => chip.label),
    ["Licensed", "Insured"]
  )
  const spoken = supported.texts.map((text) => text.text).join(" ")
  assert.doesNotMatch(spoken, /official|government|final notice|act now|expires/i)
})

test("print contact stays large enough to read on a 5x8 and a 6x9", () => {
  for (const size of SIZES) {
    for (const id of ["storm_alert", "financing_first", "before_after"] as const) {
      const front = composePostcardFace({
        templateId: id,
        size,
        paletteId: "roofing",
        spec: {
          ...SAMPLE.roofing,
          phone: "222-333-4455",
          website: "https://www.abcroofing.co",
          offer: "Free roof inspection",
          headline: id === "financing_first" ? "Your Free Roof Inspection" : SAMPLE.roofing.headline,
          subheadline: id === "financing_first" ? "See the roof clearly" : SAMPLE.roofing.subheadline,
          body: id === "financing_first" ? "" : SAMPLE.roofing.body,
        },
        qrPayload: "https://www.abcroofing.co",
      })
      assert.equal(front.overflows, false, `${id} ${size}`)
      assert.deepEqual(front.missingContact, [], `${id} ${size}`)
      assert.ok((front.lockup?.phone?.fontPt ?? 0) >= 14, `${id} ${size} phone`)
      assert.ok((front.lockup?.website?.fontPt ?? 0) >= 9, `${id} ${size} website`)
      assert.ok((front.lockup?.qrInches ?? 0) >= 0.75, `${id} ${size} qr`)
      assert.ok((front.lockup?.qrLabelPt ?? 0) >= 9, `${id} ${size} scan label`)
      assert.equal(front.lockup?.qrLabel, "Scan to book")
      for (const text of front.texts) {
        if (text.role === "body" || text.role === "contact") {
          assert.ok(text.fontPt >= 9, `${id} ${text.role}`)
        }
      }
      const offer = front.texts.find((text) => text.role === "offer")
      assert.ok(offer?.text, `${id} offer`)
      assert.equal(front.texts.filter((text) => /free roof inspection/i.test(text.text)).length, 1, id)
    }
  }
})

test("a years chip is a tenure claim, not the age of a house", () => {
  assert.deepEqual(
    trustChipsForCopy("Homes over 20 years old are where leaks start."),
    []
  )
  assert.equal(
    trustChipsForCopy("Licensed and insured. 18 years in town.")[0]?.label,
    "18 years"
  )
  const aged = composePostcardFace({
    templateId: "before_after",
    size: "6x9",
    paletteId: "roofing",
    spec: {
      ...SAMPLE.roofing,
      headline: "Water Where It Shouldn't",
      body: "Homes over 20 years old are where hidden roof damage starts.",
    },
    qrPayload: SAMPLE.roofing.qrDestination,
  })
  assert.equal(aged.trust.some((chip) => chip.id === "years"), false)
  const before = aged.texts.find((text) => text.text === "Before")
  const after = aged.texts.find((text) => text.text === "After")
  assert.ok(before && before.fontPt >= 11)
  assert.ok(after && after.fontPt >= 11)
  const tenured = composePostcardFace({
    templateId: "before_after",
    size: "6x9",
    paletteId: "roofing",
    spec: { ...SAMPLE.roofing, subheadline: "18 years in town. Licensed and insured." },
    qrPayload: SAMPLE.roofing.qrDestination,
  })
  const years = tenured.trust.find((chip) => chip.id === "years")
  assert.equal(years?.label, "18 years")
  assert.ok((years?.fontPt ?? 0) >= 11)
  assert.ok((years?.rect.h ?? 0) >= 0.36)
})

test("an offer-led headline does not repeat the offer tile", () => {
  const front = composePostcardFace({
    templateId: "financing_first",
    size: "6x9",
    paletteId: "roofing",
    spec: {
      ...SAMPLE.roofing,
      offer: "Free roof inspection",
      headline: "Your Free Roof Inspection",
      subheadline: "",
      body: "",
    },
    qrPayload: SAMPLE.roofing.qrDestination,
  })
  const spoken = front.texts.map((text) => text.text)
  assert.equal(spoken.filter((line) => /free roof inspection/i.test(line)).length, 1)
  assert.equal(spoken.includes("Know what the roof needs"), true)
})

test("the after photograph is not a copy of the before photograph", () => {
  const slots = slotPhotoSources({
    slotCount: 2,
    generatedSrc: "https://cdn.example/damaged.jpg",
    generatedAlternateSrc: "https://cdn.example/finished.jpg",
  })
  assert.deepEqual(slots, [
    "https://cdn.example/damaged.jpg",
    "https://cdn.example/finished.jpg",
  ])
  const missingAfter = slotPhotoSources({
    slotCount: 2,
    generatedSrc: "https://cdn.example/damaged.jpg",
  })
  assert.equal(missingAfter[1], null)
})

test("an uploaded photo fills the slot ahead of the generated one", () => {
  const assets = [
    { id: "a", type: "photo" as const, description: "Front yard", fileUrl: "https://cdn.example/front.jpg" },
    { id: "b", type: "photo" as const, description: "https://cdn.example/after.jpg" },
  ]
  assert.deepEqual(customerPhotoUrls(assets), [
    "https://cdn.example/front.jpg",
    "https://cdn.example/after.jpg",
  ])
  const slots = slotPhotoSources({
    slotCount: 2,
    generatedSrc: "https://cdn.example/generated.jpg",
    assets,
  })
  assert.equal(slots[0], "https://cdn.example/front.jpg")
  assert.equal(slots[1], "https://cdn.example/after.jpg")
  const onlyGenerated = slotPhotoSources({ slotCount: 1, generatedSrc: "https://cdn.example/generated.jpg" })
  assert.deepEqual(onlyGenerated, ["https://cdn.example/generated.jpg"])
})

test("print files keep the 5x8 and 6x9 page boxes and embedded fonts", async () => {
  for (const size of SIZES) {
    for (const id of ["hero_scrim", "medicare_calm", "deadline_coupon", "storm_alert"] as const) {
      const spec = specFor(id)
      const rendered = await renderTemplatedPostcardPdf({
        size,
        templateId: id,
        paletteId: paletteFor(id),
        copy: {
          ...spec,
          businessName: "Harbor Local",
          qrPayload: spec.qrDestination,
          returnLines: ["100 Market St"],
          disclaimer: id === "medicare_calm" ? "We do not offer every plan available in your area." : undefined,
        },
      })
      assert.ok(rendered.bytes.byteLength > 1000)
      const raw = Buffer.from(rendered.bytes).toString("latin1")
      assert.match(raw, /FontFile2|FontFile3/)
    }
  }
})

test("assignTemplates does not change the researched layout family", () => {
  const brief: CampaignBrief = { goal: "Need a plumber" }
  const applied = assignTemplates(brief, [
    direction(0, "type_primary_split"),
    direction(1, "peer_split"),
    direction(2, "peer_split"),
  ])
  assert.deepEqual(
    applied.map((item) => item.spec.layoutVariant),
    ["type_primary_split", "peer_split", "peer_split"]
  )
})

function specFor(id: PostcardTemplateId): CreativeSpec {
  if (id === "medicare_calm" || id === "portrait_aside") return SAMPLE.medicare
  if (id === "deadline_coupon" || id === "neighbor_letter") return SAMPLE.plumbing
  if (id === "service_band" || id === "color_block") return SAMPLE.hvac
  return SAMPLE.roofing
}

function paletteFor(id: PostcardTemplateId) {
  if (id === "medicare_calm" || id === "portrait_aside") return "medicare" as const
  if (id === "deadline_coupon") return "plumbing" as const
  if (id === "service_band" || id === "color_block") return "hvac" as const
  return "roofing" as const
}
