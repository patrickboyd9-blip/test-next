import assert from "node:assert/strict"
import { test } from "node:test"

import { buildGenerateSystemPrompt } from "../campaign-creator/prompts/generate"
import { buildRegenerateSystemPrompt } from "../campaign-creator/prompts/regenerate"
import {
  buildCreativeIntelligenceContext,
  formatCreativeIntelligenceContext,
} from "../campaign-creator/creative-intelligence"
import type { CreativeCanvas } from "../campaign-creator/creative-canvas"
import type { CampaignBrief } from "../campaign-creator/types"
import { selectReferenceCards } from "./select-reference-cards"
import { RESEARCH_TASTE_PACK, assertResearchTastePack } from "./taste-pack"

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

test("the curated pack is 20 prompt-safe postcard cards", () => {
  assert.doesNotThrow(() => assertResearchTastePack())
  assert.equal(RESEARCH_TASTE_PACK.length, 20)
  assert.equal(
    RESEARCH_TASTE_PACK.filter((card) => card.packGroup === "home_services").length,
    10
  )
  const verticals = new Set(
    RESEARCH_TASTE_PACK.filter((card) => card.packGroup === "home_services").map(
      (card) => card.vertical
    )
  )
  for (const vertical of ["hvac", "plumbing", "electrical", "roofing", "pest", "landscaping"]) {
    assert.equal(verticals.has(vertical as never), true, vertical)
  }
  assert.equal(
    RESEARCH_TASTE_PACK.every((card) => card.researchOnlyPhotoPointer == null),
    true
  )
})

test("a roofing brief gets the roofing card and not a restaurant or med-spa card", () => {
  const brief: CampaignBrief = {
    goal: "Book more roof inspections",
    businessInfo: { name: "Summit Roofing" },
    offer: "Free roof inspection",
  }
  const selection = selectReferenceCards(brief)
  const ids = selection.cards.map((card) => card.mmrId)
  assert.equal(selection.match, "vertical")
  assert.equal(ids.includes("MMR-001"), true)
  assert.equal(ids.includes("MMR-012"), false)
  assert.equal(ids.includes("MMR-021"), false)
  assert.equal(ids.length <= 4, true)
  assert.equal(selection.cards.some((card) => card.packGroup === "craft_exemplar"), true)
})

test("a pizza restaurant brief gets hospitality cards and not home-service cards", () => {
  const brief: CampaignBrief = {
    goal: "Fill more weekend tables",
    businessInfo: { name: "Harbor Pizza" },
    offer: "Free garlic knots with any large pizza",
  }
  const ids = selectReferenceCards(brief).cards.map((card) => card.mmrId)
  assert.deepEqual(ids.filter((id) => ["MMR-012", "MMR-170", "MMR-178"].includes(id)).sort(), [
    "MMR-012",
    "MMR-170",
    "MMR-178",
  ])
  assert.equal(ids.includes("MMR-001"), false)
  assert.equal(ids.includes("MMR-002"), false)
})

test("a physical therapy brief gets the therapy card and the chiropractic neighbor", () => {
  const brief: CampaignBrief = {
    goal: "Book more physical therapy evaluations",
    businessInfo: { name: "Northside Rehab" },
  }
  const ids = selectReferenceCards(brief).cards.map((card) => card.mmrId)
  assert.equal(ids.includes("MMR-042"), true)
  assert.equal(ids.includes("MMR-041"), true)
  assert.equal(ids.includes("MMR-001"), false)
})

test("an unmatched brief gets craft exemplars only", () => {
  const brief: CampaignBrief = {
    goal: "Increase donations for the food bank",
    businessInfo: { name: "Harbor Pantry" },
  }
  const selection = selectReferenceCards(brief)
  assert.equal(selection.match, "craft_only")
  assert.deepEqual(
    selection.cards.map((card) => card.mmrId),
    ["MMR-011", "MMR-013"]
  )
  assert.match(
    formatCreativeIntelligenceContext(buildCreativeIntelligenceContext(brief)),
    /general craft exemplars/
  )
})

test("generate and regenerate prompts consume the taste cards without raw research", () => {
  const brief: CampaignBrief = {
    goal: "Book more roof inspections",
    businessInfo: { name: "Summit Roofing" },
    offer: "Free roof inspection",
  }
  const intelligence = buildCreativeIntelligenceContext(brief)
  const generate = buildGenerateSystemPrompt(canvas, intelligence)
  const regenerate = buildRegenerateSystemPrompt(canvas, intelligence)

  for (const prompt of [generate, regenerate]) {
    assert.match(prompt, /\[MMR-001\]/)
    assert.match(prompt, /indoor consequence/)
    assert.match(prompt, /Pexels/)
    assert.match(prompt, /Do not spend money, print, or submit/)
    assert.doesNotMatch(prompt, /https?:\/\//i)
    assert.doesNotMatch(prompt, /postcardmania/i)
    assert.doesNotMatch(prompt, /ridge vents/i)
    assert.doesNotMatch(prompt, /source_url/i)
  }
})
