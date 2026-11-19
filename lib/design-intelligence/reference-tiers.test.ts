import assert from "node:assert/strict"
import { test } from "node:test"

import type { LibraryRecord } from "./library"
import { artDirectorGoldText } from "./patrick-gold"
import {
  brandTierFromProvenance,
  leaksProtectedReference,
  referenceTier,
} from "./reference-tiers"
import { selectReferences } from "./select"

test("tier comes only from the exact brand_tier values", () => {
  assert.equal(referenceTier({ id: "PM-066", brandTier: "patrick_favorite" }), 1)
  assert.equal(referenceTier({ id: "PM-070", brandTier: "patrick_favorite" }), 1)
  assert.equal(referenceTier({ id: "PM-066" }), 3)
  assert.equal(referenceTier({ id: "PM-078", brandTier: "national_brand" }), 2)
  assert.equal(referenceTier({ id: "PM-079", brandTier: "national_brand" }), 2)
  assert.equal(referenceTier({ id: "PM-001", brandTier: "national_brand" }), 2)
  assert.equal(referenceTier({ id: "PM-072", brandTier: "national_brand" }), 2)
  assert.equal(referenceTier({ id: "PM-072" }), 3)
  assert.equal(referenceTier({ id: "PM-075", brandTier: "local" }), 3)
  assert.equal(referenceTier({ id: "PM-078", brandTier: "national-brand" }), 3)
  assert.equal(brandTierFromProvenance({ brand_tier: "national_brand" }), "national_brand")
  assert.equal(brandTierFromProvenance({ brand_tier: "patrick_favorite" }), "patrick_favorite")
  assert.equal(brandTierFromProvenance({ brand_tier: "local" }), "local")
  assert.equal(brandTierFromProvenance({ notes: "Generac" }), undefined)
})

test("national brands outrank ordinary peers and neither tier lends its pictures or its name", () => {
  const brief = { goal: "Replace the roof", offer: "Free roof inspection" }
  const selection = selectReferences(
    [
      piece("MMR-900", "A", "local"),
      piece("PM-072", "C", "national_brand"),
      piece("PM-078", "B", "national_brand"),
      piece("PM-066", "A", "patrick_favorite"),
      piece("PM-001", "A", "national_brand"),
    ],
    brief,
    {} as unknown as NodeJS.ProcessEnv,
  )
  assert.deepEqual(selection.peers.map((pick) => pick.id), ["PM-001", "PM-078", "PM-072"])
  assert.equal(selection.peers.some((pick) => pick.id === "PM-066"), false)
  assert.equal(selection.imageIds.includes("PM-001"), false)
  assert.equal(selection.imageIds.includes("PM-072"), false)
  assert.equal(selection.imageIds.includes("PM-078"), false)
  assert.equal(selection.imageIds.includes("PM-066"), false)
  const spoken = selection.peers.map((pick) => `${pick.principle} ${pick.doNotCopy}`).join(" ")
  assert.equal(leaksProtectedReference(spoken), false)
  assert.match(selection.peers.find((pick) => pick.id === "PM-072")?.doNotCopy ?? "", /brand name/)
})

test("the anti-copy guard rejects gold identity and national brand names", () => {
  assert.equal(leaksProtectedReference(artDirectorGoldText()), false)
  assert.equal(leaksProtectedReference("One offer and a clear next step."), false)
  assert.equal(leaksProtectedReference("Call 614-861-3100 today"), true)
  assert.equal(leaksProtectedReference("A Generac postcard with their logo"), true)
  assert.equal(leaksProtectedReference("Shop Wayfair this week"), true)
  assert.equal(leaksProtectedReference("3 Day Blinds on the front"), true)
  assert.equal(leaksProtectedReference("LeafFilter and Dr. Squatch"), true)
})

function piece(id: string, grade: string, brandTier?: string): LibraryRecord {
  return {
    id,
    source: "c3po",
    vertical: "roofing",
    grade,
    brandTier,
    images: [{ role: "front", path: `library/${id}.jpg`, contentType: "image/jpeg" }],
    needsAnalysis: false,
    analysis: { id, vertical: "roofing", grade, summary: "One offer and one next step." },
  }
}
