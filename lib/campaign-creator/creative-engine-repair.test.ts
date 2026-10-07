import assert from "node:assert/strict"
import { test } from "node:test"

import { toCreativeCanvas } from "./creative-canvas"
import {
  CreativeGenerationInvalidError,
  normalizeGenerationResult,
  repairDirectionName,
  withGenerationRetryFeedback,
} from "./creative-engine-guards"
import { POSTCARD_5X8_V1 } from "../mail-catalog/pieces/postcard-5x8"
import { DIRECTION_NAME_CONSTRAINT } from "./prompts/shared"
import { buildGenerateSystemPrompt } from "./prompts/generate"
import { buildRegenerateSystemPrompt } from "./prompts/regenerate"
import type { CampaignBrief, CreativeDirection, CreativeSpec } from "./types"

const brief: CampaignBrief = {
  goal: "Book more roof inspections",
  offer: "Free roof inspection",
  primarySuccessMetric: { type: "appointment", description: "Inspection bookings" },
}

const canvas = toCreativeCanvas(POSTCARD_5X8_V1)

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}

function baseSpec(overrides: Partial<CreativeSpec> = {}): CreativeSpec {
  return {
    layoutVariant: "type_primary_split",
    headline: "Free Inspection Now",
    body: "Licensed local crew ready to inspect.",
    callToAction: "Call to book",
    visualDirection:
      "Late-afternoon light on a crew at a Chula Vista eave, framed wide enough to show the street, calm and specific.",
    tone: "Trustworthy",
    palette: ["#1e3a5f", "#4a90a4", "#f5f5f0"],
    imagery: "stock_generic_local",
    offer: "Free roof inspection",
    leadJob: "offer",
    imageryRole: "neighborhood",
    ...overrides,
  }
}

function direction(
  index: number,
  overrides: Partial<CreativeDirection> = {}
): CreativeDirection {
  const layouts = ["type_primary_split", "peer_split", "banded_split"] as const
  const jobs = ["offer", "problem", "trust"] as const
  const roles = ["neighborhood", "consequence", "crew"] as const
  const headlines = ["Free Inspection Now", "Hidden Roof Danger", "Trusted Roofing Team"]
  return {
    id: `dir-${index}`,
    name: ["Neighborhood Proof", "Storm Damage First", "Crew On Site"][index] ?? "Local Direction",
    rationale: [
      "Puts the existing offer first so the next step is obvious.",
      "Leads with the homeowner problem and keeps the offer as the action.",
      "Puts trust before the sale and keeps the offer as the response.",
    ][index] ?? "A distinct strategic frame.",
    designedToDrive: "Inspection bookings",
    tags: ["Trust", "Local", "Offer"],
    recommended: index === 0,
    oneLineDifference: index === 0 ? undefined : `Different frame ${index}`,
    createdAt: "2026-10-07T00:00:00.000Z",
    spec: baseSpec({
      layoutVariant: layouts[index],
      headline: headlines[index],
      leadJob: jobs[index],
      imageryRole: roles[index],
    }),
    ...overrides,
  }
}

test("repairDirectionName shortens, pads, and derives a 2–4 word label", () => {
  assert.equal(
    repairDirectionName("Premium Neighborhood Roofing Inspection Offer"),
    "Premium Neighborhood Roofing Inspection"
  )
  assert.equal(
    repairDirectionName("The Quiet Neighborhood Trust Story"),
    "Quiet Neighborhood Trust Story"
  )
  assert.equal(repairDirectionName("Bold"), "Bold Direction")
  assert.equal(repairDirectionName(""), "Studio Direction")
  assert.equal(
    repairDirectionName("", "Free Roofing Inspection This Week"),
    "Free Roofing Inspection This"
  )
  assert.equal(wordCount(repairDirectionName("One")), 2)
  assert.ok(wordCount(repairDirectionName("One Two Three Four Five Six")) <= 4)
})

test("long direction names and thin tags do not fail generation", () => {
  const result = normalizeGenerationResult(
    brief,
    [
      direction(0, {
        name: "Premium Neighborhood Roofing Inspection Offer",
        tags: ["Proof"],
      }),
      direction(1, {
        name: "Bold",
        tags: [],
        oneLineDifference: undefined,
      }),
      direction(2, {
        name: "The Quiet Neighborhood Trust Story",
        tags: ["Trust", "Local", "Offer", "Extra"],
      }),
    ],
    { stripInventedFacts: true }
  )

  assert.equal(result.directions.length, 3)
  for (const item of result.directions) {
    const count = wordCount(item.name)
    assert.ok(count >= 2 && count <= 4, item.name)
    assert.equal(item.tags.length, 3)
  }
  assert.equal(
    result.directions[0]?.name,
    "Premium Neighborhood Roofing Inspection"
  )
  assert.equal(result.directions[1]?.name, "Bold Direction")
  assert.equal(result.directions[2]?.name, "Quiet Neighborhood Trust Story")
  assert.equal(result.directions[0]?.tags[0], "Proof")
  assert.equal(result.directions[1]?.tags.length, 3)
  assert.ok(result.directions[1]?.oneLineDifference?.trim())
  assert.equal(new Set(result.directions.map((item) => item.name.toLowerCase())).size, 3)
})

test("identical repaired names stay distinct", () => {
  const result = normalizeGenerationResult(
    brief,
    [
      direction(0, { name: "Trusted Local Expert Story" }),
      direction(1, { name: "Trusted Local Expert Story" }),
      direction(2, { name: "Crew On The Roof" }),
    ],
    { stripInventedFacts: true }
  )
  const names = result.directions.map((item) => item.name)
  assert.equal(new Set(names.map((name) => name.toLowerCase())).size, 3)
  for (const name of names) {
    assert.ok(wordCount(name) >= 2 && wordCount(name) <= 4, name)
  }
})

test("a missing headline still fails generation", () => {
  assert.throws(
    () =>
      normalizeGenerationResult(
        brief,
        [
          direction(0, {
            name: "Premium Neighborhood Roofing Inspection Offer",
            spec: baseSpec({ headline: "   " }),
          }),
          direction(1),
          direction(2),
        ],
        { stripInventedFacts: true }
      ),
    (error: unknown) => {
      assert.ok(error instanceof CreativeGenerationInvalidError)
      assert.match(error.message, /missing a headline/)
      assert.doesNotMatch(error.message, /name must be 2/)
      return true
    }
  )
})

test("retry feedback includes the validation reasons", () => {
  const base = "Create three creative directions."
  assert.equal(withGenerationRetryFeedback(base, undefined), base)
  assert.equal(withGenerationRetryFeedback(base, []), base)
  const retry = withGenerationRetryFeedback(base, [
    "direction 1 name must be 2–4 words",
    "direction 3 name must be 2–4 words",
  ])
  assert.match(retry, /Create three creative directions/)
  assert.match(retry, /previous answer was invalid/)
  assert.match(retry, /direction 1 name must be 2–4 words/)
  assert.match(retry, /direction 3 name must be 2–4 words/)
})

test("generate and regenerate tell the model the direction name is 2 to 4 words", () => {
  const generate = buildGenerateSystemPrompt(canvas, { principles: [] })
  const regenerate = buildRegenerateSystemPrompt(canvas, { principles: [] })
  assert.match(DIRECTION_NAME_CONSTRAINT, /Exactly 2 to 4 words/)
  assert.equal(generate.includes(DIRECTION_NAME_CONSTRAINT), true)
  assert.equal(regenerate.includes(DIRECTION_NAME_CONSTRAINT), true)
})
