import { isStockHeadline } from "./persuasion"
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
import { parseCopyEdit, rulesCopyEdit } from "./blueprint-copy-edit"
import { patternFitsOffer, templateFor } from "./blueprint-tags"
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
  assert.equal(blueprint.offerTypes.some((tag) => tag.tag === "percent_off"), true)
  assert.equal(blueprint.copyPatterns.some((tag) => tag.tag === "benefit_checklist"), true)
  assert.equal(blueprint.copyTemplate, templateFor("benefit_checklist"))
  assert.equal(/wondercide/i.test(blueprint.copyTemplate), false)
  assert.match(blueprint.copyTemplate, /\[[A-Za-z ]+\]/)
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

test("a rebuilt card keeps the font class and writes the offer into the copy pattern", async () => {
  const brief = { goal: "Book a free roof inspection", offer: "$0 inspection", businessInfo: { name: "Northline Roofing" } }
  const selection = selectReferences([], brief)
  const rationale = directDesign({ brief, selection, trim: "5x8" }).rationale
  const blueprint = fixture("PM-056", "pest_control", "friendly", "A-")
  blueprint.typeClass = "condensed-display"
  const rebuilt = await rebuildFromBlueprint({
    rationale,
    blueprint,
    spec: { headline: "See the roof before it leaks", offer: "FREE inspection", phone: "(619) 555-0148", palette: ["#F4F1EA", "#1C1C1C", "#C4552A"] },
    brief,
  })
  assert.ok(rebuilt)
  assert.equal(rebuilt.spec.blueprint?.sourceId, "PM-056")
  assert.equal(isStockHeadline(rebuilt.spec.headline ?? ""), false)
  assert.equal(rebuilt.rationale.persuasion?.outcomeGuidance, "A safe, dry home.")
  assert.equal(rebuilt.spec.subheadline, "Call today.")
  assert.equal(rebuilt.spec.headline?.includes("See the roof"), false)
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
    copyTemplate: "Maximum protection for your yard",
    front: "A photograph beside one offer.",
    back: "A benefit grid.",
    tones: [{ tag: "friendly", confidence: 0.8 }, { tag: "joyful", confidence: 0.4 }],
    verticals: [{ tag: "pest_control", confidence: 0.9 }],
    guard: { sourcePhrases: ["Maximum protection for your yard"], paletteHex: ["#12315C"] },
  }, "PM-056")
  assert.ok(parsed)
  assert.equal(parsed.origin, "vision")
  assert.equal(parsed.copyPattern, "direct_offer")
  assert.equal(parsed.copyTemplate, templateFor("direct_offer"))
  assert.equal(parsed.copyTemplate.includes("Maximum"), false)
  assert.equal(parsed.tones.length, 2)
  assert.equal(parsed.guard.sourcePhrases[0], "Maximum protection for your yard")
  assert.equal(blueprintCard(parsed).thumb, null)
})

test("an urgent Medicare enrollment mailer drives a new urgent Medicare enrollment card", async () => {
  const enrollment = tagged(fixture("MMR-M1", "medicare", "urgent", "B"), "enrollment_window", "deadline_warning")
  enrollment.guard.sourcePhrases = ["Don't miss AEP or lose your doctor"]
  const percent = tagged(fixture("MMR-M2", "medicare", "urgent", "A"), "percent_off", "direct_offer")
  const roof = tagged(fixture("MMR-R", "roofing", "urgent", "A"), "enrollment_window", "deadline_warning")
  const picked = selectBlueprints({
    blueprints: [percent, roof, enrollment],
    vertical: "medicare",
    tone: "urgent",
    offerType: "enrollment_window",
    copyPattern: "deadline_warning",
    limit: 3,
  })
  assert.equal(picked[0]?.id, "MMR-M1")
  assert.equal(picked[1]?.id, "MMR-M2")
  const fallback = selectBlueprints({
    blueprints: [enrollment, percent, roof],
    vertical: "medicare",
    tone: "urgent",
    offerType: "percent_off",
    copyPattern: "proof_led",
    limit: 1,
  })
  assert.equal(fallback[0]?.id, "MMR-M2")
  const brief = {
    goal: "Help neighbors enroll in Medicare",
    offer: "your current coverage",
    emotionalTone: "urgent",
    businessInfo: { name: "Harbor Benefits" },
  }
  const selection = selectReferences([], brief)
  const rationale = directDesign({ brief, selection, trim: "5x8" }).rationale
  const rebuilt = await rebuildFromBlueprint({
    rationale,
    blueprint: enrollment,
    spec: { headline: "Don't miss AEP or lose your doctor", offer: "your current coverage", phone: "(619) 555-0148" },
    brief,
  })
  assert.ok(rebuilt)
  assert.equal(rebuilt.spec.headline, "Annual enrollment is coming.")
  assert.equal(rebuilt.spec.subheadline, "Don't lose your current coverage.")
  assert.equal(rebuilt.spec.blueprint?.offerType, "enrollment_window")
  assert.equal(rebuilt.spec.blueprint?.copyPattern, "deadline_warning")
  assert.equal(rebuilt.rationale.font_pairing, "letter")
  const written = `${rebuilt.spec.headline} ${rebuilt.spec.subheadline}`
  assert.equal(ngramOverlap(written, enrollment.guard.sourcePhrases), 0)
  assert.equal(/aep|doctor/i.test(written), false)
})

test("deadline-loss framing is not forced onto a free inspection", async () => {
  assert.equal(patternFitsOffer("deadline_warning", "free_inspection"), false)
  assert.equal(patternFitsOffer("deadline_warning", "enrollment_window"), true)
  const rejected = rulesCopyEdit({
    headline: "The deadline is coming.",
    subheadline: "Don't lose FREE inspection.",
    offer: "FREE inspection",
    offerType: "free_inspection",
    pattern: "deadline_warning",
  })
  assert.equal(rejected.ok, false)
  const kept = rulesCopyEdit({
    headline: "Annual enrollment is coming.",
    subheadline: "Don't lose your current coverage.",
    offer: "your current coverage",
    offerType: "enrollment_window",
    pattern: "deadline_warning",
  })
  assert.equal(kept.ok, true)
  const deadline = tagged(fixture("PM-054", "home_services", "professional", "A-"), "percent_off", "deadline_warning")
  const brief = { goal: "Book a free roof inspection", offer: "FREE inspection", businessInfo: { name: "Northline Roofing" } }
  const selection = selectReferences([], brief)
  const rationale = directDesign({ brief, selection, trim: "5x8" }).rationale
  const seen: string[] = []
  const rebuilt = await rebuildFromBlueprint({
    rationale,
    blueprint: deadline,
    spec: { headline: "See the roof before it leaks", offer: "FREE inspection", phone: "(619) 555-0148" },
    brief,
    edit: async (draft) => {
      seen.push(`${draft.headline} ${draft.subheadline ?? ""}`)
      return { ok: true, headline: "A free roof inspection.", subheadline: "Call today." }
    },
  })
  assert.ok(rebuilt)
  const written = `${rebuilt.spec.headline} ${rebuilt.spec.subheadline ?? ""}`
  assert.equal(/don'?t lose/i.test(written), false)
  assert.equal(isStockHeadline(rebuilt.spec.headline ?? ""), false)
  assert.equal(rebuilt.spec.blueprint?.copyPattern === "deadline_warning", false)
  assert.equal(seen.some((line) => /don'?t lose/i.test(line)), false)
  assert.equal(isStockHeadline(rebuilt.spec.headline ?? ""), false)
  assert.equal(rebuilt.rationale.persuasion?.outcomeGuidance, "A safe, dry home.")
})

test("a copy editor can reject one pattern and the next fitting pattern is used", async () => {
  const blueprint = tagged(fixture("MMR-Q", "roofing", "urgent", "B"), "free_inspection", "question_headline")
  blueprint.copyPatterns.push({ tag: "direct_offer", confidence: 0.4 })
  const brief = { goal: "Book a free roof inspection", offer: "FREE inspection" }
  const selection = selectReferences([], brief)
  const rationale = directDesign({ brief, selection, trim: "5x8" }).rationale
  let calls = 0
  const rebuilt = await rebuildFromBlueprint({
    rationale,
    blueprint,
    spec: { offer: "FREE inspection" },
    brief,
    edit: async (draft) => {
      calls += 1
      if (draft.pattern === "question_headline") return { ok: false, reason: "A question does not fit this inspection offer." }
      return { ok: true, headline: draft.headline, subheadline: "Call today to book it." }
    },
  })
  assert.ok(rebuilt)
  assert.equal(calls >= 2, true)
  assert.equal(rebuilt.spec.blueprint?.copyPattern, "direct_offer")
  assert.equal(rebuilt.spec.subheadline, "Call today to book it.")
  assert.equal(/don'?t lose/i.test(`${rebuilt.spec.headline} ${rebuilt.spec.subheadline}`), false)
})

test("a copy-editor response parses a rewrite and a rejection", () => {
  const rewrite = parseCopyEdit({ ok: true, headline: "A free roof inspection.", subheadline: "Call today." })
  assert.equal(rewrite?.ok, true)
  assert.equal(rewrite?.headline, "A free roof inspection.")
  const rejection = parseCopyEdit({ ok: false, reason: "Loss framing does not fit a free inspection." })
  assert.equal(rejection?.ok, false)
  assert.match(rejection?.reason ?? "", /free inspection/)
})

test("a vision reading can propose a tag and cannot store the source wording as the template", () => {
  const parsed = parseVisionBlueprint({
    grade: "B",
    boxes: [
      { role: "photo", face: "front", x: 0, y: 0, w: 1, h: 1 },
      { role: "headline", face: "front", x: 0.08, y: 0.1, w: 0.5, h: 0.2 },
    ],
    devices: ["full-bleed"],
    copyPattern: "mystery-launch",
    offerTypes: [],
    copyPatterns: [],
    proposedTags: [
      { kind: "offer_type", tag: "trial_period", reason: "A short trial that is not in the list." },
      { kind: "copy_pattern", tag: "AEP slogan", reason: "Don't miss AEP" },
      { kind: "copy_pattern", tag: "trial_countdown", reason: "A countdown.", template: "Don't miss AEP today" },
      { kind: "copy_pattern", tag: "countdown_line", reason: "A countdown with no listed pattern.", template: "[Deadline] is coming. Call today." },
    ],
    tones: [{ tag: "urgent", confidence: 0.8 }],
    verticals: [{ tag: "medicare", confidence: 0.9 }],
    guard: { sourcePhrases: ["Don't miss AEP"] },
  }, "MMR-9")
  assert.ok(parsed)
  assert.equal(parsed.offerTypes.length, 0)
  assert.equal(parsed.proposedTags.some((tag) => tag.tag === "trial_period"), true)
  assert.equal(parsed.proposedTags.some((tag) => /aep/i.test(tag.tag)), false)
  assert.equal(parsed.proposedTags.some((tag) => tag.tag === "countdown_line" && tag.template?.includes("[Deadline]")), true)
  assert.equal(parsed.copyTemplate, "[Deadline] is coming. Call today.")
  assert.equal(/aep/i.test(parsed.copyTemplate), false)
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

function tagged(
  blueprint: MailerBlueprint,
  offer: MailerBlueprint["offerTypes"][number]["tag"],
  pattern: MailerBlueprint["copyPatterns"][number]["tag"],
): MailerBlueprint {
  blueprint.offerTypes = [{ tag: offer, confidence: 0.9 }]
  blueprint.copyPatterns = [{ tag: pattern, confidence: 0.9 }]
  blueprint.copyPattern = pattern
  blueprint.copyTemplate = templateFor(pattern)
  blueprint.proposedTags = []
  return blueprint
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
