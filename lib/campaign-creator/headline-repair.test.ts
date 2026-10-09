import assert from "node:assert/strict"
import { test } from "node:test"

import {
  CreativeGenerationInvalidError,
  normalizeGenerationResult,
} from "./creative-engine-guards"
import {
  HEADLINE_WORD_HARD_CAP,
  HEADLINE_WORD_TARGET,
  headlineWordCount,
  repairHeadlineCopy,
  repairSpecHeadline,
} from "./headline-repair"
import { buildGenerateSystemPrompt } from "./prompts/generate"
import { buildRegenerateSystemPrompt } from "./prompts/regenerate"
import { toCreativeCanvas } from "./creative-canvas"
import { POSTCARD_5X8_V1 } from "../mail-catalog/pieces/postcard-5x8"
import type { CampaignBrief, CreativeDirection, CreativeSpec } from "./types"

const brief: CampaignBrief = {
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
    visualDirection: "Late-afternoon light on a crew at a roof edge.",
    tone: "Trustworthy",
    palette: ["#1e3a5f", "#4a90a4", "#f5f5f0"],
    imagery: "stock_generic_local",
    offer: "Free roof inspection",
    leadJob: "offer",
    imageryRole: "neighborhood",
    ...overrides,
  }
}

function direction(index: number, overrides: Partial<CreativeDirection> = {}): CreativeDirection {
  const layouts = ["type_primary_split", "peer_split", "banded_split"] as const
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
    createdAt: "2026-10-09T00:00:00.000Z",
    spec: baseSpec({
      layoutVariant: layouts[index],
      headline: headlines[index],
      leadJob: (["offer", "problem", "trust"] as const)[index],
      imageryRole: (["neighborhood", "consequence", "crew"] as const)[index],
    }),
    ...overrides,
  }
}

test("a sentence headline keeps 3 to 6 words and moves the offer detail", () => {
  const repaired = repairHeadlineCopy({
    headline: "Free roof inspection, including a complimentary gutter check",
  })
  const count = headlineWordCount(repaired.headline)
  assert.ok(count >= 3 && count <= HEADLINE_WORD_TARGET, repaired.headline)
  assert.equal(repaired.headline, "Free roof inspection")
  assert.match(repaired.subheadline ?? "", /gutter check/i)
})

test("a headline past the hard cap is shortened instead of rejected", () => {
  const result = normalizeGenerationResult(
    brief,
    [
      direction(0, {
        spec: baseSpec({
          headline:
            "Free roof inspection this week for every homeowner in Chula Vista right now",
        }),
      }),
      direction(1),
      direction(2),
    ],
    { stripInventedFacts: true }
  )
  const headline = result.directions[0]?.spec.headline ?? ""
  assert.ok(headlineWordCount(headline) <= HEADLINE_WORD_HARD_CAP, headline)
  assert.ok(headlineWordCount(headline) <= HEADLINE_WORD_TARGET, headline)
  assert.match(result.directions[0]?.spec.subheadline ?? "", /Chula Vista|homeowner/i)
})

test("a long sentence breaks before a joining word instead of mid-phrase", () => {
  const repaired = repairHeadlineCopy({
    headline: "Your roof may already be letting water in after last week's storm",
  })
  assert.equal(repaired.headline, "Your roof may already be letting water in")
  assert.equal(repaired.subheadline, "After last week's storm")
  assert.deepEqual(repairHeadlineCopy(repaired), repaired)
})

test("detail moved into an existing subhead stays its own sentence", () => {
  const repaired = repairHeadlineCopy({
    headline: "A local crew that shows up when the weather turns on your street",
    subheadline: "Free roof inspection. Chula Vista.",
  })
  assert.equal(repaired.headline, "A local crew that shows up")
  assert.equal(
    repaired.subheadline,
    "When the weather turns on your street. Free roof inspection. Chula Vista."
  )
})

test("repair is stable and leaves a short headline alone", () => {
  const once = repairHeadlineCopy({
    headline: "Free roof inspection, including a complimentary gutter check",
  })
  const twice = repairHeadlineCopy(once)
  assert.deepEqual(twice, once)
  assert.equal(repairSpecHeadline(baseSpec()).headline, "Free Inspection Now")
})

test("a missing headline still fails generation", () => {
  assert.throws(
    () =>
      normalizeGenerationResult(
        brief,
        [direction(0, { spec: baseSpec({ headline: "   " }) }), direction(1), direction(2)],
        { stripInventedFacts: true }
      ),
    (error: unknown) => {
      assert.ok(error instanceof CreativeGenerationInvalidError)
      assert.match(error.message, /missing a headline/)
      return true
    }
  )
})

test("generate and regenerate ask for a 3 to 6 word headline", () => {
  const canvas = toCreativeCanvas(POSTCARD_5X8_V1)
  const intelligence = {
    campaignReading: "Local roofing.",
    principles: [],
    referenceCards: [],
    uncertainty: [],
  }
  for (const prompt of [
    buildGenerateSystemPrompt(canvas, intelligence as never),
    buildRegenerateSystemPrompt(canvas, intelligence as never),
  ]) {
    assert.match(prompt, /3 to 6 words/)
    assert.match(prompt, /Hard cap 8/)
    assert.match(prompt, /subheadline/)
  }
})
