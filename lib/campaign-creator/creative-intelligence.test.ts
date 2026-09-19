import assert from "node:assert/strict"
import { test } from "node:test"

import type { CreativeCanvas } from "./creative-canvas"
import {
  CREATIVE_DIRECT_MAIL_HEURISTICS,
  buildCreativeIntelligenceContext,
  formatCreativeIntelligenceContext,
} from "./creative-intelligence"
import { buildGenerateSystemPrompt } from "./prompts/generate"
import type { CampaignBrief } from "./types"

const hvacBrief: CampaignBrief = {
  goal: "Book more service appointments",
  audience: { description: "Homeowners in Irvine" },
  businessInfo: { name: "ABC Air Conditioning" },
  offer: "15% off your first service call",
  primarySuccessMetric: { type: "appointment", description: "Appointment bookings" },
}

const plumbingBriefWithoutOffer: CampaignBrief = {
  goal: "Get more plumbing service calls",
  audience: { description: "Homeowners with older pipes" },
  businessInfo: { name: "Harbor Drain & Plumbing" },
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

test("non-plumbing brief includes direct-mail heuristics and no industry heuristics", () => {
  const context = buildCreativeIntelligenceContext(hvacBrief)

  assert.deepEqual([...context.directMailHeuristics], [...CREATIVE_DIRECT_MAIL_HEURISTICS])
  assert.equal(context.industryHeuristics.length, 0)
  assert.equal(context.directMailHeuristics.length > 0, true)
})

test("plumbing brief includes only creative-relevant industry heuristics", () => {
  const context = buildCreativeIntelligenceContext(plumbingBriefWithoutOffer)
  const joined = context.industryHeuristics.join("\n")

  assert.deepEqual([...context.directMailHeuristics], [...CREATIVE_DIRECT_MAIL_HEURISTICS])
  assert.equal(context.industryHeuristics.length > 0, true)
  assert.match(joined, /homeowner's problem/i)
  assert.match(joined, /one clear offer/i)
  assert.match(joined, /one clear action/i)
  assert.match(joined, /trust before asking/i)
  assert.match(joined, /localized/i)
  assert.match(joined, /do not invent that this business provides them/i)

  assert.doesNotMatch(joined, /highest-performing/i)
  assert.doesNotMatch(joined, /owner-occupied/i)
  assert.doesNotMatch(joined, /older than 20/i)
  assert.doesNotMatch(joined, /recent home buyers/i)
  assert.doesNotMatch(joined, /targeting renters/i)
  assert.doesNotMatch(joined, /generate service calls/i)
  assert.doesNotMatch(joined, /build neighborhood awareness/i)
})

test("plumbing brief with an offer omits industry offer examples", () => {
  const context = buildCreativeIntelligenceContext({
    ...plumbingBriefWithoutOffer,
    offer: "Free camera inspection this week",
  })
  const joined = context.industryHeuristics.join("\n")

  assert.doesNotMatch(joined, /free inspection, discounted drain cleaning/i)
  assert.match(joined, /one clear offer/i)
})

test("prompt labels heuristics as not measured performance data", () => {
  const context = buildCreativeIntelligenceContext(hvacBrief)
  const section = formatCreativeIntelligenceContext(context)
  const system = buildGenerateSystemPrompt(canvas, context)

  for (const text of [section, system]) {
    assert.match(text, /NOT measured performance data/)
    assert.match(text, /Modern Mail heuristics/)
    assert.match(text, /Campaign facts/)
    assert.match(text, /Physical constraints/)
    assert.match(text, /Do not blindly follow every heuristic/)
    assert.doesNotMatch(text, /highest-performing/)
    assert.doesNotMatch(text, /CampaignEvaluation/)
    assert.doesNotMatch(text, /5–10%/)
  }
})
