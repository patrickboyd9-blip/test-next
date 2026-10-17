import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"

import { createFileDocumentStore } from "@/lib/storage/document-store"

import { COMPOSITION_FAMILIES, rankCandidates } from "./candidate-board"
import {
  letterFor,
  scoreDesignPattern,
  scoreReferenceWriteup,
} from "./composition-grade"
import { directDesign } from "./art-director"
import { composeGridCard } from "./grid-composer"
import { gradeComposition, readComposition } from "./composition-grade"
import { critiqueCard } from "./critic"
import { EXAM_BRIEFS } from "./exam"
import { saveConceptVote, signalsFromVotes, tasteSignalsForOwner } from "./concept-feedback"
import type { LibraryRecord } from "./library"
import { selectReferences } from "./select"
import { citationsForFamily, retrieveTaste } from "./taste-retrieval"
import {
  backfillVisionTaste,
  hashImage,
  parseVisionTastePayload,
  type VisionTaste,
} from "./vision-taste"

const rulesEnv = { DESIGN_DIRECTOR: "rules", DESIGN_CRITIC: "machine", DESIGN_CANDIDATE_RENDERS: "off" } as NodeJS.ProcessEnv

test("a vision reading keeps the structure and drops phone numbers", () => {
  const taste = parseVisionTastePayload({
    eyePath: "From the subject to the offer to the phone.",
    focalElement: "One floating price on a light field.",
    scaleRatios: { offerVersusHeadline: "The offer is much larger than the headline.", headlineVersusBody: "The headline is about three times the body." },
    whitespace: "Most of the card is open.",
    paletteRoles: { background: "light paper", type: "near black", offer: "one green", accent: "the same green" },
    typeIntegration: "The headline sits on the open canvas, not in a box.",
    responseBlock: "One small row of thumbnails and one phone.",
    whatWorks: "Call (619) 555-0148 or visit https://example.com for $90 off.",
    grade: "A",
    industry: "junk_removal",
    offerType: "price_point",
    feel: "integrated",
    compositionFamily: "open-canvas-offer",
  }, "PM-900")
  assert.ok(taste)
  assert.equal(taste?.grade, "A")
  assert.equal(taste?.industry, "junk_removal")
  assert.equal(/555-0148|https:|\$90/.test(taste?.whatWorks ?? ""), false)
  assert.equal(taste?.doNotCopy.includes("Do not copy"), true)
})

test("vision taste backfill is batched, skips a known image, and refuses private paths", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mm-taste-"))
  try {
    const store = createFileDocumentStore(dir)
    const bytes = Buffer.from("a-reference-image")
    const seen: string[] = []
    const records: LibraryRecord[] = [
      record("PM-001", "c3po/assets/physical/PM-001/front.jpg"),
      record("PM-002", "c3po/assets/physical/PM-002/front.jpg"),
      record("PM-003", "private/PM-003/front.jpg"),
    ]
    const first = await backfillVisionTaste({
      env: rulesEnv,
      store,
      records,
      limit: 1,
      now: "2026-10-17T00:00:00.000Z",
      analyze: async (item) => {
        seen.push(item.id)
        return taste(item.id, hashImage(bytes))
      },
      readImage: async () => ({ bytes, mediaType: "image/jpeg" as const }),
    })
    assert.deepEqual(first.analyzed, ["PM-001"])
    assert.equal(first.errors.some((error) => error.includes("private")), true)
    const second = await backfillVisionTaste({
      env: rulesEnv,
      store,
      records,
      limit: 4,
      now: "2026-10-17T00:00:00.000Z",
      analyze: async (item, image) => {
        seen.push(item.id)
        return { ...taste(item.id, hashImage(image)), imageSha256: hashImage(image) }
      },
      readImage: async () => ({ bytes, mediaType: "image/jpeg" as const }),
    })
    assert.equal(second.analyzed.includes("PM-001"), false)
    assert.equal(second.analyzed.includes("PM-002"), true)
    assert.equal(seen.includes("PM-003"), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("retrieval follows industry, offer, and feel, and citations are that set", () => {
  const tastes = [
    taste("PM-047", "", { industry: "roofing", offerType: "free_inspection", feel: "integrated", grade: "A", whatWorks: "One figure on an open field." }),
    taste("MMR-019", "", { industry: "plumbing", offerType: "price_point", feel: "panel", grade: "B", whatWorks: "A price column beside the work." }),
    taste("MMR-513", "", { industry: "roofing", offerType: "free_inspection", feel: "urgent", grade: "A", whatWorks: "An official-looking notice." }),
    taste("PM-010", "", { industry: "roofing", offerType: "dollar_off", feel: "panel", grade: "C+", whatWorks: "A tidy stack of boxes." }),
    taste("PM-022", "", { industry: "general", offerType: "percent", feel: "integrated", grade: "A-", whatWorks: "One percent, one card." }),
  ]
  tastes[2] = { ...tastes[2]!, id: "MMR-900" }
  const low = taste("PM-099", "", { grade: "C", industry: "roofing", offerType: "free_inspection", feel: "integrated", whatWorks: "Too many boxes." })
  const picks = retrieveTaste({
    tastes: [...tastes, low],
    brief: { goal: "Book a free roof inspection", offer: "$0 inspection", audience: { description: "Homeowners" } },
  })
  assert.equal(picks[0]?.id, "PM-047")
  assert.equal(picks.some((pick) => pick.id === "PM-099" || pick.id === "PM-010"), false)
  const cited = citationsForFamily(picks, "integrated")
  assert.equal(cited.every((pick) => picks.some((item) => item.id === pick.id)), true)
  assert.equal(cited.length > 0, true)
})

test("a thumbs-down on a family pushes that family down for the same owner", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mm-feedback-"))
  try {
    const store = createFileDocumentStore(dir)
    await saveConceptVote({
      store,
      campaignId: "camp-1",
      directionId: "dir-1",
      ownerId: "jordan@example.com",
      vote: "down",
      reason: "Too many boxes.",
      compositionFamily: "panel",
      now: "2026-10-17T00:00:00.000Z",
    })
    await saveConceptVote({
      store,
      campaignId: "camp-1",
      directionId: "dir-2",
      ownerId: "jordan@example.com",
      vote: "up",
      reason: "The price floats.",
      compositionFamily: "integrated",
      now: "2026-10-17T00:00:00.000Z",
    })
    const signals = await tasteSignalsForOwner("jordan@example.com", store)
    assert.deepEqual(signals.dislikedFamilies, ["panel"])
    assert.deepEqual(signals.likedFamilies, ["integrated"])
    const tastes = [
      taste("PM-047", "", { industry: "roofing", offerType: "free_inspection", feel: "integrated", grade: "B", compositionFamily: "integrated", whatWorks: "Open field." }),
      taste("PM-054", "", { industry: "roofing", offerType: "free_inspection", feel: "panel", grade: "A", compositionFamily: "panel", whatWorks: "A side panel." }),
    ]
    const without = retrieveTaste({
      tastes,
      brief: { goal: "Book a roof inspection", offer: "$0 inspection" },
    })
    const withSignals = retrieveTaste({
      tastes,
      brief: { goal: "Book a roof inspection", offer: "$0 inspection" },
      signals,
    })
    assert.equal(without[0]?.id, "PM-054")
    assert.equal(withSignals[0]?.id, "PM-047")
    assert.equal(signalsFromVotes([]).likedNotes.length, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("a separated panel roofing card lands at B- or C+, and an integrated card can clear B", () => {
  const brief = { goal: "Book a free roof inspection", offer: "$0 inspection", businessInfo: { name: "Northline Roofing" } }
  const selection = selectReferences([], brief)
  const spec = { headline: "Free roof inspection", offer: "$0 inspection", phone: "(619) 555-0148", website: "northline.example/book" }
  const panel = directDesign({ brief, selection, trim: "5x8", slot: 2 })
  const panelCard = composeGridCard({ rationale: panel.rationale, spec, businessName: "Northline Roofing" })
  const panelCritique = critiqueCard(panelCard, panel.rationale, "Free roof inspection $0 inspection")
  const panelGrade = gradeComposition({
    card: panelCard,
    rationale: panel.rationale,
    autoFails: panelCritique.autoFails,
    worstContrast: panelCritique.autoFails.includes("AF1") ? 3 : 7,
  })
  const panelReading = readComposition(panelCard, panel.rationale)
  assert.equal(panel.rationale.grid.intentional_break, "panel")
  assert.equal(panelReading.typePanel, true)
  assert.ok(panelGrade.letter === "B-" || panelGrade.letter === "C+", `${panelGrade.letter} ${panelGrade.score} panel ${panelReading.panelShare}`)
  assert.equal(panelGrade.cleared, false)
  assert.equal(panelGrade.scoreKind, "machine estimate")

  const open = directDesign({ brief, selection, trim: "5x8", slot: 0 })
  const openCard = composeGridCard({ rationale: open.rationale, spec, businessName: "Northline Roofing" })
  const openCritique = critiqueCard(openCard, open.rationale, "Free roof inspection $0 inspection")
  const openGrade = gradeComposition({
    card: openCard,
    rationale: open.rationale,
    autoFails: openCritique.autoFails,
    worstContrast: openCritique.autoFails.includes("AF1") ? 3 : 7,
  })
  const openReading = readComposition(openCard, open.rationale)
  assert.equal(open.rationale.grid.intentional_break, "integrated")
  assert.equal(openReading.typePanel, false)
  assert.equal(openGrade.cleared, true)
  assert.ok(openGrade.score > panelGrade.score)
  assert.equal(openGrade.scoreKind, "machine estimate")

  const integrated = scoreDesignPattern({
    typeOnCanvas: true,
    floatingOffer: true,
    cutoutSubject: true,
    singleThumbnailRow: true,
    boxedModules: 1,
    panelHoldsAllType: false,
  })
  assert.equal(letterFor(integrated), "A")

  const panelPattern = scoreDesignPattern({
    typeOnCanvas: false,
    floatingOffer: false,
    cutoutSubject: false,
    singleThumbnailRow: false,
    boxedModules: 1,
    panelHoldsAllType: true,
  })
  const panelLetter = letterFor(panelPattern)
  assert.ok(panelLetter === "B-" || panelLetter === "C+", panelLetter)
})

test("a strong reference writeup grades A and a price-rail writeup does not", () => {
  const strong = scoreReferenceWriteup(
    "Full-bleed photo plus one offer band. The offer numerals are far larger than the short headline. One phone. One offer.",
    "A"
  )
  const rail = scoreReferenceWriteup(
    "Photo left, a scalloped price column right. Three prices are nearly equal.",
    "B"
  )
  assert.equal(letterFor(strong), "A")
  assert.notEqual(letterFor(rail), "A")
  assert.ok(letterFor(rail) !== "A-")
})

test("the board shows three diverse concepts and cites only what it retrieved", async () => {
  const tastes = [
    taste("PM-047", "", { industry: "roofing", offerType: "free_inspection", feel: "integrated", grade: "A", whatWorks: "One figure on an open field." }),
    taste("PM-022", "", { industry: "general", offerType: "percent", feel: "integrated", grade: "A-", whatWorks: "One percent on one card." }),
  ]
  const spec = {
    headline: "Free roof inspection",
    offer: "$0 inspection",
    phone: "(619) 555-0148",
    website: "northline.example/book",
  }
  const directions = [0, 1, 2].map((index) => ({
    id: `d-${index}`,
    name: `Direction ${index}`,
    rationale: "One next step for this homeowner.",
    designedToDrive: "calls",
    tags: [],
    spec: { ...spec, headline: index === 0 ? spec.headline : index === 1 ? "Wind on the ridge?" : "One roof. One visit." },
    recommended: index === 0,
    createdAt: "2026-10-17T00:00:00.000Z",
  }))
  const board = await rankCandidates({
    brief: { goal: "Book a free roof inspection", offer: "$0 inspection", businessInfo: { name: "Northline Roofing", phone: "(619) 555-0148" } },
    directions,
    trim: "5x8",
    env: rulesEnv,
    records: [],
    tastes,
  })
  assert.equal(board.considered, 12)
  assert.equal(COMPOSITION_FAMILIES.length, 12)
  const familyModes = new Set(COMPOSITION_FAMILIES.map((family) => family.mode))
  assert.equal(familyModes.has("integrated") && familyModes.has("full-bleed") && familyModes.has("panel"), true)
  assert.equal(board.surfaced.length, 3)
  const surfacedModes = board.surfaced.map((item) => item.rationale.grid.intentional_break)
  assert.equal(new Set(surfacedModes).size, 3)
  for (const mode of surfacedModes) assert.equal(familyModes.has(mode as "integrated"), true, mode)
  assert.equal(surfacedModes.includes("integrated"), true)
  assert.equal(board.surfaced.some((item) => item.card.front.shapes.some((shape) => shape.role === "type-panel")), true)
  const ids = new Set(board.retrieved.map((pick) => pick.id))
  assert.equal(ids.has("PM-047"), true)
  const fewer = await rankCandidates({
    brief: { goal: "Book a free roof inspection", offer: "$0 inspection" },
    directions,
    trim: "5x8",
    env: { ...rulesEnv, DESIGN_CANDIDATE_COUNT: "6" },
    records: [],
    tastes,
  })
  assert.equal(fewer.considered, 6)
  assert.equal(fewer.surfaced.length, 3)
})

test("the fixed exam is the ten standard briefs", () => {
  assert.deepEqual(EXAM_BRIEFS.map((item) => item.id), [
    "roofing-inspection",
    "roofing-storm",
    "hvac-tuneup",
    "plumbing",
    "real-estate",
    "solar",
    "dental",
    "pest",
    "landscaping",
    "restaurant",
  ])
})

function record(id: string, imagePath: string): LibraryRecord {
  return {
    id,
    source: id.startsWith("PM-") ? "c3po" : "mando",
    images: [{ role: "front", path: imagePath, contentType: "image/jpeg" }],
    needsAnalysis: true,
  }
}

function taste(id: string, sha: string, patch: Partial<VisionTaste> = {}): VisionTaste {
  return {
    version: "1.0.0",
    id,
    origin: "vision",
    imageSha256: sha,
    imagePath: "",
    analyzedAt: "2026-10-17T00:00:00.000Z",
    model: "test",
    scoreKind: "vision",
    eyePath: "From the subject to the offer to the response.",
    focalElement: "One offer on an open field.",
    scaleRatios: { offerVersusHeadline: "Offer leads.", headlineVersusBody: "Headline is larger than body." },
    whitespace: "Open field.",
    paletteRoles: { background: "light", type: "dark", offer: "one accent", accent: "one accent" },
    typeIntegration: "Type sits on the canvas.",
    responseBlock: "One phone and one code.",
    whatWorks: "One subject and one offer.",
    grade: "A",
    industry: "general",
    offerType: "other",
    feel: "integrated",
    compositionFamily: "open-canvas-offer",
    doNotCopy: "Do not copy the mark, the amounts, the phone, the photos, or the wording.",
    ...patch,
  }
}
