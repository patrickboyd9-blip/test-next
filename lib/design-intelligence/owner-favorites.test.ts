import assert from "node:assert/strict"
import { test } from "node:test"

import { loadSeedAnalyses } from "./library"
import { calibrationSentence, DEFAULT_OWNER_FAVORITE_IDS, ownerFavoriteIds } from "./owner-favorites"
import { selectReferences } from "./select"
import { retrieveTaste } from "./taste-retrieval"
import { referencePicksForCritique } from "./vision-critic"
import { tasteFromSeed, type VisionTaste } from "./vision-taste"

test("the owner favorite list includes Wondercide and can be configured", () => {
  assert.deepEqual(ownerFavoriteIds({} as NodeJS.ProcessEnv), [...DEFAULT_OWNER_FAVORITE_IDS])
  assert.equal(ownerFavoriteIds({} as NodeJS.ProcessEnv).includes("PM-056"), true)
  assert.deepEqual(ownerFavoriteIds({ DESIGN_OWNER_FAVORITES: "PM-047, PM-056" } as NodeJS.ProcessEnv), ["PM-047", "PM-056"])
  assert.match(calibrationSentence({} as NodeJS.ProcessEnv), /PM-056/)
  assert.match(calibrationSentence({} as NodeJS.ProcessEnv), /three-color palette/)
  assert.match(calibrationSentence({} as NodeJS.ProcessEnv), /Do not copy/)
})

test("retrieval keeps an owner favorite near the top even when the industry differs", () => {
  const brief = { goal: "Book a free roof inspection", offer: "$0 inspection", audience: { description: "Homeowners" } }
  const picks = retrieveTaste({
    tastes: [
      taste("MMR-200", { industry: "roofing", offerType: "free_inspection", feel: "integrated", grade: "A", whatWorks: "A roof card with one offer." }),
      taste("MMR-201", { industry: "plumbing", offerType: "price_point", feel: "panel", grade: "B", whatWorks: "A price column." }),
      taste("PM-056", { industry: "pest_control", offerType: "percent", feel: "editorial", grade: "B", whatWorks: "Three colors and one offer panel." }),
    ],
    brief,
    limit: 2,
    favorites: ownerFavoriteIds({} as NodeJS.ProcessEnv),
  })
  assert.deepEqual(picks.map((pick) => pick.id), ["MMR-200", "PM-056"])

  const records = loadSeedAnalyses().map((analysis) => ({
    id: analysis.id,
    source: "seed" as const,
    analysis,
    images: [],
    vertical: analysis.vertical,
    grade: analysis.grade,
    needsAnalysis: false,
  }))
  const anchors = selectReferences(records, brief, {} as NodeJS.ProcessEnv)
  assert.deepEqual(anchors.anchors.map((item) => item.id), ["PM-047", "PM-054", "PM-022", "PM-056"])
  assert.equal(anchors.peers.some((item) => item.id === "PM-056"), false)
})

test("Wondercide is a principle, not a panel layout to copy", () => {
  const analysis = loadSeedAnalyses().find((item) => item.id === "PM-056")
  assert.ok(analysis)
  const taste = tasteFromSeed(analysis)
  assert.ok(taste)
  assert.equal(taste.feel, "integrated")
  assert.equal(taste.offerType, "percent")
  assert.equal(taste.paletteRoles.accent, "Not written.")
  assert.match(taste.whatWorks, /offer panel/)
  assert.match(taste.whatWorks, /Do not copy the layout/)
  assert.match(taste.doNotCopy, /colors/)
})

test("the critic puts owner favorites ahead of the other references", () => {
  const picks = referencePicksForCritique(
    [
      { id: "MMR-200", grade: "A", industry: "roofing", offerType: "free_inspection", feel: "integrated", principle: "One offer.", doNotCopy: "The mark.", origin: "vision" },
      { id: "PM-022", grade: "A-", industry: "general", offerType: "percent", feel: "integrated", principle: "One card.", doNotCopy: "The mark.", origin: "vision" },
      { id: "PM-056", grade: "A-", industry: "pest_control", offerType: "percent", feel: "editorial", principle: "Three colors.", doNotCopy: "The mark.", origin: "vision" },
    ],
    ["PM-047", "PM-054", "PM-022", "PM-056"]
  )
  assert.deepEqual(picks.map((pick) => pick.id), ["PM-022", "PM-056", "MMR-200"])
})

function taste(id: string, patch: Partial<VisionTaste>): VisionTaste {
  return {
    version: "1.0.0",
    id,
    origin: "vision",
    imageSha256: "",
    imagePath: "",
    analyzedAt: "2026-10-17T00:00:00.000Z",
    model: "test",
    scoreKind: "vision",
    eyePath: "From the subject to the offer.",
    focalElement: "One offer.",
    scaleRatios: { offerVersusHeadline: "Offer leads.", headlineVersusBody: "Headline is larger than body." },
    whitespace: "Open.",
    paletteRoles: { background: "light", type: "dark", offer: "one accent", accent: "one accent" },
    typeIntegration: "Type on the canvas.",
    responseBlock: "One phone.",
    whatWorks: "One offer.",
    grade: "A",
    industry: "general",
    offerType: "other",
    feel: "integrated",
    compositionFamily: "open-canvas-offer",
    doNotCopy: "Do not copy the mark.",
    ...patch,
  }
}
