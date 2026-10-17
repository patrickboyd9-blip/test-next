import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"

import type { CreativeDirection } from "@/lib/campaign-creator/types"
import { createFileDocumentStore } from "@/lib/storage/document-store"

import { directDesign } from "./art-director"
import { candidateCount, familiesForCount, pickDiverse, scoreCandidates, type ScoredCandidate } from "./candidates"
import { composeDirectedCard, rationaleForFamily } from "./composition-family"
import { rectsOverlap } from "./composition-read"
import { critiqueCard } from "./critic"
import { EXAM_BRIEFS } from "./exam"
import { saveConceptVote, loadTasteSignals } from "./feedback"
import { textInsideSafe } from "./grid-composer"
import { selectReferences } from "./select"
import { parseTasteAnalysis, scrub, tasteFromWrittenNotes } from "./taste"
import { backfillDesignTaste } from "./taste-backfill"
import { mergeTaste, retrieveTaste } from "./taste-retrieval"
import { tasteVisionSystem, visionCriticSystem } from "./taste-vision"
import { loadSeedAnalyses } from "./library"

const rulesEnv = { DESIGN_DIRECTOR: "rules", DESIGN_CRITIC: "machine", DESIGN_TASTE: "off" } as unknown as NodeJS.ProcessEnv

test("a vision reading is grounded and drops phones, prices, and private ids", () => {
  assert.equal(scrub("Call 858-358-6454 about $90 today"), "Call about a price today")
  const parsed = parseTasteAnalysis(
    "PM-900",
    {
      eyePath: "From the subject to the offer to the response.",
      focalElement: "One price figure on a light ground.",
      scaleRatios: { offerToHeadline: "The offer is about twice the headline.", headlineToBody: "The headline is about three times the body." },
      whitespace: "Most of the card is open ground.",
      paletteRoles: { ground: "Light paper", type: "Near-black", accent: "One green" },
      typeIntegration: "on_open_canvas",
      responseBlock: "Phone and code in one group.",
      whatMakesItWork: "Type sits on the open ground and the subject is cut in.",
      grade: "A",
      industry: "roofing",
      offerType: "numeral",
      feel: "integrated",
      compositionFamily: "cutout",
    },
    { model: "test", analyzedAt: "2026-10-17T00:00:00.000Z" }
  )
  assert.ok(parsed)
  assert.equal(parsed?.groundedBy, "vision")
  assert.equal(parseTasteAnalysis("private-note", { eyePath: "long enough path" }, { model: "test", analyzedAt: "now" }), null)
  assert.match(tasteVisionSystem(), /B-minus/)
  assert.match(visionCriticSystem(), /B-minus/)
  assert.match(visionCriticSystem(), /light ground/)
})

test("panel cards land at B-minus or C-plus and an open card lands at A", async () => {
  const brief = {
    goal: "Book roof inspections",
    offer: "$0 inspection",
    phone: "(619) 555-0148",
    website: "northline.example/book",
    businessInfo: { name: "Northline Roofing" },
    audience: { description: "Homeowners who have not had anyone on the roof" },
  }
  const spec = {
    headline: "Wind damage? Free roof check.",
    offer: "$0 inspection",
    phone: brief.phone,
    website: brief.website,
  }
  const selection = selectReferences([], brief)
  const base = directDesign({ brief, selection, trim: "5x8" }).rationale
  const panel = composeDirectedCard({ rationale: rationaleForFamily(base, "panel-left"), spec, businessName: "Northline Roofing" })
  const panelCritique = critiqueCard(panel, rationaleForFamily(base, "panel-left"), `${spec.headline} ${spec.offer}`)
  assert.ok(panelCritique.letter === "B-" || panelCritique.letter === "C+", panelCritique.letter)
  assert.equal(panelCritique.passed, false)
  assert.match(panelCritique.explanation, /Grade:/)
  assert.equal(panelCritique.scoreKind, "machine estimate")

  const boxed = composeDirectedCard({ rationale: rationaleForFamily(base, "boxed-card"), spec, businessName: "Northline Roofing" })
  const boxedCritique = critiqueCard(boxed, rationaleForFamily(base, "boxed-card"), `${spec.headline} ${spec.offer}`)
  assert.equal(boxedCritique.letter, "C+")

  for (const family of ["cutout-right", "cutout-left", "stacked-open", "offer-float"] as const) {
    const rationale = rationaleForFamily(base, family)
    const card = composeDirectedCard({ rationale, spec, businessName: "Northline Roofing" })
    const critique = critiqueCard(card, rationale, `${spec.headline} ${spec.offer}`)
    assert.equal(critique.autoFails.join(","), "", family)
    assert.equal(critique.letter, "A", `${family} ${critique.letter} ${critique.visionScore} ${critique.explanation}`)
    assert.equal(critique.passed, true, family)
    assert.ok(card.front.texts.every((text) => textInsideSafe(text.rect, "5x8")), family)
    const texts = card.front.texts.filter((text) => text.text.trim())
    const mirrored = [card.front.lockup?.phone, card.front.lockup?.website].filter((text) => text?.text)
    const occupied = [
      ...texts,
      ...mirrored.filter((text) => !texts.some((existing) => existing.text === text!.text && rectsOverlap(existing.rect, text!.rect, -0.05))),
    ]
    for (let i = 0; i < occupied.length; i += 1) {
      for (let j = i + 1; j < occupied.length; j += 1) {
        assert.equal(rectsOverlap(occupied[i]!.rect, occupied[j]!.rect, 0.02), false, `${family} type overlap`)
      }
      for (const photo of card.front.photos) {
        assert.equal(rectsOverlap(occupied[i]!.rect, photo.rect, 0.02), false, `${family} type on photo`)
      }
    }
  }
})

test("twelve candidates keep three diverse cards and cite only what was retrieved", async () => {
  assert.equal(candidateCount(rulesEnv), 12)
  assert.equal(familiesForCount(12).length, 12)
  assert.equal(new Set(familiesForCount(12)).size >= 6, true)
  const brief = EXAM_BRIEFS[1]!
  const direction: CreativeDirection = {
    id: "roof",
    name: "Storm",
    rationale: "Storm",
    designedToDrive: "inspections",
    tags: [],
    spec: brief.spec,
    recommended: true,
    createdAt: "2026-10-17T00:00:00.000Z",
  }
  const result = await scoreCandidates({
    brief: brief.brief,
    directions: [direction, { ...direction, id: "roof-b" }, { ...direction, id: "roof-c" }],
    trim: brief.trim,
    records: [],
    env: rulesEnv,
    businessName: "Northline Roofing",
  })
  assert.equal(result.candidates.length, 3)
  assert.equal(new Set(result.candidates.map((item) => item.family)).size, 3)
  assert.equal(result.candidates[0]?.recommended, true)
  assert.equal(result.candidates[0]?.critique.passed, true)
  const ids = new Set(result.retrieved.map((item) => item.id))
  for (const candidate of result.candidates) {
    for (const cite of candidate.cites) assert.equal(ids.has(cite.id), true, cite.id)
  }
  assert.equal(result.candidates[0]?.cites.length > 0, true)
})

test("a thumbs-down changes what the next brief retrieves", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "taste-feedback-"))
  const store = createFileDocumentStore(directory)
  const notes = tasteFromWrittenNotes(loadSeedAnalyses().find((item) => item.id === "PM-047")!)
  assert.ok(notes)
  const voteBrief = { goal: "Book a roof inspection", offer: "Free inspection" }
  const voteBase = directDesign({ brief: voteBrief, selection: selectReferences([], voteBrief), trim: "5x8" }).rationale
  await saveConceptVote({
    userId: "owner@example.com",
    campaignId: "camp-1",
    directionId: "dir-1",
    vote: "down",
    reason: "The cut-out does not fit this offer.",
    brief: voteBrief,
    now: "2026-10-17T00:00:00.000Z",
    rationale: rationaleForFamily(voteBase, "cutout-right"),
  }, store)
  const signals = await loadTasteSignals("owner@example.com", store)
  assert.equal(signals.length, 1)
  assert.equal(signals[0]?.vote, "down")
  assert.equal(signals[0]?.reason, "The cut-out does not fit this offer.")
  const panel = tasteFromWrittenNotes(loadSeedAnalyses().find((item) => item.id === "PM-047")!)
  const open = tasteFromWrittenNotes(loadSeedAnalyses().find((item) => item.id === "PM-022")!)
  assert.ok(panel && open)
  panel.feel = "panel"
  panel.typeIntegration = "on_panel"
  panel.grade = "A"
  open.feel = "integrated"
  open.typeIntegration = "on_open_canvas"
  open.grade = "A-"
  const pool = mergeTaste([], [panel, open])
  const without = retrieveTaste({ analyses: pool, brief: { goal: "Book a roof inspection", offer: "Free inspection" }, limit: 2 })
  const withSignal = retrieveTaste({
    analyses: pool,
    brief: { goal: "Book a roof inspection", offer: "Free inspection" },
    signals,
    limit: 2,
  })
  assert.equal(without[0]?.id, "PM-022")
  assert.equal(withSignal[0]?.id, "PM-047")
  assert.equal(signals[0]?.feel, "integrated")
  await rm(directory, { recursive: true })
})

test("backfill analyzes a batch, skips private files, and does not repeat", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "taste-root-"))
  const storeDir = await mkdtemp(path.join(os.tmpdir(), "taste-store-"))
  await mkdir(path.join(root, "mando", "images"), { recursive: true })
  await mkdir(path.join(root, "c3po", "assets", "physical", "private"), { recursive: true })
  await writeFile(path.join(root, "mando", "images", "index.json"), JSON.stringify([
    { mmr_id: "MMR-019", path: "images/MMR-019.jpg", side: "front" },
    { mmr_id: "MMR-020", path: "images/MMR-020.jpg", side: "front" },
    { mmr_id: "MMR-900", path: "private/MMR-900.jpg" },
  ]))
  await writeFile(path.join(root, "mando", "images", "MMR-019.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
  await writeFile(path.join(root, "mando", "images", "MMR-020.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
  await writeFile(path.join(root, "c3po", "assets", "physical", "private", "secret.jpg"), Buffer.from([0xff, 0xd8]))
  const store = createFileDocumentStore(storeDir)
  const seen: string[] = []
  const report = await backfillDesignTaste({
    root,
    store,
    batch: 1,
    env: rulesEnv,
    now: "2026-10-17T00:00:00.000Z",
    analyze: async (job) => {
      seen.push(job.id)
      return parseTasteAnalysis(job.id, {
        eyePath: "From the subject to the offer to the response.",
        focalElement: "One offer on a light ground.",
        scaleRatios: { offerToHeadline: "Offer leads the headline.", headlineToBody: "Headline leads the body." },
        whitespace: "Open ground.",
        paletteRoles: { ground: "Light", type: "Dark", accent: "One accent" },
        typeIntegration: "on_open_canvas",
        responseBlock: "One response group.",
        whatMakesItWork: "The offer sits on the open ground.",
        grade: "A",
        industry: "roofing",
        offerType: "free",
        feel: "integrated",
        compositionFamily: "cutout",
      }, { model: "test", analyzedAt: "2026-10-17T00:00:00.000Z" })
    },
  })
  assert.equal(seen.length, 1)
  assert.equal(report.analyzed.length, 1)
  assert.ok(report.remaining >= 1)
  assert.equal(report.skippedPrivate.some((file) => file.includes("private")), true)
  const again = await backfillDesignTaste({
    root,
    store,
    batch: 1,
    env: rulesEnv,
    analyze: async (job) => {
      assert.notEqual(job.id, report.analyzed[0])
      return parseTasteAnalysis(job.id, {
        eyePath: "From the subject to the offer to the response.",
        focalElement: "One offer on a light ground.",
        scaleRatios: { offerToHeadline: "Offer leads the headline.", headlineToBody: "Headline leads the body." },
        whitespace: "Open ground.",
        paletteRoles: { ground: "Light", type: "Dark", accent: "One accent" },
        typeIntegration: "on_panel",
        responseBlock: "One response group.",
        whatMakesItWork: "A second reading.",
        grade: "B+",
        industry: "plumbing",
        offerType: "numeral",
        feel: "panel",
        compositionFamily: "panel",
      }, { model: "test", analyzedAt: "2026-10-17T00:00:00.000Z" })
    },
  })
  assert.equal(again.analyzed.length, 1)
  assert.notEqual(again.analyzed[0], report.analyzed[0])
  assert.equal(EXAM_BRIEFS.length, 10)
  await rm(root, { recursive: true })
  await rm(storeDir, { recursive: true })
})

test("diverse picking drops a second card from the same family", () => {
  const made = (family: ScoredCandidate["family"], score: number, passed: boolean): ScoredCandidate => ({
    sourceId: family,
    source: {
      id: family,
      name: family,
      rationale: family,
      designedToDrive: "calls",
      tags: [],
      spec: { headline: "One line here." },
      recommended: false,
      createdAt: "2026-10-17T00:00:00.000Z",
    },
    family,
    rationale: rationaleForFamily(
      directDesign({
        brief: { goal: "Book roof inspections", offer: "$0 inspection" },
        selection: selectReferences([], { goal: "Book roof inspections", offer: "$0 inspection" }),
        trim: "5x8",
      }).rationale,
      family
    ),
    card: {} as ScoredCandidate["card"],
    critique: {
      autoFails: [],
      dimensions: { D1: 9, D2: 9, D3: 9, D4: 9, D5: 9, D6: 9 },
      weighted: score / 10,
      vision: {},
      visionScore: score,
      passed,
      edit: null,
      brokenRule: null,
      letter: passed ? "A" : "B-",
      explanation: "Grade.",
      scoreKind: "machine estimate",
    },
    cites: [],
    costs: [],
    edits: [],
    recommended: false,
  })
  const picked = pickDiverse([
    made("cutout-right", 92, true),
    made("cutout-right", 91, true),
    made("cutout-left", 90, true),
    made("panel-left", 71, false),
  ], 3, [{ id: "PM-047", grade: "A", principle: "One offer on an open ground.", doNotCopy: "Do not copy the mark.", industry: "general_local_service", offerType: "numeral", feel: "integrated", typeIntegration: "on_open_canvas", groundedBy: "written-notes" }])
  assert.deepEqual(picked.map((item) => item.family), ["cutout-right", "cutout-left", "panel-left"])
  assert.deepEqual(picked[0]?.cites.map((cite) => cite.id), ["PM-047"])
})
