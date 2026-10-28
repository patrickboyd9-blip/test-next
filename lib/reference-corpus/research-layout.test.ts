import assert from "node:assert/strict"
import { mkdtemp, rm } from "fs/promises"
import os from "os"
import path from "path"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { ResearchBasis } from "@/components/campaign-creator/studio/ResearchBasis"
import {
  buildCreativeIntelligenceContext,
  formatCreativeIntelligenceContext,
} from "@/lib/campaign-creator/creative-intelligence"
import { normalizeGenerationResult } from "@/lib/campaign-creator/creative-engine-guards"
import { campaignForCustomer } from "@/lib/campaign-creator/customer-campaign"
import { getMockCreativeDirections } from "@/lib/campaign-creator/mock-creative-data"
import { MEDICARE_AGENT_DISCLAIMER } from "@/lib/campaign-creator/medicare-compliance"
import { createCampaignRepository } from "@/lib/campaign-creator/repository"
import type { CampaignBrief, CreativeDirection, CreativeSpec } from "@/lib/campaign-creator/types"
import { createPostgresDocumentStore } from "@/lib/storage/document-store"
import { MemorySql } from "@/lib/storage/memory-sql"

import { loadReferenceMailerImages } from "./mailer-images"
import {
  applyResearchLayouts,
  layoutPolicyForBrief,
  type VerticalLayoutPolicy,
} from "./research-layout"

function ids(policy: VerticalLayoutPolicy): string[] {
  return policy.sources.map((source) => source.mmrId)
}

function direction(index: number, layout: CreativeSpec["layoutVariant"]): CreativeDirection {
  const headlines = ["Keep This Number", "A Slow Leak Costs", "We Are Already Local"]
  return {
    id: `dir-${index}`,
    name: ["Keep This Number", "Slow Leak First", "Local When It Breaks"][index] ?? "Local Direction",
    rationale: [
      "The words lead so the number is easy to keep.",
      "The leak is the reason to call, with one offer.",
      "A person doing the work makes the trade obvious.",
    ][index] ?? "A distinct frame.",
    designedToDrive: "Service calls",
    tags: ["Local", "Plain", "Direct"],
    recommended: index === 0,
    oneLineDifference: index === 0 ? undefined : `Different frame ${index}`,
    createdAt: "2026-10-16T00:00:00.000Z",
    spec: {
      layoutVariant: layout,
      headline: headlines[index],
      body: "You can call when a drain needs a look.",
      callToAction: "Call when you need us",
      visualDirection:
        "A calm kitchen sink in daylight with a single drip and open space beside it for type.",
      tone: "Calm",
      palette: ["#1f3a4d", "#d7e2ea", "#f4f1ea"],
      imagery: "stock_generic_local",
      offer: "Free leak check",
      leadJob: "trust",
      imageryRole: layout === "type_only" ? "none" : "neighborhood",
    },
  }
}

test("plumbing layout comes from the plumbing card", () => {
  const policy = layoutPolicyForBrief({ goal: "Need a plumber for a leaking drain" })
  assert.equal(policy.mode, "research")
  assert.equal(policy.preferred, "type_primary_split")
  assert.deepEqual(policy.allowed, ["type_primary_split", "peer_split"])
  assert.equal(policy.balance, "type_led")
  assert.equal(policy.allowed.includes("type_only"), false)
  assert.deepEqual(ids(policy), ["MMR-019"])
  assert.equal(policy.parameters.headlinePosition, "beside_photo")
  assert.ok(policy.parameters.photoShare > 0 && policy.parameters.photoShare < 0.7)
  assert.equal(policy.parameters.offerBadge, "inline")
})

test("roofing layout lets the photograph and the headline share the card", () => {
  const policy = layoutPolicyForBrief({ goal: "Book roof inspections" })
  assert.equal(policy.mode, "research")
  assert.equal(policy.preferred, "peer_split")
  assert.deepEqual(policy.allowed, ["peer_split", "image_grounded", "type_primary_split"])
  assert.equal(policy.balance, "balanced")
  assert.deepEqual(ids(policy), ["MMR-001"])
  assert.equal(policy.parameters.photoCrop, "open")
  assert.ok(policy.parameters.photoShare >= 0.5)
})

test("HVAC layout leads with the offer", () => {
  const policy = layoutPolicyForBrief({ goal: "Book an HVAC tune-up" })
  assert.equal(policy.mode, "research")
  assert.equal(policy.preferred, "type_primary_split")
  assert.deepEqual(policy.allowed, ["type_primary_split", "peer_split", "banded_split"])
  assert.equal(policy.balance, "type_led")
  assert.deepEqual(ids(policy), ["MMR-002"])
  assert.equal(policy.parameters.offerBadge, "band")
})

test("dental layout pairs a welcome line with a photograph of the place", () => {
  const policy = layoutPolicyForBrief({ goal: "Welcome new patients to a dental office" })
  assert.equal(policy.mode, "research")
  assert.equal(policy.preferred, "peer_split")
  assert.deepEqual(policy.allowed, ["peer_split", "image_grounded", "type_primary_split"])
  assert.equal(policy.balance, "balanced")
  assert.deepEqual(ids(policy), ["MMR-285"])
})

test("Medicare layouts stay the photographic set and the disclaimer is unchanged", () => {
  const policy = layoutPolicyForBrief({ goal: "Book Medicare plan reviews" })
  assert.equal(policy.mode, "research")
  assert.equal(policy.preferred, "peer_split")
  assert.deepEqual(policy.allowed, ["peer_split", "image_grounded", "type_primary_split"])
  assert.equal(policy.balance, "balanced")
  assert.equal(policy.allowed.includes("type_only"), false)
  assert.equal(policy.allowed.includes("banded_split"), false)
  for (const id of ["MMR-514", "MMR-515", "MMR-516"]) {
    assert.equal(ids(policy).includes(id), true, id)
  }
  assert.equal(ids(policy).includes("MMR-001"), false)
  assert.match(MEDICARE_AGENT_DISCLAIMER, /Medicare\.gov/)
  assert.equal(MEDICARE_AGENT_DISCLAIMER.includes("SHIP"), false)
})

test("an unknown vertical keeps every layout and cites the general cards", () => {
  const brief: CampaignBrief = { goal: "Sell a house in Austin" }
  const policy = layoutPolicyForBrief(brief)
  assert.equal(policy.mode, "open")
  assert.equal(policy.allowed.length, 5)
  const applied = applyResearchLayouts(brief, [
    direction(0, "type_only"),
    direction(1, "peer_split"),
    direction(2, "banded_split"),
  ])
  assert.deepEqual(
    applied.map((item) => item.spec.layoutVariant),
    ["type_only", "peer_split", "banded_split"]
  )
  assert.equal(ids(policy).includes("MMR-011"), true)
  assert.equal(ids(policy).includes("MMR-019"), false)
  const prompt = formatCreativeIntelligenceContext(buildCreativeIntelligenceContext(brief))
  assert.match(prompt, /do not choose the mail piece/i)
  assert.doesNotMatch(prompt, /Layouts the matched research supports/)
})

test("a disallowed layout is replaced and the three directions still differ", () => {
  const brief: CampaignBrief = {
    goal: "Need a plumber",
    offer: "Free leak check",
  }
  const applied = applyResearchLayouts(brief, [
    direction(0, "type_only"),
    direction(1, "banded_split"),
    direction(2, "image_grounded"),
  ])
  const layouts = applied.map((item) => item.spec.layoutVariant)
  assert.equal(layouts.includes("type_only"), false)
  assert.equal(layouts.includes("banded_split"), false)
  assert.equal(applied[0]?.spec.layoutVariant, "type_primary_split")
  assert.equal(new Set(layouts).size >= 2, true)
  assert.equal(applied[0]?.research?.sources[0]?.mmrId, "MMR-019")
  assert.match(applied[0]?.research?.layoutSummary ?? "", /words lead/i)
  assert.equal(applied[0]?.spec.imageryRole === "none", false)
})

test("roofing directions cite different records for the three default pro layouts", () => {
  const brief: CampaignBrief = { goal: "Book roof inspections", offer: "Free roof inspection" }
  const applied = applyResearchLayouts(brief, [
    direction(0, "peer_split"),
    direction(1, "image_grounded"),
    direction(2, "type_primary_split"),
  ])
  assert.deepEqual(
    applied.map((item) => item.spec.layoutHints?.templateId),
    ["roof_full_bleed", "roof_split", "roof_coupon"]
  )
  const cited = applied.map((item) => item.research?.sources.map((source) => source.mmrId))
  assert.deepEqual(cited, [["MMR-587"], ["MMR-583"], ["MMR-577"]])
  const unique = new Set(cited.flat())
  assert.equal(unique.size, 3)
  assert.equal(unique.has("MMR-001"), false)
})

test("sources and the internal score persist, and older campaigns still load", async () => {
  const sql = new MemorySql()
  const store = createPostgresDocumentStore("campaigns", sql)
  const repo = createCampaignRepository(store)
  const brief: CampaignBrief = { goal: "Need a plumber", offer: "Free leak check" }
  const result = normalizeGenerationResult(brief, getMockCreativeDirections(brief), {
    stripInventedFacts: false,
  })
  const created = await repo.createCampaign("owner@example.com")
  created.brief = brief
  created.creative.directions = result.directions
  await store.put(created.id, created)

  const loaded = await repo.getCampaign(created.id)
  const research = loaded?.creative.directions[0]?.research
  assert.equal(research?.sources[0]?.mmrId, "MMR-019")
  assert.equal(typeof research?.sources[0]?.title, "string")
  assert.match(research?.layoutSummary ?? "", /mailers we studied/)
  assert.equal(typeof research?.quality?.score, "number")
  assert.ok((research?.quality?.attempts ?? 0) <= 2)
  assert.equal(loaded?.creative.directions.length, 3)
  assert.ok(new Set(loaded?.creative.directions.map((item) => item.spec.layoutVariant)).size >= 2)

  const customer = campaignForCustomer(loaded!)
  assert.equal(customer.creative.directions[0]?.research?.quality, undefined)
  assert.equal(customer.creative.directions[0]?.research?.sources[0]?.mmrId, "MMR-019")

  const legacy = await repo.createCampaign("legacy-owner")
  const again = await repo.getCampaign(legacy.id)
  assert.equal(again?.creative.directions[0]?.research, undefined)

  const html = renderToStaticMarkup(
    createElement(ResearchBasis, { research: customer.creative.directions[0]?.research })
  )
  assert.match(html, /Based on research/)
  assert.match(html, /MMR-019/)
  assert.doesNotMatch(html, /score|rubric|AF\d|QA/i)
})

test("the generation prompt names the layouts the plumbing research supports", () => {
  const prompt = formatCreativeIntelligenceContext(
    buildCreativeIntelligenceContext({ goal: "Need a plumber for a drain" })
  )
  assert.match(prompt, /Layouts the matched research supports/)
  assert.match(prompt, /type_primary_split/)
  assert.match(prompt, /peer_split/)
  assert.match(prompt, /MMR-019/)
  assert.match(prompt, /do not copy a brand/i)
  assert.doesNotMatch(prompt, /https?:\/\//i)
})

test("reference mailer images stay empty because the research library stores no scans", async () => {
  const images = await loadReferenceMailerImages(["MMR-019", "MMR-001", "MMR-514"])
  assert.deepEqual(images, [])
  const temp = await mkdtemp(path.join(os.tmpdir(), "mm-mailers-"))
  try {
    const fromEmpty = await loadReferenceMailerImages(["MMR-001"], temp)
    assert.deepEqual(fromEmpty, [])
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})
