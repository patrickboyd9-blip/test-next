import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type { CampaignBrief, CreativeDirection, CreativeSpec } from "@/lib/campaign-creator/types"

import { scoreCandidates } from "./candidates"
import { composeDirectedCard, rationaleForFamily } from "./composition-family"
import { critiqueCard } from "./critic"
import { directDesign } from "./art-director"
import { loadLibrary } from "./library"
import type { TrimSize } from "./rationale"
import { selectReferences } from "./select"

/**
 * Ten fixed briefs. The report records the Phase 3 critic on the old panel
 * composition and on the card the candidate set actually surfaces.
 */

export interface ExamBrief {
  id: string
  label: string
  trim: TrimSize
  brief: CampaignBrief
  spec: CreativeSpec
}

export interface ExamRow {
  id: string
  label: string
  trim: TrimSize
  panel: { letter: string; visionScore: number; weighted: number; autoFails: string[]; scoreKind: string }
  surfaced: { letter: string; visionScore: number; weighted: number; autoFails: string[]; family: string; passed: boolean; scoreKind: string; explanation: string; cited: string[] }
  image: string
}

export interface ExamReport {
  label: string
  generatedAt: string
  scoreKind: string
  note: string
  averagePanel: number
  averageSurfaced: number
  rows: ExamRow[]
}

export const EXAM_BRIEFS: ExamBrief[] = [
  examBrief("roofing-inspection", "Roofing, free inspection", "5x8", "Book a free roof inspection", "Free inspection", "Homeowners who have not had anyone on the roof this year", "Northline Roofing", "(619) 555-0148", "northlineroofing.example/book", "Free roof inspection."),
  examBrief("roofing-storm", "Roofing, after a storm", "6x9", "Book roof inspections after wind", "$0 inspection", "Homeowners in the neighborhood hit by wind last week", "Northline Roofing", "(619) 555-0148", "northlineroofing.example/book", "Wind damage? Free roof check."),
  examBrief("hvac-tuneup", "HVAC tune-up", "5x8", "Book a seasonal tune-up", "$89 tune-up", "Households heading into the hot season", "Mesa Air", "(619) 555-0194", "mesaair.example/book", "AC dragging? Tune-up is set."),
  examBrief("plumbing", "Plumbing", "5x8", "Book a drain visit", "$49 drain clear", "Households with a slow drain", "Harbor Plumbing", "(619) 555-0172", "harborplumbing.example/book", "Slow drain. One price."),
  examBrief("real-estate", "Real estate, we buy houses", "6x9", "Get a homeowner to request a cash offer", "Cash offer this week", "Owners who want to sell without listing", "Lane & Co", "(619) 555-0133", "laneandco.example/offer", "We buy houses. Cash."),
  examBrief("solar", "Solar", "5x8", "Book a solar savings review", "Free savings review", "Homeowners with a south-facing roof and a high summer bill", "Harbor Solar", "(619) 555-0119", "harborsolar.example/book", "See the summer bill drop."),
  examBrief("dental", "Dental", "5x8", "Book a new-patient visit", "$99 new patient visit", "Neighbors who have not seen a dentist this year", "Calle Dental", "(619) 555-0166", "calledental.example/book", "A new-patient visit."),
  examBrief("pest", "Pest control", "5x8", "Book a pest inspection", "$79 first treatment", "Households that saw ants in the kitchen", "Mesa Pest", "(619) 555-0181", "mesapest.example/book", "Ants in the kitchen?"),
  examBrief("landscaping", "Landscaping", "5x8", "Book a yard cleanup", "Free yard estimate", "Homeowners planning one cleanup before guests arrive", "Northline Yards", "(619) 555-0127", "northlineyards.example/book", "One yard. One cleanup."),
  examBrief("restaurant", "Restaurant", "5x8", "Bring neighbors in this week", "$20 dinner for two", "Neighbors who have not tried the weeknight menu", "Calle Table", "(619) 555-0155", "calletable.example/book", "Dinner for two. This week."),
]

export async function runDesignExam(options?: {
  outDir?: string
  env?: NodeJS.ProcessEnv
  label?: string
  render?: boolean
}): Promise<ExamReport> {
  const env = options?.env ?? process.env
  const outDir = options?.outDir ?? path.join("artifacts", "design-exam", datedFolder(options?.label ?? "after"))
  await mkdir(outDir, { recursive: true })
  const records = await loadLibrary().catch(() => [])
  const rows: ExamRow[] = []
  for (const item of EXAM_BRIEFS) {
    const selection = selectReferences(records, item.brief)
    const base = directDesign({ brief: item.brief, selection, trim: item.trim }).rationale
    const panelCard = composeDirectedCard({
      rationale: rationaleForFamily(base, "panel-left"),
      spec: item.spec,
      businessName: item.brief.businessInfo?.name,
    })
    const panel = critiqueCard(panelCard, rationaleForFamily(base, "panel-left"), `${item.spec.headline} ${item.spec.offer}`)
    const direction = stubDirection(item)
    const surfaced = await scoreCandidates({
      brief: item.brief,
      directions: [direction, { ...direction, id: `${item.id}-b` }, { ...direction, id: `${item.id}-c` }],
      trim: item.trim,
      records,
      env,
      businessName: item.brief.businessInfo?.name,
    })
    const winner = surfaced.candidates[0]
    if (!winner) throw new Error(`No candidate for ${item.id}`)
    const image = `${item.id}.png`
    if (options?.render !== false) {
      const { renderStudioCardPng } = await import("./studio-render")
      const png = await renderStudioCardPng(winner.card.front, item.spec.qrDestination ?? item.spec.website ?? "https://example.com/book")
      await writeFile(path.join(outDir, image), png)
    }
    rows.push({
      id: item.id,
      label: item.label,
      trim: item.trim,
      panel: {
        letter: panel.letter,
        visionScore: panel.visionScore,
        weighted: panel.weighted,
        autoFails: panel.autoFails,
        scoreKind: panel.scoreKind,
      },
      surfaced: {
        letter: winner.critique.letter,
        visionScore: winner.critique.visionScore,
        weighted: winner.critique.weighted,
        autoFails: winner.critique.autoFails,
        family: winner.family,
        passed: winner.critique.passed,
        scoreKind: winner.critique.scoreKind,
        explanation: winner.critique.explanation,
        cited: winner.cites.map((cite) => cite.id),
      },
      image,
    })
  }
  const machine = !env.ANTHROPIC_API_KEY?.trim() || env.DESIGN_CRITIC === "machine"
  const report: ExamReport = {
    label: options?.label ?? "after",
    generatedAt: new Date().toISOString(),
    scoreKind: machine ? "machine estimate" : rows[0]?.surfaced.scoreKind ?? "vision",
    note: machine
      ? "Machine-only estimate. ANTHROPIC_API_KEY was not set, so the vision critic did not see the renders. Panel is the old slab composition rescored by the Phase 3 critic. Surfaced is the card the candidate set keeps."
      : "Vision critic scored the surfaced card beside retrieved A-grade references. Panel is the old slab composition rescored by the same critic.",
    averagePanel: average(rows.map((row) => row.panel.visionScore)),
    averageSurfaced: average(rows.map((row) => row.surfaced.visionScore)),
    rows,
  }
  await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2))
  await writeFile(path.join(outDir, "report.md"), markdown(report))
  return report
}

function examBrief(
  id: string,
  label: string,
  trim: TrimSize,
  goal: string,
  offer: string,
  audience: string,
  name: string,
  phone: string,
  website: string,
  headline: string
): ExamBrief {
  const brief: CampaignBrief = {
    goal,
    offer,
    audience: { description: audience },
    businessInfo: { name, phone },
    phone,
    website,
    qrDestination: `https://${website}`,
  }
  return {
    id,
    label,
    trim,
    brief,
    spec: { headline, offer, phone, website, qrDestination: brief.qrDestination, callToAction: "Call or scan to book" },
  }
}

function stubDirection(item: ExamBrief): CreativeDirection {
  return {
    id: item.id,
    name: item.label,
    rationale: item.label,
    designedToDrive: item.brief.goal ?? "A response",
    tags: [],
    spec: item.spec,
    recommended: true,
    createdAt: "2026-10-17T00:00:00.000Z",
  }
}

function datedFolder(label: string): string {
  return `2026-10-17-${label}`
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

function markdown(report: ExamReport): string {
  const lines = [
    `# Design exam (${report.label})`,
    "",
    report.note,
    "",
    `Score kind: ${report.scoreKind}.`,
    "",
    `Panel average: ${report.averagePanel}. Surfaced average: ${report.averageSurfaced}.`,
    "",
    "| Brief | Panel | Surfaced | Family | Cited |",
    "| --- | --- | --- | --- | --- |",
    ...report.rows.map((row) => `| ${row.label} | ${row.panel.letter} (${row.panel.visionScore}) | ${row.surfaced.letter} (${row.surfaced.visionScore}) | ${row.surfaced.family} | ${row.surfaced.cited.join(", ") || "—"} |`),
    "",
  ]
  return lines.join("\n")
}
