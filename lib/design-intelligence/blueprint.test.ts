import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"

import { createFileDocumentStore } from "@/lib/storage/document-store"

import { directDesign } from "./art-director"
import {
  blueprintCard,
  parseVisionBlueprint,
  selectBlueprints,
  structuralBlueprint,
  type MailerBlueprint,
} from "./blueprint"
import { backfillBlueprints } from "./blueprint-store"
import { guardRebuild, matchesTradeDress, ngramOverlap } from "./blueprint-guard"
import { rebuildFromBlueprint } from "./blueprint-rebuild"
import { rankCandidates } from "./candidate-board"
import { examToneVariants, EXAM_BRIEFS } from "./exam"
import { loadSeedAnalyses, type LibraryRecord } from "./library"
import { selectReferences } from "./select"

const rulesEnv = { DESIGN_DIRECTOR: "rules", DESIGN_CRITIC: "machine", DESIGN_CANDIDATE_RENDERS: "off" } as NodeJS.ProcessEnv

test("Wondercide becomes a structure, not a copy of the mailer", () => {
  const analysis = loadSeedAnalyses().find((item) => item.id === "PM-056")
  assert.ok(analysis)
  const blueprint = structuralBlueprint({
    id: "PM-056",
    source: "seed",
    analysis,
    images: [],
    grade: analysis.grade,
    needsAnalysis: false,
  })
  assert.ok(blueprint)
  assert.equal(blueprint.typeClass, "condensed-display")
  assert.equal(blueprint.devices.includes("icon-grid"), true)
  assert.equal(blueprint.devices.includes("color-blocked-offer"), true)
  assert.equal(blueprint.verticals.some((tag) => tag.tag === "pest_control"), true)
  assert.ok(blueprint.tones.length > 1 || blueprint.tones[0])
  assert.equal(blueprint.guard.paletteHex.length, 0)
  const card = blueprintCard(blueprint)
  assert.equal(card.thumb, null)
  assert.equal(JSON.stringify(card).includes("#"), false)
})

test("private paths and anti-examples are not blueprints", () => {
  assert.equal(structuralBlueprint(record("PM-011", { use_class: "anti_example" })), null)
  assert.equal(structuralBlueprint({
    id: "PM-099",
    source: "c3po",
    images: [{ role: "front", path: "assets/physical/private/front.jpg", contentType: "image/jpeg" }],
    needsAnalysis: false,
  }), null)
})

test("retrieval prefers the vertical and tone, then a tone match from another vertical, and weights a favorite", () => {
  const roof = fixture("MMR-1", "roofing", "urgent", "B")
  const pest = fixture("PM-056", "pest_control", "joyful", "A-")
  const other = fixture("MMR-2", "plumbing", "urgent", "A")
  const joyfulRoof = fixture("MMR-3", "roofing", "joyful", "B")
  const picked = selectBlueprints({
    blueprints: [roof, pest, other, joyfulRoof],
    vertical: "roofing",
    tone: "joyful",
    favorites: ["PM-056"],
    limit: 3,
  })
  assert.equal(picked[0]?.id, "MMR-3")
  assert.equal(picked[1]?.id, "PM-056")
  assert.equal(picked.some((item) => item.id === "MMR-2"), false)
})

test("a copied phrase, a protected color pair, or a too-close card is perturbed", () => {
  const blueprint = fixture("PM-056", "pest_control", "joyful", "A-")
  assert.equal(ngramOverlap("Maximum protection for your yard today", ["Maximum protection for your yard today"]), 1)
  assert.equal(matchesTradeDress(["#12315C", "#C6D94A", "#FFFFFF"]), true)
  const guarded = guardRebuild({
    sourceId: "PM-056",
    boxes: blueprint.boxes,
    devices: blueprint.devices,
    guard: {
      sourcePhrases: ["Maximum protection for your yard today"],
      paletteHex: ["#12315C", "#C6D94A"],
      imageHash: null,
    },
    neutrals: ["#12315C", "#FFFFFF"],
    accent: "#C6D94A",
    spec: { headline: "Maximum protection for your yard today", offer: "20% OFF" },
  })
  assert.equal(guarded.similarity.perturbed, true)
  assert.equal(guarded.similarity.tradeDress, false)
  assert.equal(guarded.similarity.ngram, 0)
  assert.notEqual(guarded.spec.headline, "Maximum protection for your yard today")
  assert.ok(guarded.similarity.score < 0.95)
})

test("a rebuilt card keeps the font class and the campaign's words", () => {
  const brief = { goal: "Book a free roof inspection", offer: "$0 inspection", businessInfo: { name: "Northline Roofing" } }
  const selection = selectReferences([], brief)
  const rationale = directDesign({ brief, selection, trim: "5x8" }).rationale
  const blueprint = fixture("PM-056", "pest_control", "friendly", "A-")
  blueprint.typeClass = "condensed-display"
  const rebuilt = rebuildFromBlueprint({
    rationale,
    blueprint,
    spec: { headline: "See the roof before it leaks", offer: "FREE inspection", phone: "(619) 555-0148", palette: ["#F4F1EA", "#1C1C1C", "#C4552A"] },
    brief,
  })
  assert.ok(rebuilt)
  assert.equal(rebuilt.spec.blueprint?.sourceId, "PM-056")
  assert.equal(rebuilt.spec.headline, "See the roof before it leaks")
  assert.equal(rebuilt.rationale.font_pairing, "signal")
  assert.match(rebuilt.rationale.type_pairing.display, /Barlow Condensed/)
  assert.equal(rebuilt.rationale.palette.accent_hex.toLowerCase(), "#c4552a")
})

test("at least half of the candidate board is rebuilt from blueprints", async () => {
  const analysis = loadSeedAnalyses().find((item) => item.id === "PM-056")
  assert.ok(analysis)
  const records: LibraryRecord[] = ["PM-056", "PM-047", "PM-022", "PM-054"].flatMap((id) => {
    const item = loadSeedAnalyses().find((analysisItem) => analysisItem.id === id)
    if (!item) return []
    return [{
      id,
      source: "seed" as const,
      analysis: item,
      images: [],
      grade: item.grade,
      needsAnalysis: false,
    }]
  })
  const directions = [0, 1, 2].map((index) => ({
    id: `d-${index}`,
    name: `Direction ${index}`,
    rationale: "One next step.",
    designedToDrive: "calls",
    tags: [],
    spec: { headline: "Free roof inspection", offer: "$0 inspection", phone: "(619) 555-0148" },
    recommended: index === 0,
    createdAt: "2026-10-17T00:00:00.000Z",
  }))
  const board = await rankCandidates({
    brief: { goal: "Book a free roof inspection", offer: "$0 inspection", emotionalTone: "urgent", businessInfo: { name: "Northline" } },
    directions,
    trim: "5x8",
    env: rulesEnv,
    records,
    tastes: [],
    blueprints: records.flatMap((record) => {
      const blueprint = structuralBlueprint(record)
      return blueprint ? [blueprint] : []
    }),
  })
  assert.equal(board.considered, 12)
  assert.ok(board.blueprintCount >= 6, `blueprint count ${board.blueprintCount}`)
  assert.equal(board.surfaced.length, 3)
})

test("a vision payload becomes a blueprint and drops nothing required", () => {
  const parsed = parseVisionBlueprint({
    grade: "A-",
    boxes: [
      { role: "photo", face: "front", x: 0, y: 0, w: 0.6, h: 1 },
      { role: "offer", face: "front", x: 0.62, y: 0.1, w: 0.3, h: 0.3 },
    ],
    scale: { offerToHeadline: 1.8, headlineToBody: 3, photoShare: 0.6 },
    paletteRoles: { dominant: "dark", accent: "saturated", neutral: "light" },
    typeClass: "condensed-display",
    devices: ["color-blocked-offer", "icon-grid"],
    copyPattern: "offer-led",
    front: "A photograph beside one offer.",
    back: "A benefit grid.",
    tones: [{ tag: "friendly", confidence: 0.8 }, { tag: "joyful", confidence: 0.4 }],
    verticals: [{ tag: "pest_control", confidence: 0.9 }],
    guard: { sourcePhrases: ["Maximum protection for your yard"], paletteHex: ["#12315C"] },
  }, "PM-056")
  assert.ok(parsed)
  assert.equal(parsed.origin, "vision")
  assert.equal(parsed.tones.length, 2)
  assert.equal(parsed.guard.sourcePhrases[0], "Maximum protection for your yard")
  assert.equal(blueprintCard(parsed).thumb, null)
})

test("the exam adds one tone variant for each standard brief", () => {
  const variants = examToneVariants()
  assert.equal(variants.length, EXAM_BRIEFS.length)
  assert.equal(new Set(variants.map((item) => item.id)).size, EXAM_BRIEFS.length)
  assert.equal(variants[0]?.brief.emotionalTone, "urgent")
  assert.equal(variants[1]?.brief.emotionalTone, "fearful")
  assert.notEqual(variants[0]?.id, EXAM_BRIEFS[0]?.id)
})

test("backfill stores structural blueprints without a vision key", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprints-"))
  try {
    const store = createFileDocumentStore(root)
    const report = await backfillBlueprints({
      env: {} as NodeJS.ProcessEnv,
      store,
      records: [{
        id: "PM-056",
        source: "seed",
        analysis: loadSeedAnalyses().find((item) => item.id === "PM-056"),
        images: [],
        grade: "A-",
        needsAnalysis: false,
      }],
    })
    assert.deepEqual(report.structural, ["PM-056"])
    assert.deepEqual(report.vision, [])
    const stored = await store.get("PM-056") as MailerBlueprint
    assert.equal(stored.origin, "structural")
    assert.equal(stored.sourceId, "PM-056")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

function record(id: string, analysis: LibraryRecord["analysis"]): LibraryRecord {
  return { id, source: "seed", analysis, images: [], needsAnalysis: false }
}

function fixture(id: string, vertical: MailerBlueprint["verticals"][number]["tag"], tone: MailerBlueprint["tones"][number]["tag"], grade: string): MailerBlueprint {
  const blueprint = structuralBlueprint({
    id,
    source: "seed",
    analysis: {
      id,
      vertical,
      grade,
      summary: `${tone} ${vertical} mailer with a photograph and one offer.`,
      focal_point: "One photograph.",
    },
    images: [],
    grade,
    needsAnalysis: false,
  })
  if (!blueprint) throw new Error(id)
  blueprint.tones = [{ tag: tone, confidence: 0.9 }]
  blueprint.verticals = [{ tag: vertical, confidence: 0.9 }]
  return blueprint
}
