import assert from "node:assert/strict"
import { test } from "node:test"

import {
  applyFaithfulness,
  detectPromptConflict,
  detectRemovedRequired,
  finalizeRefinement,
  normalizeGenerationResult,
  stripInventedFacts,
  validateGenerationSet,
} from "./creative-engine-guards"
import { buildGenerateSystemPrompt } from "./prompts/generate"
import { buildRegenerateSystemPrompt } from "./prompts/regenerate"
import {
  DIRECTION_SET_REASONING_RULES,
  SPEC_FIELD_RULES,
} from "./prompts/shared"
import { cloneSpec } from "./spec-diff"
import {
  GENERATED_SPEC_TOOL_REQUIRED,
  type CampaignBrief,
  type CreativeDirection,
  type CreativeSpec,
} from "./types"
import { buildCreativeIntelligenceContext, formatCreativeIntelligenceContext } from "./creative-intelligence"
import type { CreativeCanvas } from "./creative-canvas"

const canvas: CreativeCanvas = {
  catalogId: "postcard_5x8",
  catalogVersion: 1,
  family: "postcard",
  displayName: "5×8 Postcard",
  trimSizeInches: { shortInches: 5, longInches: 8 },
  faces: ["front", "back"],
  addressFace: "back",
  reservedRegionRoles: [
    "delivery_address",
    "return_address",
    "postage_indicia",
    "barcode_clear_zone",
  ],
  fullBleedExpected: true,
}

const appointmentBrief: CampaignBrief = {
  goal: "Book more roof inspections",
  offer: "Free roof inspection",
  phone: "(949) 555-0100",
  website: "summitroofing.com",
  qrDestination: "summitroofing.com/book",
  primarySuccessMetric: { type: "appointment", description: "Inspection bookings" },
}

const phoneCallBrief: CampaignBrief = {
  goal: "Get more service calls",
  offer: "Free estimate",
  phone: "(949) 555-0100",
  website: "harborplumbing.com",
  primarySuccessMetric: { type: "phone_call", description: "Inbound calls" },
}

const qrScanBrief: CampaignBrief = {
  goal: "Drive online bookings",
  offer: "15% off first visit",
  website: "abcair.com",
  qrDestination: "abcair.com/book",
  primarySuccessMetric: { type: "qr_scan", description: "QR scans" },
}

const couponBriefWithContact: CampaignBrief = {
  goal: "Fill more weekend tables",
  offer: "Free garlic knots",
  phone: "(949) 555-0199",
  website: "harborpizza.com",
  primarySuccessMetric: { type: "coupon_redemption", description: "Coupon redemptions" },
}

const briefWithoutContact: CampaignBrief = {
  goal: "Book more roof inspections",
  offer: "Free roof inspection",
  primarySuccessMetric: { type: "appointment", description: "Inspection bookings" },
}

function baseSpec(overrides: Partial<CreativeSpec> = {}): CreativeSpec {
  return {
    layoutVariant: "type_primary_split",
    headline: "Free Inspection Now",
    body: "Licensed local crew ready to inspect.",
    callToAction: "Call to book",
    visualDirection: "Neighborhood photography",
    tone: "Trustworthy",
    palette: ["#1e3a5f", "#4a90a4", "#f5f5f0"],
    imagery: "stock_generic_local",
    offer: "Free roof inspection",
    leadJob: "offer",
    imageryRole: "neighborhood",
    ...overrides,
  }
}

function omitResponse(spec: CreativeSpec): CreativeSpec {
  const next = cloneSpec(spec)
  delete next.callToAction
  delete next.phone
  delete next.website
  delete next.qrDestination
  return next
}

function validDirection(
  index: number,
  overrides: Partial<CreativeDirection> = {}
): CreativeDirection {
  const layouts = ["type_primary_split", "peer_split", "banded_split"] as const
  const jobs = ["offer", "problem", "trust"] as const
  const roles = ["neighborhood", "consequence", "crew"] as const
  const headlines = ["Free Inspection Now", "Hidden Roof Danger", "Trusted Roofing Team"]
  const rationales = [
    "Puts the existing offer first so the next step is obvious.",
    "Leads with the homeowner problem and keeps the offer as the action.",
    "Puts trust before the sale and keeps the offer as the response.",
  ]

  return {
    id: `dir-${index}`,
    name: headlines[index] ?? `Direction ${index + 1}`,
    rationale: rationales[index] ?? `Strategic frame ${index + 1}.`,
    designedToDrive: "Inspection bookings",
    tags: ["Trust", "Local", "Offer"],
    recommended: index === 0,
    oneLineDifference: index === 0 ? undefined : `Different frame ${index}`,
    createdAt: "2026-09-19T00:00:00.000Z",
    spec: baseSpec({
      layoutVariant: layouts[index],
      headline: headlines[index],
      leadJob: jobs[index],
      imageryRole: roles[index],
    }),
    ...overrides,
  }
}

function omittedDirection(index: number): CreativeDirection {
  return validDirection(index, {
    spec: omitResponse(
      baseSpec({
        layoutVariant: (["type_primary_split", "peer_split", "banded_split"] as const)[index],
        headline: ["Free Inspection Now", "Hidden Roof Danger", "Trusted Roofing Team"][index],
        leadJob: (["offer", "problem", "trust"] as const)[index],
        imageryRole: (["neighborhood", "consequence", "crew"] as const)[index],
      })
    ),
  })
}

function responseLedSpec(overrides: Partial<CreativeSpec> = {}): CreativeSpec {
  return baseSpec({
    callToAction: "Call to book",
    phone: "(949) 555-0100",
    website: "summitroofing.com",
    qrDestination: "summitroofing.com/book",
    ...overrides,
  })
}

test("a generated direction may omit CTA, phone, website, and QR when the brief has them", () => {
  const reasons = validateGenerationSet(appointmentBrief, [
    validDirection(0, { spec: responseLedSpec({ headline: "Free Inspection Now" }) }),
    omittedDirection(1),
    omittedDirection(2),
  ])
  assert.deepEqual(reasons, [])

  const result = normalizeGenerationResult(
    appointmentBrief,
    [
      validDirection(0, { spec: responseLedSpec({ headline: "Free Inspection Now" }) }),
      omittedDirection(1),
      omittedDirection(2),
    ],
    { stripInventedFacts: true }
  )

  assert.equal(result.directions[1].spec.callToAction, undefined)
  assert.equal(result.directions[1].spec.phone, undefined)
  assert.equal(result.directions[1].spec.website, undefined)
  assert.equal(result.directions[1].spec.qrDestination, undefined)
  assert.equal(result.directions[2].spec.callToAction, undefined)
  assert.equal(result.directions[2].spec.phone, undefined)
})

test("applyFaithfulness does not copy brief contact onto an omitted direction spec", () => {
  const omitted = omitResponse(baseSpec())
  const faithful = applyFaithfulness(appointmentBrief, omitted)

  assert.equal(faithful.phone, undefined)
  assert.equal(faithful.website, undefined)
  assert.equal(faithful.qrDestination, undefined)
  assert.equal(faithful.callToAction, undefined)
  assert.equal(faithful.offer, "Free roof inspection")
})

test("set-level validation fails when no direction keeps a required phone path", () => {
  const reasons = validateGenerationSet(phoneCallBrief, [
    omittedDirection(0),
    omittedDirection(1),
    omittedDirection(2),
  ])
  assert.equal(
    reasons.some((reason) => reason.includes("at least one direction to include the brief phone")),
    true
  )
})

test("set-level validation fails when no direction keeps a required QR path", () => {
  const reasons = validateGenerationSet(qrScanBrief, [
    omittedDirection(0),
    omittedDirection(1),
    omittedDirection(2),
  ])
  assert.equal(
    reasons.some((reason) =>
      reason.includes("at least one direction to include the brief QR destination")
    ),
    true
  )
})

test("set-level phone coverage does not require every direction to include phone", () => {
  const reasons = validateGenerationSet(phoneCallBrief, [
    validDirection(0, {
      spec: responseLedSpec({
        headline: "Free Inspection Now",
        phone: "(949) 555-0100",
        website: undefined,
        qrDestination: undefined,
      }),
    }),
    omittedDirection(1),
    omittedDirection(2),
  ])
  assert.deepEqual(reasons, [])
})

test("coupon campaigns may omit phone on every direction even when the brief has a phone", () => {
  const reasons = validateGenerationSet(couponBriefWithContact, [
    omittedDirection(0),
    omittedDirection(1),
    omittedDirection(2),
  ])
  assert.deepEqual(reasons, [])
})

test("a response-led direction with CTA, phone, website, and QR still validates", () => {
  const reasons = validateGenerationSet(appointmentBrief, [
    validDirection(0, { spec: responseLedSpec({ headline: "Free Inspection Now" }) }),
    validDirection(1, {
      spec: responseLedSpec({
        layoutVariant: "peer_split",
        headline: "Hidden Roof Danger",
        leadJob: "problem",
        imageryRole: "consequence",
      }),
    }),
    validDirection(2, {
      spec: responseLedSpec({
        layoutVariant: "banded_split",
        headline: "Trusted Roofing Team",
        leadJob: "trust",
        imageryRole: "crew",
      }),
    }),
  ])
  assert.deepEqual(reasons, [])

  const result = normalizeGenerationResult(
    appointmentBrief,
    [
      validDirection(0, { spec: responseLedSpec({ headline: "Free Inspection Now" }) }),
      validDirection(1, {
        spec: responseLedSpec({
          layoutVariant: "peer_split",
          headline: "Hidden Roof Danger",
          leadJob: "problem",
          imageryRole: "consequence",
        }),
      }),
      validDirection(2, {
        spec: responseLedSpec({
          layoutVariant: "banded_split",
          headline: "Trusted Roofing Team",
          leadJob: "trust",
          imageryRole: "crew",
        }),
      }),
    ],
    { stripInventedFacts: true }
  )

  for (const direction of result.directions) {
    assert.equal(direction.spec.callToAction, "Call to book")
    assert.equal(direction.spec.phone, "(949) 555-0100")
    assert.equal(direction.spec.website, "summitroofing.com")
    assert.equal(direction.spec.qrDestination, "summitroofing.com/book")
  }
})

test("stripInventedFacts still removes contact the brief never provided", () => {
  const invented = baseSpec({
    phone: "(000) 000-0000",
    website: "invented.example",
    qrDestination: "invented.example/book",
  })
  const stripped = stripInventedFacts(briefWithoutContact, invented)

  assert.equal(stripped.phone, undefined)
  assert.equal(stripped.website, undefined)
  assert.equal(stripped.qrDestination, undefined)
  assert.equal(stripped.offer, "Free roof inspection")
  assert.equal(stripped.callToAction, "Call to book")

  const result = normalizeGenerationResult(
    briefWithoutContact,
    [
      validDirection(0, { spec: invented }),
      validDirection(1),
      validDirection(2),
    ],
    { stripInventedFacts: true }
  )
  assert.equal(result.directions[0].spec.phone, undefined)
  assert.equal(result.directions[0].spec.website, undefined)
  assert.equal(result.directions[0].spec.qrDestination, undefined)
})

test("historical CreativeSpec snapshots with response fields remain unchanged", () => {
  const legacy: CreativeSpec = {
    layoutVariant: "peer_split",
    headline: "Trusted Local Expert",
    body: "Licensed and insured.",
    callToAction: "Call today",
    phone: "(949) 555-0100",
    website: "summitroofing.com",
    qrDestination: "summitroofing.com/book",
    visualDirection: "Neighborhood photography",
    tone: "Trustworthy",
    palette: ["#1e3a5f", "#4a90a4", "#f5f5f0"],
    imagery: "stock_hvac",
    offer: "Free roof inspection",
  }

  const loaded = cloneSpec(legacy)
  const faithful = applyFaithfulness(appointmentBrief, loaded)

  assert.equal(loaded.callToAction, "Call today")
  assert.equal(loaded.phone, "(949) 555-0100")
  assert.equal(loaded.website, "summitroofing.com")
  assert.equal(loaded.qrDestination, "summitroofing.com/book")
  assert.equal(faithful.callToAction, "Call today")
  assert.equal(faithful.phone, "(949) 555-0100")
  assert.equal(faithful.website, "summitroofing.com")
  assert.equal(faithful.qrDestination, "summitroofing.com/book")
  assert.equal(faithful.leadJob, undefined)
  assert.equal(faithful.format, undefined)
})

test("refine still blocks removing a metric-tied phone or QR path from a spec that has it", () => {
  const current = responseLedSpec()

  assert.equal(detectPromptConflict(appointmentBrief, "Please remove the phone number"), "phone")
  assert.equal(detectPromptConflict(appointmentBrief, "Hide the QR code"), "qr")
  assert.equal(detectRemovedRequired(appointmentBrief, current, omitResponse(current)), "qr")
  assert.equal(
    detectRemovedRequired(
      phoneCallBrief,
      current,
      { ...current, phone: undefined }
    ),
    "phone"
  )

  const phoneConflict = finalizeRefinement({
    brief: appointmentBrief,
    directionId: "dir-1",
    currentSpec: current,
    prompt: "Remove the phone number",
    proposed: {
      outcome: "success",
      spec: { ...current, phone: undefined },
    },
  })
  assert.equal(phoneConflict.conflict != null, true)
  assert.equal(phoneConflict.spec.phone, "(949) 555-0100")

  const qrConflict = finalizeRefinement({
    brief: appointmentBrief,
    directionId: "dir-1",
    currentSpec: current,
    prompt: "Make the headline larger",
    proposed: {
      outcome: "success",
      spec: omitResponse(current),
    },
  })
  assert.equal(qrConflict.conflict != null, true)
  assert.equal(qrConflict.spec.qrDestination, "summitroofing.com/book")
  assert.equal(qrConflict.spec.callToAction, "Call to book")
})

test("generation prompts treat contact inclusion as a direction-level Engine decision", () => {
  const generate = buildGenerateSystemPrompt(canvas, { principles: [] })
  const regenerate = buildRegenerateSystemPrompt(canvas, { principles: [] })
  const intelligence = formatCreativeIntelligenceContext(
    buildCreativeIntelligenceContext(appointmentBrief)
  )

  for (const text of [SPEC_FIELD_RULES, generate, regenerate]) {
    assert.match(text, /use campaign contact values exactly when this direction uses them/)
    assert.match(text, /Omit them when this direction intentionally keeps them off this face/)
    assert.match(text, /Never invent or paraphrase campaign contact facts/)
    assert.match(text, /The Engine decides direction-level inclusion/)
    assert.match(text, /callToAction: optional/)
    assert.doesNotMatch(
      text,
      /Include offer, phone, website, and qrDestination only when those values appear on the brief/
    )
  }

  for (const text of [DIRECTION_SET_REASONING_RULES, generate, regenerate]) {
    assert.match(
      text,
      /Creative Intelligence does not choose which direction includes or omits contact/
    )
    assert.match(text, /at least one direction must include that phone/)
    assert.match(text, /at least one direction must include that destination/)
  }

  assert.equal(GENERATED_SPEC_TOOL_REQUIRED.includes("callToAction"), false)
  assert.doesNotMatch(intelligence, /includes or omits contact/)
  assert.doesNotMatch(intelligence, /at least one direction must include that phone/)
})
