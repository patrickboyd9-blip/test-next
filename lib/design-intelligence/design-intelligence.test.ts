import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"

import { campaignForCustomer } from "@/lib/campaign-creator/customer-campaign"
import type { Campaign, CampaignBrief, CreativeSpec } from "@/lib/campaign-creator/types"
import { createFileDocumentStore } from "@/lib/storage/document-store"

import { directDesign } from "./art-director"
import { critiqueCard } from "./critic"
import { BENCHMARK_BRIEFS } from "./benchmark"
import { composeGridCard, textInsideSafe } from "./grid-composer"
import {
  discoverLocalImages,
  loadSeedAnalyses,
  localReferenceRoot,
} from "./library"
import { criticUsesVision, directOneCard, directorMode } from "./pipeline"
import { validateDesignRationale } from "./rationale"
import { selectReferences } from "./select"
import { checkSimilarity } from "./similarity"
import {
  entriesFromC3poManifest,
  entriesFromMandoIndex,
  entriesFromPhysicalTree,
  syncReferenceLibraries,
  type GithubReader,
} from "./sync"
import roofingExample from "./seed/examples/roofing.json"
import plumbingExample from "./seed/examples/plumbing.json"
import medicareExample from "./seed/examples/medicare.json"

const rulesEnv = { DESIGN_DIRECTOR: "rules", DESIGN_CRITIC: "machine" } as unknown as NodeJS.ProcessEnv

test("the vision director and critic run when the API key is set", () => {
  const key = { ANTHROPIC_API_KEY: "test-key" } as unknown as NodeJS.ProcessEnv
  assert.equal(directorMode(key), "model")
  assert.equal(criticUsesVision(key), true)
  assert.equal(directorMode({} as NodeJS.ProcessEnv), "rules")
  assert.equal(criticUsesVision({} as NodeJS.ProcessEnv), false)
  assert.equal(directorMode({ ...key, DESIGN_DIRECTOR: "rules" }), "rules")
  assert.equal(criticUsesVision({ ...key, DESIGN_CRITIC: "machine" }), false)
})

test("the seed holds every written analysis", () => {
  const analyses = loadSeedAnalyses()
  assert.equal(analyses.length, 91)
  for (const id of ["PM-047", "PM-054", "PM-022", "MMR-513", "MMR-047", "PM-011"]) {
    assert.ok(analyses.some((analysis) => analysis.id === id), id)
  }
})

test("schema examples validate and a short offer ratio does not", () => {
  for (const example of [roofingExample, plumbingExample, medicareExample]) {
    const result = validateDesignRationale(example)
    assert.equal(result.ok, true, result.ok ? "" : result.errors.join(" "))
  }
  const broken = structuredClone(roofingExample) as { scale_ratios: { offer_to_headline_cap: number } }
  broken.scale_ratios.offer_to_headline_cap = 1.2
  const rejected = validateDesignRationale(broken)
  assert.equal(rejected.ok, false)
})

test("anchors are included and anti-examples are only don'ts", () => {
  const records = loadSeedAnalyses().map((analysis) => ({
    id: analysis.id,
    source: "seed" as const,
    analysis,
    images: [],
    vertical: analysis.vertical,
    grade: analysis.grade,
    needsAnalysis: false,
  }))
  const selection = selectReferences(records, { goal: "Book roof inspections", offer: "$0 inspection" })
  assert.deepEqual(selection.anchors.map((item) => item.id), ["PM-047", "PM-054", "PM-022"])
  assert.ok(selection.donts.some((item) => item.id === "MMR-513"))
  assert.ok(selection.donts.some((item) => item.id === "MMR-047"))
  assert.ok(selection.donts.some((item) => item.id === "PM-011"))
  assert.equal(selection.peers.some((item) => item.role === "dont"), false)
  assert.equal(selection.imageIds.includes("MMR-513"), false)
})

test("medicare stays compliance-calm with no deadline", () => {
  const brief: CampaignBrief = {
    goal: "Book a Medicare plan review",
    offer: "Free plan review",
    audience: { description: "People who want a local explanation of their choices" },
  }
  const selection = selectReferences([], brief)
  const result = directDesign({ brief, selection, trim: "6x9" })
  assert.equal(result.rationale.vertical, "medicare_insurance")
  assert.equal(result.rationale.palette.emotion, "compliance_calm")
  assert.equal(result.rationale.offer_treatment.expiry, "none")
  assert.equal(result.rationale.scale_ratios.hero, "headline")
  assert.ok(result.rationale.palette.banned.some((item) => /eagle|notice/i.test(item)))
})

test("the grid card keeps phone, website, scan line, ratio, and safe type", async () => {
  const brief: CampaignBrief = {
    goal: "Book roof inspections",
    offer: "$0 inspection",
    phone: "(619) 555-0148",
    website: "northline.example/book",
    businessInfo: { name: "Northline Roofing" },
    audience: { description: "Homeowners who have not had anyone on the roof" },
  }
  const spec: CreativeSpec = {
    headline: "Wind damage? Free roof check.",
    offer: "$0 inspection",
    phone: brief.phone,
    website: brief.website,
    callToAction: "Call or scan to book",
  }
  const directed = await directOneCard({
    brief,
    spec,
    trim: "5x8",
    businessName: "Northline Roofing",
    records: [],
    env: rulesEnv,
    cardId: "roof",
  })
  const card = directed.card
  assert.equal(card.front.lockup?.qrLabel, "Scan to book")
  assert.ok((card.front.lockup?.qrInches ?? 0) >= 0.75)
  assert.match(card.front.lockup?.phone?.text ?? "", /555-0148/)
  assert.match(card.front.texts.map((text) => text.text).join(" "), /northline\.example\/book/)
  assert.ok(card.front.texts.every((text) => textInsideSafe(text.rect, "5x8")))
  assert.ok(textInsideSafe(card.front.lockup!.rect, "5x8"))
  const offer = card.front.texts.find((text) => text.role === "offer")
  const headline = card.front.texts.find((text) => text.role === "headline")
  assert.ok(offer && headline)
  assert.ok(offer.fontPt >= headline.fontPt * 1.55)
  assert.equal(card.front.shapes.some((shape) => shape.role === "starburst"), false)
  assert.equal(directed.critique.autoFails.includes("AF10"), false)
  assert.equal(directed.critique.autoFails.includes("AF1"), false)
  assert.equal(directed.critique.scoreKind, "machine estimate")
  assert.ok(directed.critique.visionScore > 40)
  const wide = composeGridCard({
    rationale: { ...directed.rationale, format: { trim: "6x9", orientation: "landscape" } },
    spec,
    businessName: "Northline Roofing",
  })
  assert.ok(wide.back.texts.every((text) => textInsideSafe(text.rect, "6x9")))
})

test("dark type on the photograph hard-fails and scores well below an A", async () => {
  const brief: CampaignBrief = {
    goal: "Book roof replacement estimates",
    offer: "$500 off",
    phone: "(619) 555-0148",
    website: "northline.example/book",
  }
  const directed = await directOneCard({
    brief,
    spec: {
      headline: "See The Ceiling Stain",
      offer: "$500 off",
      phone: brief.phone,
      website: brief.website,
    },
    trim: "5x8",
    records: [],
    env: rulesEnv,
    cardId: "ceiling",
  })
  const trim = { x: 0, y: 0, w: 8, h: 5 }
  const covered = {
    ...directed.card,
    front: {
      ...directed.card.front,
      photos: [{ id: "photo", role: "photo" as const, rect: trim, bleed: true }],
      shapes: directed.card.front.shapes.filter((shape) => shape.role !== "type-panel"),
      texts: directed.card.front.texts.map((text) => ({ ...text, color: "#3a3a3a" })),
      lockup: directed.card.front.lockup
        ? {
            ...directed.card.front.lockup,
            phone: directed.card.front.lockup.phone
              ? { ...directed.card.front.lockup.phone, color: "#3a3a3a" }
              : undefined,
            website: directed.card.front.lockup.website
              ? { ...directed.card.front.lockup.website, color: "#3a3a3a" }
              : undefined,
          }
        : null,
    },
  }
  const critique = critiqueCard(covered, directed.rationale, "See The Ceiling Stain $500 off")
  assert.ok(critique.autoFails.includes("AF1"))
  assert.ok(critique.visionScore <= 40)
  assert.equal(critique.scoreKind, "machine estimate")
  assert.equal(critique.passed, false)
})

test("a copied benchmark phone is rejected", async () => {
  const brief: CampaignBrief = { goal: "Book roof inspections", offer: "$0 inspection" }
  const directed = await directOneCard({
    brief,
    spec: { headline: "Wind damage? Free roof check.", offer: "$0 inspection", phone: "858-358-6454", website: "example.com/book" },
    trim: "5x8",
    records: [],
    env: rulesEnv,
  })
  const similarity = checkSimilarity(directed.card, "Call 858-358-6454", brief)
  assert.equal(similarity.tooClose, true)
})

test("the real Mando index shape is read and private paths are dropped", async () => {
  const entries = entriesFromMandoIndex([
    { mmr_id: "MMR-019", vertical: "plumbing", path: "images/MMR-019.jpg", side: "front" },
    { mmr_id: "MMR-900", path: "private/MMR-900.jpg" },
  ])
  assert.equal(entries[0]?.id, "MMR-019")
  assert.equal(entries[0]?.imagePath, "images/MMR-019.jpg")
  assert.equal(entries[1]?.imagePath, undefined)
  assert.ok(entries[1]?.skippedPrivate.includes("private/MMR-900.jpg"))

  const manifest = entriesFromC3poManifest({
    source: "chat",
    files: [{ seq: 1, sha256: "abc", mime: "image/jpeg" }],
  })
  assert.equal(manifest.length, 0)

  const tree = await entriesFromPhysicalTree(
    {
      async getJson() { return null },
      async getBytes() { return null },
      async listDir(dir) {
        if (dir === "assets/physical") {
          return [
            { name: "PM-055", path: "assets/physical/PM-055", type: "dir" },
            { name: "private", path: "assets/physical/private", type: "dir" },
          ]
        }
        return [
          { name: "front-01.jpg", path: "assets/physical/PM-055/front-01.jpg", type: "file" },
          { name: "secret.jpg", path: "assets/physical/PM-055/private/secret.jpg", type: "file" },
        ]
      },
    },
    "cursor/visual-reference-corpus-3752"
  )
  const piece = tree.find((entry) => entry.id === "PM-055")
  assert.equal(piece?.imagePath, "assets/physical/PM-055/front-01.jpg")
  assert.ok(piece?.skippedPrivate.some((file) => file.includes("private")))
  assert.equal(tree.some((entry) => entry.id === "private"), false)

  const directory = await mkdtemp(path.join(os.tmpdir(), "design-library-"))
  const reader: GithubReader = {
    async getJson(file) {
      if (file === "images/index.json") {
        return [{ mmr_id: "MMR-777", vertical: "roofing", path: "images/MMR-777.jpg" }]
      }
      return { files: [] }
    },
    async getBytes() {
      return { bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), contentType: "image/jpeg" }
    },
    async listDir() { return [] },
  }
  const report = await syncReferenceLibraries({
    env: { RESEARCH_GITHUB_TOKEN: "test" } as unknown as NodeJS.ProcessEnv,
    reader,
    store: createFileDocumentStore(directory),
    now: "2026-10-17T00:00:00.000Z",
  })
  assert.ok(report.added.includes("MMR-777"))
  await rm(directory, { recursive: true })
})

test("local discovery ignores private files and provenance notes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "reference-library-"))
  await mkdir(path.join(root, "mando", "images"), { recursive: true })
  await mkdir(path.join(root, "c3po", "assets", "physical", "PM-047"), { recursive: true })
  await mkdir(path.join(root, "c3po", "assets", "physical", "private"), { recursive: true })
  await writeFile(path.join(root, "mando", "images", "index.json"), JSON.stringify([
    { mmr_id: "MMR-019", path: "images/MMR-019.jpg", side: "front" },
    { mmr_id: "MMR-900", path: "private/MMR-900.jpg" },
  ]))
  await writeFile(path.join(root, "mando", "images", "MMR-019.jpg"), Buffer.from([0xff, 0xd8]))
  await writeFile(path.join(root, "c3po", "assets", "physical", "PM-047", "front-01.jpg"), Buffer.from([0xff, 0xd8]))
  await writeFile(path.join(root, "c3po", "assets", "physical", "PM-047", "front-01.provenance.json"), "{}")
  await writeFile(path.join(root, "c3po", "assets", "physical", "private", "secret.jpg"), Buffer.from([0xff, 0xd8]))
  const found = discoverLocalImages(root)
  assert.ok(found.get("MMR-019")?.some((image) => image.path.endsWith("MMR-019.jpg")))
  assert.equal(found.has("MMR-900"), false)
  assert.equal(found.has("private"), false)
  assert.ok(found.get("PM-047")?.every((image) => image.path.endsWith(".jpg")))
  assert.equal(localReferenceRoot({} as NodeJS.ProcessEnv).endsWith(`${path.sep}.data${path.sep}reference-library`), true)
  await rm(root, { recursive: true })
})

test("the benchmark set is the eight briefs and scores stay off the customer campaign", async () => {
  assert.equal(BENCHMARK_BRIEFS.length, 8)
  assert.deepEqual(
    BENCHMARK_BRIEFS.map((item) => item.id),
    ["roofing-storm", "roofing-replace", "roofing-repair", "plumbing", "hvac", "medicare", "real-estate", "general"]
  )
  const brief = BENCHMARK_BRIEFS[5]!
  const directed = await directOneCard({
    brief: brief.brief,
    spec: brief.spec,
    trim: brief.trim,
    businessName: brief.brief.businessInfo?.name,
    records: [],
    env: rulesEnv,
    cardId: brief.id,
  })
  assert.equal(directed.rationale.palette.emotion, "compliance_calm")
  assert.equal(directed.rounds <= 3, true)
  const campaign = {
    id: "c",
    ownerId: "o",
    status: "creative_ready",
    brief: brief.brief,
    creative: {
      directions: [
        {
          id: "d",
          name: "Local",
          rationale: "A calm review.",
          designedToDrive: "reviews",
          tags: [],
          spec: { ...brief.spec, designRationale: directed.rationale },
          research: {
            sources: [],
            layoutSummary: "One headline.",
            parameters: {
              headlineScale: 3,
              headlinePosition: "beside_photo",
              photoShare: 0.6,
              photoCrop: "open",
              offerBadge: "none",
              colorBlock: "field",
            },
            quality: directed.critique.visionScore
              ? {
                  score: directed.critique.visionScore / 10,
                  rubricPassed: 1,
                  rubricTotal: 1,
                  hierarchy: 1,
                  legibility: 1,
                  offerClarity: 1,
                  photoRelevance: 1,
                  craftResemblance: 1,
                  attempts: 1,
                  notes: ["Internal vision score"],
                }
              : undefined,
          },
          recommended: true,
          createdAt: "2026-10-17T00:00:00.000Z",
        },
      ],
      revisions: [],
    },
    transcript: [],
    readyForBriefReview: false,
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
  } satisfies Campaign
  const customer = campaignForCustomer(campaign)
  assert.equal(customer.creative.directions[0]?.research?.quality, undefined)
  assert.ok(customer.creative.directions[0]?.spec.designRationale)
})
