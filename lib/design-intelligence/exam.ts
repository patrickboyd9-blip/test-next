import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type { CampaignBrief, CreativeDirection, CreativeSpec } from "@/lib/campaign-creator/types"

import { rankCandidates, type ScoredCandidate } from "./candidate-board"
import { letterFor, type LetterGrade } from "./composition-grade"
import { directOneCard } from "./pipeline"
import type { TrimSize } from "./rationale"

/**
 * Ten fixed briefs. The baseline path is the phase-2 art director.
 * The after path is the candidate board and the calibrated critic.
 * Images go to the artifacts folder and are not committed.
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
  letter: LetterGrade
  score: number
  scoreKind: "machine estimate" | "vision"
  family: string
  cleared: boolean
  retrieved: string[]
  explanation: string
  image: string | null
}

export interface ExamReport {
  mode: "baseline" | "after"
  scoredAt: string
  scoreKind: "machine estimate" | "vision"
  rows: ExamRow[]
  summary: string
}

export const EXAM_BRIEFS: ExamBrief[] = [
  examBrief("roofing-inspection", "Roofing, free inspection", {
    goal: "Book a free roof inspection",
    offer: "$0 inspection",
    audience: { description: "Homeowners who have not had a roofer up this year" },
    businessInfo: { name: "Northline Roofing", phone: "(619) 555-0148" },
  }, "Free roof inspection", "$0 inspection"),
  examBrief("roofing-storm", "Roofing, after a storm", {
    goal: "Book roof inspections after wind",
    offer: "$0 storm inspection",
    audience: { description: "Homeowners in the neighborhood hit by wind last week" },
    businessInfo: { name: "Northline Roofing", phone: "(619) 555-0148" },
  }, "Wind damage? Free roof check.", "$0 storm inspection"),
  examBrief("hvac-tuneup", "HVAC tune-up", {
    goal: "Book a seasonal tune-up",
    offer: "$89 tune-up",
    audience: { description: "Households heading into the hot season" },
    businessInfo: { name: "Mesa Air", phone: "(619) 555-0194" },
  }, "AC dragging? Tune-up is set.", "$89 tune-up"),
  examBrief("plumbing", "Plumbing", {
    goal: "Book a drain visit",
    offer: "$49 drain clear",
    audience: { description: "Households with a slow drain" },
    businessInfo: { name: "Harbor Plumbing", phone: "(619) 555-0172" },
  }, "Slow drain. One price.", "$49 drain clear"),
  examBrief("real-estate", "Real estate, we buy houses", {
    goal: "Get a call from an owner who wants to sell",
    offer: "We buy houses",
    audience: { description: "Owners who would rather sell than list" },
    businessInfo: { name: "Lane & Co", phone: "(619) 555-0133" },
  }, "Sell the house as it is.", "We buy houses"),
  examBrief("solar", "Solar", {
    goal: "Book a solar savings review",
    offer: "Free savings review",
    audience: { description: "Homeowners with a south-facing roof" },
    businessInfo: { name: "Harbor Solar", phone: "(619) 555-0166" },
  }, "See what the roof could save.", "Free savings review"),
  examBrief("dental", "Dental", {
    goal: "Book a new-patient visit",
    offer: "$99 new patient visit",
    audience: { description: "Neighbors who need a dentist this month" },
    businessInfo: { name: "Calle Dental", phone: "(619) 555-0114" },
  }, "A new patient visit, one price.", "$99 new patient visit"),
  examBrief("pest", "Pest control", {
    goal: "Book a pest inspection",
    offer: "$79 home treatment",
    audience: { description: "Households that saw ants in the kitchen" },
    businessInfo: { name: "Mesa Pest", phone: "(619) 555-0181" },
  }, "Ants in the kitchen?", "$79 home treatment"),
  examBrief("landscaping", "Landscaping", {
    goal: "Book a spring cleanup",
    offer: "Spring cleanup, $149",
    audience: { description: "Homeowners who want the yard handled once" },
    businessInfo: { name: "Northline Yard", phone: "(619) 555-0120" },
  }, "One spring cleanup.", "Spring cleanup, $149"),
  examBrief("restaurant", "Restaurant", {
    goal: "Fill Tuesday tables",
    offer: "Tuesday, two for one",
    audience: { description: "Neighbors who eat out once a week" },
    businessInfo: { name: "Calle Supper", phone: "(619) 555-0155" },
  }, "Tuesday is two for one.", "Tuesday, two for one"),
]

export async function runExam(options: {
  mode: "baseline" | "after"
  outDir: string
  env?: NodeJS.ProcessEnv
  render?: boolean
}): Promise<ExamReport> {
  const env = options.env ?? process.env
  const scoredAt = new Date().toISOString()
  const rows: ExamRow[] = []
  for (const item of EXAM_BRIEFS) {
    rows.push(options.mode === "baseline"
      ? await scoreBaseline(item, options.outDir, env, options.render !== false)
      : await scoreAfter(item, options.outDir, env, options.render !== false))
  }
  const kind = rows.some((row) => row.scoreKind === "vision") ? "vision" : "machine estimate"
  const average = rows.reduce((sum, row) => sum + row.score, 0) / Math.max(rows.length, 1)
  const report: ExamReport = {
    mode: options.mode,
    scoredAt,
    scoreKind: kind,
    rows,
    summary: summaryFor(options.mode, rows, average, kind),
  }
  await mkdir(options.outDir, { recursive: true })
  await writeFile(path.join(options.outDir, "report.json"), JSON.stringify(report, null, 2))
  await writeFile(path.join(options.outDir, "report.md"), markdown(report))
  return report
}

async function scoreBaseline(item: ExamBrief, outDir: string, env: NodeJS.ProcessEnv, render: boolean): Promise<ExamRow> {
  const directed = await directOneCard({
    brief: item.brief,
    spec: item.spec,
    trim: item.trim,
    businessName: item.brief.businessInfo?.name,
    env: { ...env, DESIGN_DIRECTOR: "rules", DESIGN_CRITIC: "machine" },
    cardId: item.id,
  })
  const critique = directed.critique
  const score = Math.round(critique.visionScore)
  const letter = letterFor(score)
  const image = render ? await writeCard(outDir, item.id, directed.card.front, item) : null
  return {
    id: item.id,
    label: item.label,
    letter,
    score,
    scoreKind: "machine estimate",
    family: directed.rationale.grid.intentional_break || directed.rationale.grid.name,
    cleared: letter === "A" || letter === "A-" || letter === "B+" || letter === "B",
    retrieved: directed.viewed.map((view) => view.id),
    explanation: `Phase-2 machine score ${score}. Auto-fails: ${critique.autoFails.join(", ") || "none"}.`,
    image,
  }
}

async function scoreAfter(item: ExamBrief, outDir: string, env: NodeJS.ProcessEnv, render: boolean): Promise<ExamRow> {
  const board = await rankCandidates({
    brief: item.brief,
    directions: examDirections(item.spec),
    trim: item.trim,
    env,
  })
  const winner = [...board.surfaced].sort((a, b) => b.grade.score - a.grade.score)[0]
  if (!winner) {
    return {
      id: item.id,
      label: item.label,
      letter: "F",
      score: 40,
      scoreKind: "machine estimate",
      family: "none",
      cleared: false,
      retrieved: board.retrieved.map((pick) => pick.id),
      explanation: "The board produced no candidate.",
      image: null,
    }
  }
  const image = render ? await writeCard(outDir, item.id, winner.card.front, item) : null
  return rowFrom(item, winner, board.retrieved.map((pick) => pick.id), image)
}

function rowFrom(item: ExamBrief, winner: ScoredCandidate, retrieved: string[], image: string | null): ExamRow {
  return {
    id: item.id,
    label: item.label,
    letter: winner.grade.letter,
    score: winner.grade.score,
    scoreKind: winner.grade.scoreKind,
    family: winner.familyId,
    cleared: winner.grade.cleared,
    retrieved,
    explanation: winner.grade.explanation,
    image,
  }
}

async function writeCard(
  outDir: string,
  id: string,
  plan: ScoredCandidate["card"]["front"],
  item: ExamBrief
): Promise<string | null> {
  try {
    const { renderStudioCardPng } = await import("./studio-render")
    const png = await renderStudioCardPng(
      plan,
      item.brief.qrDestination ?? item.brief.website ?? "https://example.com/book",
      { ppi: 100 }
    )
    const filename = `${id}.png`
    await mkdir(outDir, { recursive: true })
    await writeFile(path.join(outDir, filename), png)
    return filename
  } catch (error) {
    console.info(`[design-exam] ${JSON.stringify({ id, error: error instanceof Error ? error.message : "render failed" })}`)
    return null
  }
}

function summaryFor(mode: ExamReport["mode"], rows: ExamRow[], average: number, kind: ExamReport["scoreKind"]): string {
  const letters = rows.map((row) => `${row.id} ${row.letter}`).join(", ")
  const label = kind === "vision" ? "vision critic" : "machine estimate only — no vision model ran"
  return `${mode} exam average ${average.toFixed(1)} (${label}). ${letters}.`
}

function markdown(report: ExamReport): string {
  const lines = [
    `# Design exam (${report.mode})`,
    "",
    `Scored ${report.scoredAt}.`,
    "",
    report.scoreKind === "machine estimate"
      ? "These letters are **machine estimates**. No vision model ran in this environment, so they are not a person's grade and not a vision-model grade."
      : "The vision critic scored the rendered cards.",
    "",
    report.summary,
    "",
    "| Brief | Letter | Score | Kind | Cleared B | Family | Retrieved |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...report.rows.map((row) => `| ${row.label} | ${row.letter} | ${row.score} | ${row.scoreKind} | ${row.cleared ? "yes" : "no"} | ${row.family} | ${row.retrieved.slice(0, 4).join(", ") || "—"} |`),
    "",
    ...report.rows.map((row) => `**${row.label}.** ${row.explanation}${row.image ? ` Image: ${row.image}.` : " No image."}`),
    "",
  ]
  return lines.join("\n")
}

function examDirections(spec: CreativeSpec): CreativeDirection[] {
  return [0, 1, 2].map((index) => ({
    id: `exam-${index + 1}`,
    name: `Direction ${index + 1}`,
    rationale: "One next step.",
    designedToDrive: "calls",
    tags: [],
    spec,
    recommended: index === 0,
    createdAt: "2026-10-17T00:00:00.000Z",
  }))
}

function examBrief(
  id: string,
  label: string,
  brief: CampaignBrief,
  headline: string,
  offer: string
): ExamBrief {
  const phone = brief.businessInfo?.phone ?? "(619) 555-0100"
  const website = `${id}.example/book`
  return {
    id,
    label,
    trim: "5x8",
    brief: {
      ...brief,
      phone,
      website,
      qrDestination: `https://${website}`,
    },
    spec: {
      headline,
      offer,
      phone,
      website,
      qrDestination: `https://${website}`,
      callToAction: "Call or scan",
    },
  }
}

export function examUsesMachineEstimate(env: NodeJS.ProcessEnv): boolean {
  return !env.ANTHROPIC_API_KEY?.trim() || env.DESIGN_CRITIC === "machine"
}
