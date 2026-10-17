import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type { CampaignBrief, CreativeSpec } from "@/lib/campaign-creator/types"
import { assignTemplateToSpec, verticalPaletteForBrief } from "@/lib/postcard-layouts/assign"
import { composePostcardFace } from "@/lib/postcard-layouts/compose"

import { critiqueCard } from "./critic"
import { composeGridCard } from "./grid-composer"
import { loadLibrary, loadSeedAnalyses } from "./library"
import { directOneCard, type DirectedCard } from "./pipeline"
import { renderCardPng } from "./render-png"
import type { TrimSize } from "./rationale"

export interface BenchmarkBrief {
  id: string
  label: string
  trim: TrimSize
  brief: CampaignBrief
  spec: CreativeSpec
}

export interface BenchmarkRow {
  id: string
  label: string
  trim: TrimSize
  before: { weighted: number; visionScore: number; autoFails: string[] }
  after: { weighted: number; visionScore: number; autoFails: string[]; passed: boolean; rounds: number }
  viewed: string[]
  letter: string
}

export interface BenchmarkReport {
  rows: BenchmarkRow[]
  summary: string
  averageBefore: number
  averageAfter: number
}

export const BENCHMARK_BRIEFS: BenchmarkBrief[] = [
  brief("roofing-storm", "Roofing, after a storm", "6x9", {
    goal: "Book roof inspections after wind",
    offer: "$0 inspection",
    audience: { description: "Homeowners in the neighborhood hit by wind last week" },
    businessInfo: { name: "Northline Roofing", phone: "(619) 555-0148" },
    phone: "(619) 555-0148",
    website: "northlineroofing.example/book",
    qrDestination: "https://northlineroofing.example/book",
  }, "Wind damage? Free roof check.", "$0 inspection"),
  brief("roofing-replace", "Roofing, replacement", "5x8", {
    goal: "Book roof replacement estimates",
    offer: "$500 off",
    audience: { description: "Owners of asphalt roofs older than fifteen years" },
    businessInfo: { name: "Northline Roofing", phone: "(619) 555-0148" },
    phone: "(619) 555-0148",
    website: "northlineroofing.example/book",
  }, "New roof. One price off.", "$500 off"),
  brief("roofing-repair", "Roofing, repair", "5x8", {
    goal: "Book a leak repair",
    offer: "Same-week repair",
    audience: { description: "Homeowners with an active leak" },
    businessInfo: { name: "Northline Roofing", phone: "(619) 555-0148" },
    phone: "(619) 555-0148",
    website: "northlineroofing.example/book",
  }, "Leak? We start this week.", "Same-week repair"),
  brief("plumbing", "Plumbing", "5x8", {
    goal: "Book a drain visit",
    offer: "$49 drain clear",
    audience: { description: "Households with a slow drain" },
    businessInfo: { name: "Harbor Plumbing", phone: "(619) 555-0172" },
    phone: "(619) 555-0172",
    website: "harborplumbing.example/book",
  }, "Slow drain. One price.", "$49 drain clear"),
  brief("hvac", "HVAC", "5x8", {
    goal: "Book a seasonal tune-up",
    offer: "$89 tune-up",
    audience: { description: "Households heading into the hot season" },
    businessInfo: { name: "Mesa Air", phone: "(619) 555-0194" },
    phone: "(619) 555-0194",
    website: "mesaair.example/book",
  }, "AC dragging? Tune-up is set.", "$89 tune-up"),
  brief("medicare", "Medicare", "6x9", {
    goal: "Book a Medicare plan review with a local advisor",
    offer: "Free plan review",
    audience: { description: "People new to a plan year who want a local explanation" },
    businessInfo: { name: "Harbor Advisors", phone: "(619) 555-0160" },
    phone: "(619) 555-0160",
    website: "harboradvisors.example/review",
    emotionalTone: "calm",
  }, "A local plan review.", "Free plan review"),
  brief("real-estate", "Real estate", "6x9", {
    goal: "Book a showing for one listing",
    offer: "Saturday at 1",
    audience: { description: "Neighbors who might want this house" },
    businessInfo: { name: "Lane & Co", phone: "(619) 555-0133" },
    phone: "(619) 555-0133",
    website: "laneandco.example/oak",
  }, "One house on Oak.", "Saturday at 1"),
  brief("general", "General local service", "5x8", {
    goal: "Book a painting estimate",
    offer: "Free estimate",
    audience: { description: "Homeowners planning one exterior this month" },
    businessInfo: { name: "Calle Paint", phone: "(619) 555-0188" },
    phone: "(619) 555-0188",
    website: "callepaint.example/book",
  }, "One exterior. This month.", "Free estimate"),
]

export async function runBenchmark(options?: {
  outDir?: string
  env?: NodeJS.ProcessEnv
}): Promise<BenchmarkReport> {
  const records = await loadLibrary()
  const rows: BenchmarkRow[] = []
  for (const item of BENCHMARK_BRIEFS) {
    const beforePlan = composePostcardFace({
      templateId: assignTemplateToSpec(item.brief, item.spec).layoutHints!.templateId!,
      spec: item.spec,
      size: item.trim,
      businessName: item.brief.businessInfo?.name,
      paletteId: verticalPaletteForBrief(item.brief),
      qrPayload: item.brief.qrDestination ?? item.brief.website,
    })
    const beforeCard = {
      front: beforePlan,
      back: beforePlan,
      typePt: { offer: 0, headline: 0, support: 0, phone: 0 },
      photoAreaPct: photoShare(beforePlan),
      calmFieldPct: 30,
      panel: beforePlan.shapes[0]?.rect ?? { x: 0, y: 0, w: 1, h: 1 },
    }
    const beforeCopy = `${item.spec.headline ?? ""} ${item.spec.offer ?? ""}`
    const directed = await directOneCard({
      brief: item.brief,
      spec: item.spec,
      trim: item.trim,
      records,
      env: { ...options?.env, DESIGN_DIRECTOR: "rules", DESIGN_CRITIC: "machine" } as NodeJS.ProcessEnv,
      businessName: item.brief.businessInfo?.name,
      cardId: item.id,
    })
    const missingAnchors = ["PM-047", "PM-054", "PM-022"].filter(
      (id) => !directed.viewed.some((view) => view.id === id && view.width > 0 && view.bytes > 0)
    )
    if (missingAnchors.length > 0) {
      throw new Error(
        `The art director did not open ${missingAnchors.join(", ")}. Keep the reference images in .data/reference-library (gitignored) or set REFERENCE_LIBRARY_DIR.`
      )
    }
    const beforeCritique = critiqueCard(beforeCard, directed.rationale, beforeCopy)
    rows.push({
      id: item.id,
      label: item.label,
      trim: item.trim,
      before: {
        weighted: beforeCritique.weighted,
        visionScore: beforeCritique.visionScore,
        autoFails: beforeCritique.autoFails,
      },
      after: {
        weighted: directed.critique.weighted,
        visionScore: directed.critique.visionScore,
        autoFails: directed.critique.autoFails,
        passed: directed.shown,
        rounds: directed.rounds,
      },
      viewed: directed.viewed.map((view) => `${view.id} ${view.width}×${view.height}`),
      letter: letterFor(directed),
    })
    if (options?.outDir) await writePair(options.outDir, item, directed, beforePlan)
  }
  const averageBefore = average(rows.map((row) => row.before.visionScore))
  const averageAfter = average(rows.map((row) => row.after.visionScore))
  const summary = renderReport(rows, averageBefore, averageAfter)
  if (options?.outDir) {
    await mkdir(options.outDir, { recursive: true })
    await writeFile(path.join(options.outDir, "report-card.md"), summary, "utf8")
    await writeFile(path.join(options.outDir, "report-card.json"), JSON.stringify({ rows, averageBefore, averageAfter }, null, 2), "utf8")
  }
  return { rows, summary, averageBefore, averageAfter }
}

function photoShare(plan: ReturnType<typeof composePostcardFace>): number {
  const trim = plan.size === "6x9" ? { w: 9, h: 6 } : { w: 8, h: 5 }
  const area = plan.photos.reduce((sum, photo) => sum + photo.rect.w * photo.rect.h, 0)
  return Math.round((area / (trim.w * trim.h)) * 100)
}

async function writePair(
  outDir: string,
  item: BenchmarkBrief,
  directed: DirectedCard,
  beforePlan: ReturnType<typeof composePostcardFace>
): Promise<void> {
  await mkdir(outDir, { recursive: true })
  const beforeCard = composeGridCard({
    rationale: directed.rationale,
    spec: item.spec,
    businessName: item.brief.businessInfo?.name,
  })
  // The before file is the current template painter's geometry, drawn with the same renderer.
  const beforeDrawn = {
    ...beforeCard,
    front: beforePlan,
    panel: beforePlan.shapes.find((shape) => shape.role === "field")?.rect ?? beforeCard.panel,
  }
  await writeFile(path.join(outDir, `${item.id}-before.png`), renderCardPng(beforeDrawn))
  await writeFile(path.join(outDir, `${item.id}-after.png`), renderCardPng(directed.card))
}

function letterFor(directed: DirectedCard): string {
  if (!directed.shown) return directed.critique.visionScore >= 65 ? "revise" : "hold"
  if (directed.critique.visionScore >= 90 && directed.critique.weighted >= 9) return "A"
  if (directed.critique.visionScore >= 80 && directed.critique.weighted >= 8) return "A-"
  return "B"
}

function renderReport(rows: BenchmarkRow[], before: number, after: number): string {
  const lines = [
    "# Postcard benchmark",
    "",
    `Average vision score before (current templates): ${before}. After (grid from a Design Rationale): ${after}.`,
    "",
    "| Brief | Trim | Before | After | Auto-fails after | Images the art director opened | Letter |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.label} | ${row.trim} | ${row.before.visionScore} | ${row.after.visionScore} | ${row.after.autoFails.join(", ") || "none"} | ${row.viewed.join("; ")} | ${row.letter} |`),
    "",
    "Before is the template the product paints today, with the same words. After is the grid composer. Scores are internal. A card is shown when auto-fails are clear, the weighted rubric is at least 8, and the vision score is at least 80.",
    "",
    `Library seed: ${loadSeedAnalyses().length} analyses. Every brief opens PM-047, PM-054, and PM-022, the mailbox anchors, and does not open the anti-examples.`,
    "",
    "This run measures those images on disk. When ANTHROPIC_API_KEY is set and DESIGN_DIRECTOR is not rules, the same files are sent to the vision model. This report does not copy their artwork or wording.",
  ]
  return lines.join("\n")
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

function brief(
  id: string,
  label: string,
  trim: TrimSize,
  campaign: CampaignBrief,
  headline: string,
  offer: string
): BenchmarkBrief {
  return {
    id,
    label,
    trim,
    brief: campaign,
    spec: {
      format: "postcard_4x6",
      layoutVariant: "image_grounded",
      headline,
      offer,
      body: campaign.audience?.description,
      callToAction: "Call or scan to book",
      phone: campaign.phone,
      website: campaign.website,
      qrDestination: campaign.qrDestination ?? campaign.website,
      visualDirection: "One photograph of the work.",
      tone: campaign.emotionalTone ?? "direct",
      palette: ["#F4F1EA", "#1A1A1A", "#C4371C"],
      imagery: "stock_generic_local",
      leadJob: "offer",
      imageryRole: "crew",
    },
  }
}
