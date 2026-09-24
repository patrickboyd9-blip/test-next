import assert from "node:assert/strict"
import { test } from "node:test"

import {
  applyFaithfulness,
  finalizeRefinement,
  isImagePresence,
  isImageryRole,
  isLeadJob,
  isTypeRole,
  normalizeGenerationResult,
  validateGenerationSet,
} from "./creative-engine-guards"
import { getMockCreativeDirections } from "./mock-creative-data"
import {
  buildCreativeIntelligenceContext,
  formatCreativeIntelligenceContext,
} from "./creative-intelligence"
import { buildGenerateSystemPrompt } from "./prompts/generate"
import { buildRegenerateSystemPrompt, buildRegenerateUserMessage } from "./prompts/regenerate"
import { buildRefineSystemPrompt } from "./prompts/refine"
import {
  CONCEPTION_BEFORE_SPEC_RULES,
  DIRECTION_SET_REASONING_RULES,
  SPEC_FIELD_RULES,
} from "./prompts/shared"
import { normalizeCampaign } from "./repository"
import { cloneSpec } from "./spec-diff"
import {
  GENERATED_SPEC_TOOL_REQUIRED,
  IMAGE_PRESENCES,
  IMAGERY_ROLES,
  LAYOUT_VARIANTS,
  LEAD_JOBS,
  TYPE_ROLES,
  createEmptyCampaignCreative,
  normalizeLayoutVariant,
  type Campaign,
  type CampaignBrief,
  type CreativeDirection,
  type CreativeSpec,
  type ImagePresence,
  type ImageryRole,
  type LeadJob,
  type TypeRole,
} from "./types"
import type { CreativeCanvas } from "./creative-canvas"

const brief: CampaignBrief = {
  goal: "Book more roof inspections",
  offer: "Free roof inspection",
  primarySuccessMetric: { type: "appointment", description: "Inspection bookings" },
}

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

test("leadJob accepts all four valid values", () => {
  for (const leadJob of LEAD_JOBS) {
    assert.equal(isLeadJob(leadJob), true, leadJob)
    const reasons = validateGenerationSet(brief, [
      validDirection(0, { spec: baseSpec({ leadJob }) }),
      validDirection(1),
      validDirection(2),
    ])
    assert.deepEqual(reasons, [], leadJob)
  }
})

test("imageryRole accepts all five valid values", () => {
  for (const imageryRole of IMAGERY_ROLES) {
    assert.equal(isImageryRole(imageryRole), true, imageryRole)
    const reasons = validateGenerationSet(brief, [
      validDirection(0, { spec: baseSpec({ imageryRole }) }),
      validDirection(1),
      validDirection(2),
    ])
    assert.deepEqual(reasons, [], imageryRole)
  }
})

test("invalid leadJob and imageryRole values are rejected", () => {
  const badJobs = ["gateway", "clincher", "https://cdn.example.com/x.jpg", "bleed"]
  const badRoles = ["stock_hvac", "https://cdn.example.com/leak.jpg", "0.125in", "crop-center"]

  for (const leadJob of badJobs) {
    assert.equal(isLeadJob(leadJob), false, leadJob)
    const reasons = validateGenerationSet(brief, [
      validDirection(0, {
        spec: { ...baseSpec(), leadJob: leadJob as LeadJob },
      }),
      validDirection(1),
      validDirection(2),
    ])
    assert.equal(
      reasons.some((reason) => reason.includes("valid leadJob")),
      true,
      leadJob
    )
  }

  for (const imageryRole of badRoles) {
    assert.equal(isImageryRole(imageryRole), false, imageryRole)
    const reasons = validateGenerationSet(brief, [
      validDirection(0, {
        spec: { ...baseSpec(), imageryRole: imageryRole as ImageryRole },
      }),
      validDirection(1),
      validDirection(2),
    ])
    assert.equal(
      reasons.some((reason) => reason.includes("valid imageryRole")),
      true,
      imageryRole
    )
  }
})

test("generated CreativeSpec validation requires the new fields", () => {
  const missingJob = validateGenerationSet(brief, [
    validDirection(0, { spec: { ...baseSpec(), leadJob: undefined } }),
    validDirection(1),
    validDirection(2),
  ])
  const missingRole = validateGenerationSet(brief, [
    validDirection(0, { spec: { ...baseSpec(), imageryRole: undefined } }),
    validDirection(1),
    validDirection(2),
  ])

  assert.equal(missingJob.some((reason) => reason.includes("leadJob")), true)
  assert.equal(missingRole.some((reason) => reason.includes("imageryRole")), true)

  const result = normalizeGenerationResult(
    brief,
    [validDirection(0), validDirection(1), validDirection(2)],
    { stripInventedFacts: true }
  )
  assert.equal(result.directions.length, 3)
  for (const direction of result.directions) {
    assert.equal(isLeadJob(direction.spec.leadJob), true)
    assert.equal(isImageryRole(direction.spec.imageryRole), true)
  }
})

test("existing persisted CreativeSpec without the new fields remains loadable", () => {
  const legacy: CreativeSpec = {
    layoutVariant: "peer_split",
    headline: "Trusted Local Expert",
    body: "Licensed and insured.",
    callToAction: "Call today",
    visualDirection: "Neighborhood photography",
    tone: "Trustworthy",
    palette: ["#1e3a5f", "#4a90a4", "#f5f5f0"],
    imagery: "stock_hvac",
    offer: "Free roof inspection",
  }

  const loaded = cloneSpec(legacy)
  const faithful = applyFaithfulness(brief, loaded)

  assert.equal(loaded.leadJob, undefined)
  assert.equal(loaded.imageryRole, undefined)
  assert.equal(faithful.leadJob, undefined)
  assert.equal(faithful.imageryRole, undefined)
  assert.equal(faithful.offer, "Free roof inspection")
  assert.equal(faithful.format, undefined)
  assert.equal(faithful.backLayout, undefined)
})

test("refine preserves leadJob and imageryRole unless the concept changes", () => {
  const current = baseSpec({ leadJob: "trust", imageryRole: "crew" })

  const preserved = finalizeRefinement({
    brief,
    directionId: "dir-1",
    currentSpec: current,
    prompt: "Make the headline larger",
    proposed: {
      outcome: "success",
      spec: { ...current, leadJob: undefined, imageryRole: undefined, headline: "Trusted Crew" },
    },
  })

  assert.equal(preserved.spec.leadJob, "trust")
  assert.equal(preserved.spec.imageryRole, "crew")
  assert.equal(preserved.spec.headline, "Trusted Crew")

  const changed = finalizeRefinement({
    brief,
    directionId: "dir-1",
    currentSpec: current,
    prompt: "Lead with the roof problem instead",
    proposed: {
      outcome: "success",
      spec: { ...current, leadJob: "problem", imageryRole: "consequence" },
    },
  })

  assert.equal(changed.spec.leadJob, "problem")
  assert.equal(changed.spec.imageryRole, "consequence")
})

test("regenerate handles the fields as structured creative decisions", () => {
  const previous = [validDirection(0), validDirection(1), validDirection(2)]
  const result = normalizeGenerationResult(brief, previous, { stripInventedFacts: true })
  const user = buildRegenerateUserMessage({
    brief,
    canvas,
    feedback: "Try a clearer problem-led concept",
    previousDirections: result.directions,
  })
  const system = buildRegenerateSystemPrompt(
    canvas,
    { principles: [] }
  )

  assert.match(user, /"leadJob"/)
  assert.match(user, /"imageryRole"/)
  assert.match(system, /leadJob/)
  assert.match(system, /imageryRole/)
  for (const direction of result.directions) {
    assert.equal(isLeadJob(direction.spec.leadJob), true)
    assert.equal(isImageryRole(direction.spec.imageryRole), true)
  }
})

test("generate and regenerate share set-level direction-spending guidance; refine and CI do not", () => {
  const generate = buildGenerateSystemPrompt(canvas, { principles: [] })
  const regenerate = buildRegenerateSystemPrompt(canvas, { principles: [] })
  const refine = buildRefineSystemPrompt(canvas, { principles: [] })
  const intelligence = formatCreativeIntelligenceContext(
    buildCreativeIntelligenceContext(brief)
  )

  for (const text of [DIRECTION_SET_REASONING_RULES, generate, regenerate]) {
    assert.match(text, /The three directions are one set/)
    assert.match(text, /spend those readings across the set/)
    assert.match(text, /A campaign may support only two legitimate readings/)
    assert.match(text, /Do not invent a third reading/)
    assert.match(text, /Do not pre-assign Direction A, B, or C/)
    assert.match(text, /Different headlines, palettes, or wording are not enough/)
  }

  assert.equal(generate.includes(DIRECTION_SET_REASONING_RULES), true)
  assert.equal(regenerate.includes(DIRECTION_SET_REASONING_RULES), true)
  assert.equal(refine.includes(DIRECTION_SET_REASONING_RULES), false)
  assert.equal(intelligence.includes(DIRECTION_SET_REASONING_RULES), false)

  assert.doesNotMatch(refine, /The three directions are one set/)
  assert.doesNotMatch(refine, /Do not pre-assign Direction A, B, or C/)
  assert.doesNotMatch(intelligence, /The three directions are one set/)
  assert.doesNotMatch(intelligence, /Do not pre-assign Direction A, B, or C/)
  assert.doesNotMatch(intelligence, /spend those readings across the set/)
  assert.doesNotMatch(
    intelligence,
    /Different headlines, palettes, or wording are not enough/
  )

  assert.match(generate, /Exactly 3 directions/)
  assert.match(generate, /Exactly one recommended/)
  assert.match(generate, /At least 2 distinct layoutVariant values/)
  assert.match(generate, /genuinely different messaging angles/)
  assert.match(generate, /leadJob/)
  assert.match(generate, /imageryRole/)
  assert.match(generate, /Primary Success Metric/)
  assert.match(generate, /oneLineDifference/)
  assert.match(regenerate, /Regeneration constraints \(same as generation\)/)
  assert.match(regenerate, /Exactly 3 directions, exactly one recommended/)
  assert.match(regenerate, /At least 2 distinct layoutVariant values/)
  assert.match(regenerate, /New messaging angles/)
  assert.match(regenerate, /leadJob/)
  assert.match(regenerate, /imageryRole/)
})

test("generate and regenerate require conception before CreativeSpec; refine and CI do not", () => {
  const generate = buildGenerateSystemPrompt(canvas, { principles: [] })
  const regenerate = buildRegenerateSystemPrompt(canvas, { principles: [] })
  const refine = buildRefineSystemPrompt(canvas, { principles: [] })
  const intelligence = formatCreativeIntelligenceContext(
    buildCreativeIntelligenceContext(brief)
  )

  for (const text of [CONCEPTION_BEFORE_SPEC_RULES, generate, regenerate]) {
    assert.match(text, /complete communication idea before choosing CreativeSpec/)
    assert.match(text, /CreativeSpec is downstream of the creative concept/)
    assert.match(
      text,
      /name, rationale, oneLineDifference, and visualDirection articulate that concept/
    )
    assert.match(text, /Do not select from a fixed concept taxonomy/)
    assert.match(text, /do not invent a third/)
    assert.match(text, /does not conceive a direction/)
  }

  assert.equal(generate.includes(CONCEPTION_BEFORE_SPEC_RULES), true)
  assert.equal(regenerate.includes(CONCEPTION_BEFORE_SPEC_RULES), true)
  assert.equal(refine.includes(CONCEPTION_BEFORE_SPEC_RULES), false)
  assert.equal(intelligence.includes(CONCEPTION_BEFORE_SPEC_RULES), false)
  assert.equal(generate.includes(DIRECTION_SET_REASONING_RULES), true)
  assert.equal(regenerate.includes(DIRECTION_SET_REASONING_RULES), true)

  assert.doesNotMatch(refine, /CreativeSpec is downstream of the creative concept/)
  assert.doesNotMatch(refine, /Do not select from a fixed concept taxonomy/)
  assert.doesNotMatch(intelligence, /CreativeSpec is downstream of the creative concept/)
  assert.doesNotMatch(intelligence, /Do not select from a fixed concept taxonomy/)
  assert.doesNotMatch(
    intelligence,
    /name, rationale, oneLineDifference, and visualDirection articulate/
  )

  assert.match(generate, /Exactly 3 directions/)
  assert.match(generate, /Exactly one recommended/)
  assert.match(generate, /At least 2 distinct layoutVariant values/)
  assert.match(generate, /genuinely different messaging angles/)
  assert.match(generate, /leadJob/)
  assert.match(generate, /imageryRole/)
  assert.match(generate, /oneLineDifference/)
  assert.match(regenerate, /Regeneration constraints \(same as generation\)/)
  assert.match(regenerate, /Exactly 3 directions, exactly one recommended/)
  assert.match(regenerate, /At least 2 distinct layoutVariant values/)
})

test("prompts require a conceived photograph in visualDirection, not an imagery label", () => {
  const generate = buildGenerateSystemPrompt(canvas, { principles: [] })
  const regenerate = buildRegenerateSystemPrompt(canvas, { principles: [] })
  const refine = buildRefineSystemPrompt(canvas, { principles: [] })
  const intelligence = formatCreativeIntelligenceContext(
    buildCreativeIntelligenceContext(brief)
  )

  for (const text of [SPEC_FIELD_RULES, generate, regenerate, refine]) {
    assert.doesNotMatch(text, /one sentence describing the imagery approach/)
    assert.match(text, /conceived photograph/)
    assert.match(text, /Not a category label/)
    assert.match(text, /no photograph and why/)
    assert.match(text, /interchangeable stock treated as proof/)
    assert.doesNotMatch(text, /ImageBrief/)
    assert.doesNotMatch(text, /MMR-\d+/)
    assert.doesNotMatch(text, /\bP1\b/)
  }

  for (const text of [CONCEPTION_BEFORE_SPEC_RULES, generate, regenerate]) {
    assert.match(text, /conceive that photograph as part of the communication idea/)
    assert.match(text, /decline photography/)
    assert.match(text, /does not choose the photograph/)
    assert.match(text, /Do not require photography/)
    assert.match(text, /not inventing an asset or a campaign fact/)
    assert.match(text, /image model executes that conception/)
    assert.match(text, /does not choose the subject/)
    assert.doesNotMatch(text, /imagery claims/)
    assert.doesNotMatch(text, /customer assets/)
  }

  assert.doesNotMatch(refine, /conceive that photograph as part of the communication idea/)
  assert.doesNotMatch(intelligence, /conceive that photograph/)
  assert.doesNotMatch(intelligence, /Not a category label/)
  assert.doesNotMatch(intelligence, /ImageBrief/)
})

test("illustrative category situation is allowed; invented campaign evidence is not", () => {
  const generate = buildGenerateSystemPrompt(canvas, { principles: [] })
  const regenerate = buildRegenerateSystemPrompt(canvas, { principles: [] })
  const refine = buildRefineSystemPrompt(canvas, { principles: [] })
  const intelligence = formatCreativeIntelligenceContext(
    buildCreativeIntelligenceContext(brief)
  )

  for (const text of [SPEC_FIELD_RULES, generate, regenerate, refine]) {
    assert.doesNotMatch(text, /Do not invent photographs\./)
    assert.match(text, /Do not invent an asset, path, or source file/)
    assert.match(text, /does not prohibit a conceived illustrative scene/)
    assert.match(text, /no usable source image exists/)
    assert.match(text, /original illustrative situation/)
    assert.match(text, /description-only BrandAsset is not a photograph/)
    assert.match(text, /not as this recipient's or this customer's documented condition/)
    assert.match(text, /damage-as-fact/)
    assert.match(text, /cheap fear or gore escalation/)
    assert.match(text, /Do not write a model prompt or provider instruction/)
  }

  assert.match(intelligence, /illustrative category situation/)
  assert.match(intelligence, /illustrative image is not evidence/)
  assert.match(intelligence, /Name that role only/)
  assert.doesNotMatch(intelligence, /images the brief does not contain/)
  assert.doesNotMatch(intelligence, /do not invent a photograph/)
  assert.doesNotMatch(intelligence, /description-only BrandAsset/)
  assert.doesNotMatch(intelligence, /no usable source image exists/)
  assert.doesNotMatch(intelligence, /image model executes/)
})

test("shared leadJob and imageryRole remain valid when layouts and copy differ", () => {
  const reasons = validateGenerationSet(brief, [
    validDirection(0, {
      spec: baseSpec({
        headline: "Free Inspection Now",
        leadJob: "offer",
        imageryRole: "neighborhood",
        layoutVariant: "type_primary_split",
      }),
    }),
    validDirection(1, {
      spec: baseSpec({
        headline: "Hidden Roof Danger",
        leadJob: "offer",
        imageryRole: "neighborhood",
        layoutVariant: "banded_split",
      }),
    }),
    validDirection(2, {
      spec: baseSpec({
        headline: "Trusted Roofing Team",
        leadJob: "offer",
        imageryRole: "neighborhood",
        layoutVariant: "type_primary_split",
      }),
    }),
  ])
  assert.deepEqual(reasons, [])
})

test("prompt and tool schema expose leadJob and imageryRole as closed enums", () => {
  const generate = buildGenerateSystemPrompt(canvas, { principles: [] })
  const refine = buildRefineSystemPrompt(canvas, { principles: [] })

  for (const text of [SPEC_FIELD_RULES, generate, refine]) {
    assert.match(text, /leadJob/)
    assert.match(text, /imageryRole/)
    for (const value of LEAD_JOBS) assert.match(text, new RegExp(`\\b${value}\\b`))
    for (const value of IMAGERY_ROLES) assert.match(text, new RegExp(`\\b${value}\\b`))
    assert.match(text, /not a file, URL, crop/)
    assert.doesNotMatch(text, /https?:\/\//)
    assert.doesNotMatch(text, /bleed inches/)
  }

  assert.equal(GENERATED_SPEC_TOOL_REQUIRED.includes("leadJob"), true)
  assert.equal(GENERATED_SPEC_TOOL_REQUIRED.includes("imageryRole"), true)
  assert.deepEqual([...LEAD_JOBS], ["offer", "problem", "trust", "urgency"])
  assert.deepEqual([...IMAGERY_ROLES], [
    "consequence",
    "neighborhood",
    "crew",
    "logo",
    "none",
  ])
})

test("layoutVariant contract names structure jobs, not leads or templates", () => {
  assert.deepEqual([...LAYOUT_VARIANTS], [
    "type_primary_split",
    "peer_split",
    "banded_split",
    "image_grounded",
    "type_only",
  ])

  for (const text of [
    SPEC_FIELD_RULES,
    buildGenerateSystemPrompt(canvas, { principles: [] }),
    buildRefineSystemPrompt(canvas, { principles: [] }),
  ]) {
    for (const value of LAYOUT_VARIANTS) assert.match(text, new RegExp(`\\b${value}\\b`))
    assert.match(text, /Type\/message is the dominant compositional field/)
    assert.match(text, /Type and image occupy peer compositional fields/)
    assert.match(text, /distinct message band/)
    assert.match(text, /Image occupies the compositional ground/)
    assert.match(text, /No image field/)
    assert.doesNotMatch(text, /offer_hero/)
    assert.doesNotMatch(text, /trust_first/)
    assert.doesNotMatch(text, /urgency_banner/)
    assert.doesNotMatch(text, /photo_led/)
    assert.doesNotMatch(text, /minimal_cta/)
  }
})

test("legacy layoutVariant tokens normalize to structure jobs", () => {
  assert.equal(normalizeLayoutVariant("offer_hero"), "type_primary_split")
  assert.equal(normalizeLayoutVariant("trust_first"), "peer_split")
  assert.equal(normalizeLayoutVariant("urgency_banner"), "banded_split")
  assert.equal(normalizeLayoutVariant("photo_led"), "image_grounded")
  assert.equal(normalizeLayoutVariant("minimal_cta"), "type_only")
  assert.equal(normalizeLayoutVariant("peer_split"), "peer_split")
  assert.equal(normalizeLayoutVariant("unknown_layout"), undefined)
})

test("loading a campaign does not rewrite historical layoutVariant tokens", () => {
  const persisted = JSON.parse(
    JSON.stringify({
      id: "campaign-legacy-layout",
      ownerId: "owner@example.com",
      status: "creative_approved",
      brief: { offer: "Free roof inspection" },
      creative: {
        ...createEmptyCampaignCreative(),
        selectedDirectionId: "dir-lead",
        activeSpec: baseSpec({ layoutVariant: "urgency_banner" as never }),
        activeRevisionId: "rev-1",
        approvedRevisionId: "rev-1",
        approvedSpec: baseSpec({ layoutVariant: "minimal_cta" as never }),
        directions: [
          {
            id: "dir-lead",
            name: "Offer First",
            rationale: "Leads with the offer.",
            designedToDrive: "Inspection bookings",
            tags: ["offer-led"],
            spec: baseSpec({ layoutVariant: "trust_first" as never }),
            recommended: true,
            createdAt: "2026-09-19T20:01:00.000Z",
          },
        ],
        revisions: [
          {
            id: "rev-1",
            directionId: "dir-lead",
            version: 1,
            spec: baseSpec({ layoutVariant: "photo_led" as never }),
            customerPrompt: "Original concept",
            studioResponse: "",
            type: "refinement",
            createdAt: "2026-09-19T20:01:00.000Z",
          },
        ],
      },
      transcript: [],
      mailPiece: {
        id: "mail-piece-1",
        version: 1,
        approvedAt: "2026-09-19T21:00:00.000Z",
        directionId: "dir-lead",
        revisionId: "rev-1",
        catalogId: "postcard_5x8",
        catalogVersion: 1,
        spec: baseSpec({ layoutVariant: "offer_hero" as never }),
      },
      mailPieceVersions: [
        {
          id: "mail-piece-1",
          version: 1,
          approvedAt: "2026-09-19T21:00:00.000Z",
          directionId: "dir-lead",
          revisionId: "rev-1",
          catalogId: "postcard_5x8",
          catalogVersion: 1,
          spec: baseSpec({ layoutVariant: "offer_hero" as never }),
        },
      ],
      readyForBriefReview: true,
      createdAt: "2026-09-19T19:00:00.000Z",
      updatedAt: "2026-09-19T21:00:00.000Z",
    })
  ) as Campaign

  const loaded = normalizeCampaign(persisted)

  assert.equal(loaded.mailPiece?.spec.layoutVariant, "offer_hero")
  assert.equal(loaded.mailPieceVersions?.[0].spec.layoutVariant, "offer_hero")
  assert.equal(loaded.creative.directions[0].spec.layoutVariant, "trust_first")
  assert.equal(loaded.creative.revisions[0].spec.layoutVariant, "photo_led")
  assert.equal(loaded.creative.activeSpec?.layoutVariant, "urgency_banner")
  assert.equal(loaded.creative.approvedSpec?.layoutVariant, "minimal_cta")

  assert.equal(
    normalizeLayoutVariant(loaded.mailPiece?.spec.layoutVariant),
    "type_primary_split"
  )
  assert.equal(
    normalizeLayoutVariant(loaded.creative.directions[0].spec.layoutVariant),
    "peer_split"
  )
  assert.equal(
    normalizeLayoutVariant(loaded.creative.revisions[0].spec.layoutVariant),
    "image_grounded"
  )
  assert.equal(
    normalizeLayoutVariant(loaded.creative.activeSpec?.layoutVariant),
    "banded_split"
  )
  assert.equal(
    normalizeLayoutVariant(loaded.creative.approvedSpec?.layoutVariant),
    "type_only"
  )
})

test("the new fields cannot introduce geometry or asset URLs", () => {
  const withLeak = {
    ...baseSpec(),
    imageryRole: "https://cdn.example.com/leak.jpg" as ImageryRole,
    leadJob: "/assets/roof.png" as LeadJob,
    format: "postcard_4x6" as const,
    backLayout: "standard_address" as const,
  }

  const faithful = applyFaithfulness(brief, withLeak)
  assert.equal(faithful.format, undefined)
  assert.equal(faithful.backLayout, undefined)

  const reasons = validateGenerationSet(brief, [
    validDirection(0, { spec: withLeak }),
    validDirection(1),
    validDirection(2),
  ])
  assert.equal(reasons.some((reason) => reason.includes("leadJob")), true)
  assert.equal(reasons.some((reason) => reason.includes("imageryRole")), true)
})

test("mock generation still produces valid leadJob and imageryRole", () => {
  const result = normalizeGenerationResult(brief, getMockCreativeDirections(brief), {
    stripInventedFacts: false,
  })
  assert.equal(result.directions.length, 3)
  for (const direction of result.directions) {
    assert.equal(isLeadJob(direction.spec.leadJob), true)
    assert.equal(isImageryRole(direction.spec.imageryRole), true)
  }
})

test("typeRole and imagePresence accept closed enums and omission", () => {
  for (const typeRole of TYPE_ROLES) {
    assert.equal(isTypeRole(typeRole), true, typeRole)
  }
  for (const imagePresence of IMAGE_PRESENCES) {
    assert.equal(isImagePresence(imagePresence), true, imagePresence)
  }
  assert.equal(isTypeRole(undefined), false)
  assert.equal(isImagePresence(undefined), false)
  assert.equal(isTypeRole("object"), false)
  assert.equal(isImagePresence("witness"), false)

  const omitted = validateGenerationSet(brief, [
    validDirection(0),
    validDirection(1),
    validDirection(2),
  ])
  assert.deepEqual(omitted, [])

  const explicit = validateGenerationSet(brief, [
    validDirection(0, {
      spec: baseSpec({ typeRole: "copy", imagePresence: "field" }),
    }),
    validDirection(1),
    validDirection(2),
  ])
  assert.deepEqual(explicit, [])
})

test("invalid typeRole and imagePresence values are stripped on normalize", () => {
  const result = normalizeGenerationResult(
    brief,
    [
      validDirection(0, {
        spec: {
          ...baseSpec(),
          typeRole: "hero" as TypeRole,
          imagePresence: "witness" as ImagePresence,
        },
      }),
      validDirection(1),
      validDirection(2),
    ],
    { stripInventedFacts: true }
  )

  assert.equal(result.directions[0].spec.typeRole, undefined)
  assert.equal(result.directions[0].spec.imagePresence, undefined)
  assert.equal(result.directions[0].spec.leadJob, "offer")
})

test("semantically invalid typeRole and imagePresence combinations fail generation", () => {
  const invalid: Array<Partial<CreativeSpec>> = [
    { layoutVariant: "type_only", imagePresence: "field", imageryRole: "none" },
    { layoutVariant: "type_only", imagePresence: "accent", imageryRole: "none" },
    { layoutVariant: "image_grounded", imagePresence: "accent" },
    { layoutVariant: "peer_split", imagePresence: "accent" },
    { layoutVariant: "image_grounded", typeRole: "subject" },
  ]

  for (const spec of invalid) {
    const reasons = validateGenerationSet(brief, [
      validDirection(0, { spec: baseSpec(spec) }),
      validDirection(1),
      validDirection(2),
    ])
    assert.equal(reasons.length > 0, true, JSON.stringify(spec))
  }
})

test("legally unimplemented typeRole and imagePresence combinations remain valid", () => {
  const legal: Array<Partial<CreativeSpec>> = [
    { typeRole: "subject", leadJob: "offer" },
    { typeRole: "subject", leadJob: "urgency" },
    { typeRole: "subject", imageryRole: "neighborhood" },
    { layoutVariant: "banded_split", imagePresence: "accent" },
    {
      layoutVariant: "type_primary_split",
      typeRole: "subject",
      imagePresence: "accent",
    },
    { layoutVariant: "peer_split", typeRole: "subject" },
    { layoutVariant: "banded_split", typeRole: "subject" },
  ]

  for (const spec of legal) {
    const reasons = validateGenerationSet(brief, [
      validDirection(0, { spec: baseSpec(spec) }),
      validDirection(1),
      validDirection(2),
    ])
    assert.deepEqual(reasons, [], JSON.stringify(spec))
  }
})

test("typeRole and imagePresence are not set-level uniqueness requirements", () => {
  const reasons = validateGenerationSet(brief, [
    validDirection(0, {
      spec: baseSpec({
        headline: "Free Inspection Now",
        typeRole: "copy",
        imagePresence: "field",
        layoutVariant: "type_primary_split",
      }),
    }),
    validDirection(1, {
      spec: baseSpec({
        headline: "Hidden Roof Danger",
        typeRole: "copy",
        imagePresence: "field",
        layoutVariant: "banded_split",
      }),
    }),
    validDirection(2, {
      spec: baseSpec({
        headline: "Trusted Roofing Team",
        layoutVariant: "peer_split",
      }),
    }),
  ])
  assert.deepEqual(reasons, [])
})

test("historical CreativeSpec without typeRole and imagePresence remains loadable", () => {
  const legacy: CreativeSpec = {
    layoutVariant: "peer_split",
    headline: "Trusted Local Expert",
    body: "Licensed and insured.",
    callToAction: "Call today",
    visualDirection: "Neighborhood photography",
    tone: "Trustworthy",
    palette: ["#1e3a5f", "#4a90a4", "#f5f5f0"],
    imagery: "stock_hvac",
    offer: "Free roof inspection",
  }

  const loaded = cloneSpec(legacy)
  const faithful = applyFaithfulness(brief, loaded)

  assert.equal(loaded.typeRole, undefined)
  assert.equal(loaded.imagePresence, undefined)
  assert.equal(faithful.typeRole, undefined)
  assert.equal(faithful.imagePresence, undefined)
  assert.equal(faithful.leadJob, undefined)
  assert.equal(faithful.imageryRole, undefined)
})

test("refine preserves typeRole and imagePresence unless the concept changes", () => {
  const current = baseSpec({ typeRole: "subject", imagePresence: "accent" })

  const preserved = finalizeRefinement({
    brief,
    directionId: "dir-1",
    currentSpec: current,
    prompt: "Make the headline larger",
    proposed: {
      outcome: "success",
      spec: {
        ...current,
        typeRole: undefined,
        imagePresence: undefined,
        headline: "Trusted Crew",
      },
    },
  })

  assert.equal(preserved.spec.typeRole, "subject")
  assert.equal(preserved.spec.imagePresence, "accent")
  assert.equal(preserved.spec.headline, "Trusted Crew")

  const changed = finalizeRefinement({
    brief,
    directionId: "dir-1",
    currentSpec: current,
    prompt: "Make the photograph occupy the supporting field",
    proposed: {
      outcome: "success",
      spec: { ...current, typeRole: "copy", imagePresence: "field" },
    },
  })

  assert.equal(changed.spec.typeRole, "copy")
  assert.equal(changed.spec.imagePresence, "field")
})

test("offer copy does not infer typeRole or imagePresence", () => {
  const spec = baseSpec({
    leadJob: "offer",
    headline: "$25 Off This Week",
    offer: "$25 inspection",
    imageryRole: "neighborhood",
  })
  assert.equal(spec.typeRole, undefined)
  assert.equal(spec.imagePresence, undefined)

  const reasons = validateGenerationSet(brief, [
    validDirection(0, { spec }),
    validDirection(1),
    validDirection(2),
  ])
  assert.deepEqual(reasons, [])
})

test("prompt and tool schema expose optional typeRole and imagePresence", () => {
  const generate = buildGenerateSystemPrompt(canvas, { principles: [] })
  const regenerate = buildRegenerateSystemPrompt(canvas, { principles: [] })
  const refine = buildRefineSystemPrompt(canvas, { principles: [] })
  const intelligence = formatCreativeIntelligenceContext(
    buildCreativeIntelligenceContext(brief)
  )

  for (const text of [SPEC_FIELD_RULES, generate, regenerate, refine]) {
    assert.match(text, /typeRole/)
    assert.match(text, /imagePresence/)
    for (const value of TYPE_ROLES) assert.match(text, new RegExp(`\\b${value}\\b`))
    for (const value of IMAGE_PRESENCES) {
      assert.match(text, new RegExp(`\\b${value}\\b`))
    }
    assert.match(text, /Do not infer subject from leadJob/)
    assert.match(text, /Do not infer accent from imageryRole/)
    assert.doesNotMatch(text, /shaped void/)
    assert.doesNotMatch(text, /small plate/)
    assert.doesNotMatch(text, /print lockup/)
  }

  assert.match(generate, /typeRole and imagePresence are optional/)
  assert.match(regenerate, /typeRole and imagePresence are optional/)
  assert.match(CONCEPTION_BEFORE_SPEC_RULES, /typeRole, imagePresence/)
  assert.match(DIRECTION_SET_REASONING_RULES, /not a set-uniqueness requirement/)

  assert.equal(GENERATED_SPEC_TOOL_REQUIRED.includes("typeRole"), false)
  assert.equal(GENERATED_SPEC_TOOL_REQUIRED.includes("imagePresence"), false)
  assert.equal(GENERATED_SPEC_TOOL_REQUIRED.includes("leadJob"), true)
  assert.equal(GENERATED_SPEC_TOOL_REQUIRED.includes("imageryRole"), true)

  assert.doesNotMatch(intelligence, /typeRole/)
  assert.doesNotMatch(intelligence, /imagePresence/)
})
