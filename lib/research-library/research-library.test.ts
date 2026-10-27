import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import type { CampaignBrief, CreativeDirection } from "@/lib/campaign-creator/types"
import { heroLockup } from "@/lib/design-intelligence/offer-copy"
import { rankCandidates } from "@/lib/design-intelligence/candidate-board"
import { createFileDocumentStore } from "@/lib/storage/document-store"

import { coverageBalances, formatCoverageReport } from "./coverage"
import {
  formatArtDirectorEvidence,
  formatCopyEvidence,
  goldComparisonNotes,
  layoutTuneFromHits,
  photoNoteFromHits,
  stampLibraryResearch,
} from "./evidence"
import { fixtureResearchIndex, fixtureSourceFiles } from "./fixtures"
import { clearResearchIndexMemory, refreshResearchIndex } from "./index"
import { indexSourceFiles } from "./parse"
import { queryFromBrief, retrieveResearch } from "./retrieve"
import { steerSpecFromResearch } from "./steer"
import type { ResearchEntry } from "./types"
import type { GithubReader } from "@/lib/design-intelligence/sync"

const roofingBrief: CampaignBrief = {
  goal: "Book roof inspections",
  offer: "Free roof inspection",
  audience: { description: "Homeowners in a storm belt" },
  businessInfo: { name: "Summit Roof Co" },
  emotionalTone: "urgent",
}

const hvacBrief: CampaignBrief = {
  goal: "Book an HVAC tune-up",
  offer: "$89 tune-up",
  audience: { description: "Homeowners before summer" },
  businessInfo: { name: "Northwind Comfort" },
}

const autoBrief: CampaignBrief = {
  goal: "Ask for an auto insurance quote",
  offer: "A written quote",
  audience: { description: "Drivers who own one family car" },
  businessInfo: { name: "Harbor Auto Cover" },
  emotionalTone: "calm",
}

test("every fixture record is indexed or skipped with a reason", () => {
  const index = fixtureResearchIndex()
  assert.equal(coverageBalances(index.coverage), true)
  assert.ok(index.stats.usable >= 8)
  assert.ok(index.entries.some((entry) => entry.id === "GOLD-roofing-001" && entry.gold && entry.evidence === "visual"))
  assert.ok(index.entries.some((entry) => entry.id === "MMR-9003" && entry.evidence === "text"))
  assert.ok(index.entries.some((entry) => entry.id === "PM-901"))
  assert.ok(index.entries.some((entry) => entry.id === "PM-902" && entry.evidence === "visual"))
  assert.equal(index.entries.some((entry) => entry.id === "MMR-9099"), false)
  assert.ok(index.coverage.some((row) => row.path === "private/" && row.status === "skipped" && /private/.test(row.reason ?? "")))
  assert.ok(index.coverage.some((row) => row.path.endsWith("empty-MMR-9008.md") && row.status === "skipped" && row.reason === "Empty file."))
  assert.ok(index.coverage.some((row) => row.path === "README.md" && row.status === "skipped"))
  assert.ok(index.coverage.some((row) => row.path.includes("manifest") && row.status === "skipped" && /manifest/i.test(row.reason ?? "")))
  const report = formatCoverageReport(index)
  assert.match(report, /Every skipped row has an explicit reason/)
  assert.match(report, /Records usable:/)
  const discovered = index.coverage.length
  assert.equal(index.stats.indexed + index.stats.skipped, discovered)
})

test("retrieval prefers the same industry, then gold and image-backed mailers", () => {
  const index = fixtureResearchIndex()
  const roofing = retrieveResearch(index.entries, queryFromBrief(roofingBrief), 4)
  assert.equal(roofing.hits[0]?.entry.id, "GOLD-roofing-001")
  assert.equal(roofing.hits[0]?.band, "same")
  assert.ok(roofing.hits.some((hit) => hit.entry.id === "MMR-9001"))
  assert.equal(roofing.fallback === "none" || roofing.fallback === "filled", true)

  const hvac = retrieveResearch(index.entries, queryFromBrief(hvacBrief), 4)
  assert.equal(hvac.hits[0]?.entry.industry, "hvac")
  assert.ok(hvac.hits[0]!.score > (hvac.hits.find((hit) => hit.entry.industry === "roofing")?.score ?? 0))

  const auto = retrieveResearch(index.entries, queryFromBrief(autoBrief), 4)
  assert.equal(auto.hits[0]?.entry.id, "GOLD-auto-insurance-001")
  assert.equal(auto.hits[0]?.entry.industry, "auto_insurance")
  assert.equal(auto.hits[0]?.band, "same")
  assert.ok(auto.hits.findIndex((hit) => hit.entry.id === "MMR-9003") > 0)
})

test("a missing industry falls back to an adjacent trade", () => {
  const index = fixtureResearchIndex()
  const solar = retrieveResearch(index.entries, {
    industry: "solar",
    offerType: "inspection",
    audience: "homeowners",
    direction: "solar check",
    emotion: "urgency",
  }, 3)
  assert.equal(solar.fallback, "adjacent")
  assert.ok(solar.hits.length > 0)
  assert.ok(solar.hits.every((hit) => hit.band === "adjacent" || hit.band === "broader"))
  assert.equal(solar.hits.some((hit) => hit.entry.industry === "roofing" || hit.entry.industry === "hvac"), true)
})

test("evidence changes the prompt, the layout, and the photo note without a printable claim", () => {
  const index = fixtureResearchIndex()
  const retrieved = retrieveResearch(index.entries, queryFromBrief(roofingBrief), 4)
  const copy = formatCopyEvidence(retrieved.hits)
  assert.match(copy, /GOLD-roofing-001/)
  assert.match(copy, /See the roof/)
  assert.match(copy, /do not print/i)
  assert.match(copy, /Do not print a response rate/)
  const director = formatArtDirectorEvidence(retrieved.hits)
  assert.match(director, /70%|photograph about 70%/)
  const tune = layoutTuneFromHits(retrieved.hits)
  assert.equal(tune?.sourceId, "GOLD-roofing-001")
  assert.equal(tune?.offerProminent, true)
  assert.ok((tune?.photoShare ?? 0) >= 0.65)
  const note = photoNoteFromHits(retrieved.hits)
  assert.match(note ?? "", /daylight exterior roof/)
  assert.doesNotMatch(note ?? "", /images\/gold/)

  const before = direction()
  const stamped = stampLibraryResearch({ directions: [before] }, retrieved.hits, roofingBrief)
  const after = stamped.directions[0]!
  assert.deepEqual(after.research?.influencedBy?.slice(0, 1), ["GOLD-roofing-001"])
  assert.equal(after.spec.layoutHints?.templateId, "roof_coupon")
  assert.equal(before.spec.layoutHints?.templateId, "roof_split")
  assert.ok((after.research?.parameters.photoShare ?? 0) >= 0.65)
  assert.equal(after.spec.headline, before.spec.headline)
  assert.doesNotMatch(after.spec.headline ?? "", /2\.1%/)
  assert.match(after.research?.photoDirection ?? "", /daylight/)
})

test("the critic notes a card that misses the gold photo share", () => {
  const notes = goldComparisonNotes({
    photoAreaPct: 42,
    offerFont: 18,
    headlineFont: 32,
    palette: ["#111111", "#222222", "#333333"],
    gold: { id: "GOLD-roofing-001", photoShare: 0.7, offerProminent: true, colors: ["#0B1F33"] },
  })
  assert.ok(notes.some((note) => note.includes("GOLD-roofing-001") && note.includes("70%")))
  assert.ok(notes.some((note) => /offer/i.test(note)))
})

test("a defensive gold file and a private path survive a partial sync", async () => {
  clearResearchIndexMemory()
  const directory = await mkdtemp(path.join(os.tmpdir(), "research-index-"))
  const files = new Map(fixtureSourceFiles().map((file) => [`${file.ref}:${file.path}`, file]))
  let fetched = 0
  const reader: GithubReader = {
    async getJson(filePath) {
      fetched += 1
      assert.equal(filePath.includes("private/"), false)
      return files.get(`mando:${filePath}`)?.json ?? files.get(`c3po:${filePath}`)?.json ?? null
    },
    async getBytes() {
      return null
    },
    async getText(filePath) {
      fetched += 1
      assert.equal(/\/private\//.test(filePath) || filePath.startsWith("private/"), false)
      const file = files.get(`mando:${filePath}`) ?? files.get(`c3po:${filePath}`)
      return file?.text ?? null
    },
    async listTree() {
      return {
        truncated: false,
        entries: fixtureSourceFiles()
          .filter((file) => !file.path.endsWith("/"))
          .map((file) => ({ path: file.path, type: "blob" as const, sha: "abc" })),
      }
    },
  }
  const store = createFileDocumentStore(directory)
  const first = await refreshResearchIndex({
    env: { RESEARCH_GITHUB_TOKEN: "test", RESEARCH_INDEX_BATCH: "3" } as unknown as NodeJS.ProcessEnv,
    reader,
    store,
    now: "2026-10-27T00:00:00.000Z",
    batchSize: 3,
    rounds: 1,
  })
  assert.ok(first.stats.pending > 0)
  assert.equal(first.stats.indexed + first.stats.skipped > 0, true)
  const done = await refreshResearchIndex({
    env: { RESEARCH_GITHUB_TOKEN: "test" } as unknown as NodeJS.ProcessEnv,
    reader,
    store,
    now: "2026-10-27T01:00:00.000Z",
    batchSize: 40,
    rounds: 4,
  })
  assert.equal(done.pending.length, 0)
  assert.ok(done.entries.some((entry) => entry.id === "GOLD-hvac-001"))
  assert.equal(done.entries.some((entry) => /private/i.test(entry.id)), false)
  assert.ok(fetched > 0)
  const skipped = done.coverage.filter((row) => row.status === "skipped")
  assert.ok(skipped.every((row) => Boolean(row.reason?.trim())))
  clearResearchIndexMemory()
  await rm(directory, { recursive: true })
})

test("different retrieved evidence changes the headline, the offer framing, and the layout", async () => {
  const index = fixtureResearchIndex()
  const roofHits = retrieveResearch(index.entries, queryFromBrief(roofingBrief), 4).hits
  const hvacHits = retrieveResearch(index.entries, queryFromBrief(hvacBrief), 4).hits
  const autoHits = retrieveResearch(index.entries, queryFromBrief(autoBrief), 4).hits
  const roof = steerSpecFromResearch({
    headline: "Free roof inspection",
    offer: "Free roof inspection",
    brief: roofingBrief,
    hits: roofHits,
    role: "outcome",
  })
  const hvac = steerSpecFromResearch({
    headline: "Free tune-up",
    offer: "$89 tune-up",
    brief: hvacBrief,
    hits: hvacHits,
    role: "outcome",
  })
  const auto = steerSpecFromResearch({
    headline: "Know your rate",
    offer: "A written quote",
    brief: autoBrief,
    hits: autoHits,
    role: "outcome",
  })
  assert.notEqual(roof.headline, hvac.headline)
  assert.notEqual(roof.headline, auto.headline)
  assert.notEqual(hvac.headline, auto.headline)
  assert.equal(roof.templateId, "roof_coupon")
  assert.notEqual(roof.templateId, auto.templateId)
  assert.equal(auto.templateId, "neighbor_letter")
  assert.equal(roof.offerProminent, true)
  assert.equal(hvac.templateId, "hero_scrim")
  assert.equal(hvac.offerProminent, false)
  assert.equal(auto.offerProminent, false)
  assert.equal(roof.offer, "Free roof inspection")
  assert.equal(hvac.offer, "$89 tune-up")
  assert.equal(auto.offer, "A written quote")
  assert.equal(roof.trace.headlineId, "GOLD-roofing-001")
  assert.equal(roof.trace.layoutId, "GOLD-roofing-001")
  assert.equal(auto.trace.headlineId, "GOLD-auto-insurance-001")
  assert.doesNotMatch(`${roof.headline} ${hvac.headline} ${auto.headline}`, /medicare|coverage gap/i)
  assert.doesNotMatch(auto.photoDirection ?? "", /ladder|handyman|medicare/i)

  const kept = steerSpecFromResearch({
    headline: "See the roof before it leaks",
    offer: "Free roof inspection",
    brief: roofingBrief,
    hits: roofHits,
    role: "outcome",
  })
  assert.equal(kept.headline, "See the roof before it leaks")
  assert.equal(kept.trace.headlineId, undefined)
  assert.equal(kept.trace.layoutId, "GOLD-roofing-001")

  const rulesEnv = {
    DESIGN_DIRECTOR: "rules",
    DESIGN_CRITIC: "machine",
    DESIGN_CANDIDATE_RENDERS: "off",
    DESIGN_CANDIDATE_COUNT: "3",
  } as unknown as NodeJS.ProcessEnv
  const directions = [0, 1, 2].map((index) => ({
    id: `d-${index}`,
    name: `Direction ${index}`,
    rationale: "One next step.",
    designedToDrive: "calls",
    tags: [],
    spec: {
      headline: index === 0 ? "Free roof inspection" : index === 1 ? "Wind on the ridge?" : "One roof. One visit.",
      offer: "Free roof inspection",
      palette: ["#111111", "#222222", "#333333"] as [string, string, string],
    },
    recommended: index === 0,
    createdAt: "2026-10-27T00:00:00.000Z",
  }))
  const withLibrary = await rankCandidates({
    brief: roofingBrief,
    directions,
    trim: "5x8",
    env: rulesEnv,
    records: [],
    tastes: [],
    blueprints: [],
    researchHits: roofHits,
  })
  const withoutLibrary = await rankCandidates({
    brief: roofingBrief,
    directions,
    trim: "5x8",
    env: rulesEnv,
    records: [],
    tastes: [],
    blueprints: [],
    researchHits: [],
  })
  const leadOn = withLibrary.surfaced.find((item) => item.directionIndex === 0)
  const leadOff = withoutLibrary.surfaced.find((item) => item.directionIndex === 0)
  assert.ok(leadOn && leadOff)
  assert.notEqual(leadOn.spec.headline, leadOff.spec.headline)
  assert.notEqual(leadOn.rationale.grid.intentional_break, leadOff.rationale.grid.intentional_break)
  assert.equal(leadOn.rationale.scale_ratios.hero, "offer")
  assert.equal(leadOff.rationale.scale_ratios.hero, "headline")
  assert.equal(leadOn.spec.layoutHints?.templateId, "roof_coupon")
  assert.equal(leadOn.evidenceTrace?.layoutId, "GOLD-roofing-001")
  assert.equal(leadOff.evidenceTrace, undefined)
  assert.match(leadOn.spec.headline ?? "", /See the roof/)
  assert.doesNotMatch(leadOn.spec.offer ?? "", /A written\.$/)
})

test("an empty image record ranks below a content-rich mailer", () => {
  const rich = entry({
    id: "HVAC-RICH",
    industry: "hvac",
    headlines: ["A quieter summer"],
    offers: ["$89 tune-up"],
    photoStyle: "outdoor condenser, daylight",
    evidence: "text",
  })
  const empty = entry({
    id: "HVAC-EMPTY",
    industry: "hvac",
    headlines: [],
    offers: [],
    evidence: "visual",
    gold: true,
    imageRefs: ["images/gold/hvac/front.jpg"],
  })
  const retrieved = retrieveResearch([empty, rich], {
    industry: "hvac",
    offerType: "maintenance",
    audience: "homeowners",
    direction: "tune-up",
    emotion: "relief",
  }, 4)
  assert.equal(retrieved.hits[0]?.entry.id, "HVAC-RICH")
  assert.ok((retrieved.hits.findIndex((hit) => hit.entry.id === "HVAC-EMPTY")) > 0)
})

test("auto insurance prefers home and life insurance and never Medicare copy", () => {
  const home = entry({
    id: "HOME-INS",
    industry: "home_insurance",
    headlines: ["A policy you can read"],
    offers: ["A written quote"],
    photoStyle: "a house and a parked car",
  })
  const life = entry({
    id: "LIFE-INS",
    industry: "life_insurance",
    headlines: ["A family kept well"],
    offers: ["A written quote"],
    photoStyle: "a family on a porch",
  })
  const local = entry({
    id: "LOCAL",
    industry: "home_services",
    headlines: ["A local next step"],
    offers: ["A written quote"],
  })
  const medicare = entry({
    id: "MED",
    industry: "medicare",
    headlines: ["Check your Medicare plan"],
    offers: ["Annual enrollment review"],
    whyItWorks: "Medicare annual enrollment",
    photoStyle: "a Medicare card on a table",
  })
  const retrieved = retrieveResearch([medicare, local, life, home], queryFromBrief(autoBrief), 4)
  assert.equal(retrieved.hits[0]?.entry.id, "HOME-INS")
  assert.equal(retrieved.hits[1]?.entry.id, "LIFE-INS")
  assert.equal(retrieved.hits.some((hit) => hit.entry.industry === "medicare" || /medicare/i.test(hit.entry.headlines.join(" "))), false)
  const steered = steerSpecFromResearch({
    headline: "Know your rate",
    offer: "A written quote",
    brief: autoBrief,
    hits: retrieved.hits,
    role: "outcome",
  })
  assert.doesNotMatch(`${steered.headline} ${steered.photoDirection ?? ""}`, /medicare|coverage gap|ladder|handyman/i)
  assert.equal(steered.offer, "A written quote")
})

test("an offer stays whole, and an unknown response note is not a prompt line", () => {
  const lockup = heroLockup("A written quote")
  assert.equal(lockup.numeral, "A written quote")
  assert.equal(lockup.rest, "")
  assert.notEqual(`${lockup.numeral} ${lockup.rest}`.trim(), "A written.")
  const indexed = indexSourceFiles([{
    path: "mailers/MMR-unknown.md",
    ref: "mando",
    text: "# MMR-unknown\n\n## OBSERVED\n- Industry: roofing\n- Headline: \"See the roof\"\n\n## INFERRED\nOne roof.\n\n## INTERPRETATION\nWhy it works: one photograph.\nResponse: UNKNOWN\n",
  }])
  const parsed = indexed.entries.find((item) => item.id === "MMR-unknown")
  assert.equal(parsed?.responseEvidence, undefined)
  const copy = formatCopyEvidence([{
    entry: entry({
      id: "MMR-unknown",
      industry: "roofing",
      headlines: ["See the roof"],
      responseEvidence: "UNKNOWN",
    }),
    score: 10,
    band: "same",
  }])
  assert.match(copy, /See the roof/)
  assert.doesNotMatch(copy, /internal response note/i)
  assert.doesNotMatch(copy, /UNKNOWN/)
})

test("indexing does not require a network call", () => {
  const { entries } = indexSourceFiles(fixtureSourceFiles())
  assert.ok(entries.find((entry) => entry.id === "GOLD-hvac-001")?.layout.photoShare === 0.55)
  assert.equal(entries.find((entry) => entry.id === "GOLD-hvac-001")?.favoriteOf, "PM-022")
})

function entry(partial: Partial<ResearchEntry> & { id: string; industry: string }): ResearchEntry {
  return {
    origin: "mmr",
    sourcePath: "test",
    ref: "mando",
    offerType: "other",
    emotion: "unspecified",
    format: "postcard",
    layout: {},
    colors: [],
    headlines: [],
    offers: [],
    structures: [],
    imageRefs: [],
    evidence: "text",
    gold: false,
    searchText: partial.industry,
    ...partial,
  }
}

function direction(): CreativeDirection {
  return {
    id: "dir-1",
    name: "Storm Check",
    rationale: "The inspection is the reason to call.",
    designedToDrive: "Book an inspection",
    tags: ["roof", "inspection", "local"],
    recommended: true,
    createdAt: "2026-10-27T00:00:00.000Z",
    spec: {
      headline: "See the roof",
      subheadline: "Free inspection",
      offer: "Free inspection",
      palette: ["#111111", "#222222", "#333333"],
      layoutVariant: "peer_split",
      layoutHints: { templateId: "roof_split" },
    },
    research: {
      sources: [],
      layoutSummary: "The words and the photograph share the card.",
      parameters: {
        headlineScale: 1.2,
        headlinePosition: "beside_photo",
        photoShare: 0.4,
        photoCrop: "space_for_type",
        offerBadge: "inline",
        colorBlock: "none",
      },
    },
  }
}
