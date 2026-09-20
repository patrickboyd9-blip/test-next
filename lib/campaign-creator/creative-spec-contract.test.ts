import assert from "node:assert/strict"
import { test } from "node:test"

import {
  applyFaithfulness,
  finalizeRefinement,
  isImageryRole,
  isLeadJob,
  normalizeGenerationResult,
  validateGenerationSet,
} from "./creative-engine-guards"
import { getMockCreativeDirections } from "./mock-creative-data"
import { buildGenerateSystemPrompt } from "./prompts/generate"
import { buildRegenerateSystemPrompt, buildRegenerateUserMessage } from "./prompts/regenerate"
import { buildRefineSystemPrompt } from "./prompts/refine"
import { SPEC_FIELD_RULES } from "./prompts/shared"
import { cloneSpec } from "./spec-diff"
import {
  GENERATED_SPEC_TOOL_REQUIRED,
  IMAGERY_ROLES,
  LEAD_JOBS,
  type CampaignBrief,
  type CreativeDirection,
  type CreativeSpec,
  type ImageryRole,
  type LeadJob,
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
    layoutVariant: "offer_hero",
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
  const layouts = ["offer_hero", "trust_first", "urgency_banner"] as const
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
    layoutVariant: "trust_first",
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
