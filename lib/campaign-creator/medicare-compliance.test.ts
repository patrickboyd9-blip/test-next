import assert from "node:assert/strict"
import { test } from "node:test"

import { normalizeGenerationResult } from "./creative-engine-guards"
import {
  buildCreativeIntelligenceContext,
  formatCreativeIntelligenceContext,
} from "./creative-intelligence"
import { getMockCreativeDirections } from "./mock-creative-data"
import {
  MEDICARE_AGENT_DISCLAIMER,
  isMedicareAgentBrief,
  medicareCopyViolations,
  medicareDisclaimerFor,
  repairMedicareAgentSpec,
  scrubMedicareLanguage,
} from "./medicare-compliance"
import type { CampaignBrief, CreativeSpec } from "./types"

const brief: CampaignBrief = {
  goal: "Book Medicare plan reviews",
  audience: { description: "People turning 65" },
  businessInfo: { name: "Harbor Advisors", phone: "555-0142" },
  phone: "555-0142",
  website: "https://harbor.example/review",
  qrDestination: "https://harbor.example/review",
}

function spec(overrides: Partial<CreativeSpec> = {}): CreativeSpec {
  return {
    layoutVariant: "type_only",
    headline: "Official Business",
    body: "You qualify for a $0 premium benefit. Act now.",
    callToAction: "You are entitled",
    offer: "$0 premium",
    visualDirection: "The capitol and an eagle over a construction site.",
    tone: "Official",
    palette: ["#1f3a4d", "#e7eef2", "#f6f3ee"],
    imagery: "none",
    imageryRole: "none",
    leadJob: "offer",
    ...overrides,
  }
}

test("the Medicare disclaimer is the required sentence", () => {
  assert.equal(
    MEDICARE_AGENT_DISCLAIMER,
    "We do not offer every plan available in your area. Any information we provide is limited to those plans we do offer in your area. Please contact Medicare.gov or 1-800-MEDICARE to get information on all of your options."
  )
  assert.equal(medicareDisclaimerFor(brief), MEDICARE_AGENT_DISCLAIMER)
  assert.equal(medicareDisclaimerFor({ goal: "Book roof inspections" }), null)
  assert.equal(isMedicareAgentBrief({ goal: "Auto insurance for a household" }), false)
})

test("prohibited wording, fake deadlines, and invented dollars are removed", () => {
  const cleaned = scrubMedicareLanguage(
    "Official Business. You qualify for a benefit. You are entitled. Act now. $0 premium. Annual Enrollment is October 15 to December 7.",
    brief
  )
  assert.doesNotMatch(cleaned, /official business|you qualify|entitled|benefit|act now|\$0/i)
  assert.match(cleaned, /October 15/)
  const kept = scrubMedicareLanguage("Plans from $0 premium in your area.", {
    ...brief,
    offer: "$0 premium",
  })
  assert.match(kept, /\$0 premium/)
})

test("a type-only Medicare spec becomes a photographic free plan review", () => {
  const repaired = repairMedicareAgentSpec(brief, spec(), 0)
  assert.notEqual(repaired.layoutVariant, "type_only")
  assert.equal(repaired.imageryRole, "neighborhood")
  assert.equal(repaired.offer, "Free plan review")
  assert.equal(repaired.headline, "Free Plan Review")
  assert.equal(repaired.layoutHints?.qrProminence, "large")
  assert.match(repaired.visualDirection ?? "", /couple/i)
  assert.doesNotMatch(repaired.visualDirection ?? "", /construction|capitol|eagle/i)
  assert.deepEqual(medicareCopyViolations(brief, repaired), [])
})

test("normalization keeps a Medicare set photographic and compliant", () => {
  const hvac = getMockCreativeDirections()
  assert.match(hvac[0]?.spec.visualDirection ?? "", /hvac|condenser|thermostat|technician|home/i)
  const medicare = getMockCreativeDirections(brief)
  assert.equal(medicare.length, 3)
  assert.equal(medicare.filter((direction) => direction.recommended).length, 1)
  for (const direction of medicare) {
    assert.notEqual(direction.spec.layoutVariant, "type_only")
    assert.equal(direction.spec.layoutHints?.qrProminence, "large")
    assert.doesNotMatch(
      `${direction.spec.headline} ${direction.spec.body} ${direction.spec.visualDirection}`,
      /official business|construction|capitol|casket|\$0/i
    )
  }

  const result = normalizeGenerationResult(
    brief,
    medicare.map((direction, index) =>
      index === 0
        ? { ...direction, spec: spec(), rationale: "Official Business for people who qualify." }
        : direction
    ),
    { stripInventedFacts: true }
  )
  const lead = result.directions[0]?.spec
  assert.notEqual(lead?.layoutVariant, "type_only")
  assert.equal(lead?.offer, "Free plan review")
  assert.doesNotMatch(result.directions[0]?.rationale ?? "", /official business|qualify/i)
})

test("Medicare principles stay off a roofing prompt", () => {
  const roofing = formatCreativeIntelligenceContext(
    buildCreativeIntelligenceContext({ goal: "Book roof inspections" })
  )
  assert.doesNotMatch(roofing, /1-800-MEDICARE/)
  const medicare = formatCreativeIntelligenceContext(buildCreativeIntelligenceContext(brief))
  assert.match(medicare, /1-800-MEDICARE/)
  assert.match(medicare, /MMR-514/)
  assert.doesNotMatch(medicare, /MMR-001/)
})
