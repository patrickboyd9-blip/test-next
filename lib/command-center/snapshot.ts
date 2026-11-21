import type { Campaign } from "@/lib/campaign-creator/types"
import type { AuditEvent } from "@/lib/ops/audit"
import { piecesByStage, STAGE_LABEL, stageForJob, type MeasurableStage } from "@/lib/analytics/stage"
import type { ScanLog } from "@/lib/analytics/store"

export interface ProgressRow {
  id: string
  name: string
  status: string
}

export interface CommandSnapshot {
  sample: boolean
  stages: { id: MeasurableStage; label: string; pieces: number }[]
  mailNote: string
  scansTotal: number
  scansByDay: { day: string; count: number }[]
  scanRate: string | null
  taps: number
  leads: number
  spendThisMonthCents: number | null
  inProgress: ProgressRow[]
  suggestions: string[]
}

export function emptySnapshot(): CommandSnapshot {
  return snapshotFrom([], [], new Date().toISOString())
}

/** Labeled sample for a screenshot. The live page does not use this unless asked. */
export function labeledSampleSnapshot(): CommandSnapshot {
  return {
    sample: true,
    stages: [{ id: "printing", label: "Printing", pieces: 10 }],
    mailNote: "Sample only. These pieces were not mailed.",
    scansTotal: 4,
    scansByDay: [{ day: "2026-11-21", count: 4 }],
    scanRate: null,
    taps: 1,
    leads: 0,
    spendThisMonthCents: 18600,
    inProgress: [{ id: "sample-heater", name: "Water heater check", status: "Printing" }],
    suggestions: ["Sample only. Approve a real proof before anything is mailed."],
  }
}

export function snapshotFrom(
  campaigns: readonly Campaign[],
  charges: readonly AuditEvent[],
  nowIso: string,
  _ownerId?: string,
  activity?: { scans: readonly ScanLog[]; taps: number; leads: number }
): CommandSnapshot {
  const stageTotals = piecesByStage(campaigns)
  const stages = stageTotals
    ? (Object.keys(STAGE_LABEL) as MeasurableStage[]).map((id) => ({
        id,
        label: STAGE_LABEL[id],
        pieces: stageTotals[id],
      }))
    : []
  const inProgress = campaigns.flatMap((campaign) => {
    const order = campaign.mailOrder
    const stage = order ? stageForJob(order.jobStatus, order.submitted) : null
    if (!stage) return []
    const name = campaign.name?.trim() || campaign.brief.businessInfo?.name?.trim()
    if (!name) return []
    return [{ id: campaign.id, name, status: STAGE_LABEL[stage] }]
  })
  const scans = activity?.scans ?? []
  const byDay = new Map<string, number>()
  for (const scan of scans) {
    const day = scan.at.slice(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
  }
  const deliveredPieces = 0
  const month = nowIso.slice(0, 7)
  const spend = charges
    .filter((event) => event.action === "charge" && event.at.slice(0, 7) === month)
    .map((event) => cents(event.after))
    .filter((value): value is number => value != null)
  const spendThisMonthCents = spend.length > 0 ? spend.reduce((sum, value) => sum + value, 0) : null
  return {
    sample: false,
    stages,
    mailNote: stageTotals
      ? "In-home dates appear when postal tracking includes them. A mailed job is not the same as a piece in the home."
      : "Mail status appears after a job is sent to the printer.",
    scansTotal: scans.length,
    scansByDay: [...byDay.entries()].map(([day, count]) => ({ day, count })),
    scanRate: deliveredPieces > 0 ? `${Math.round((scans.length / deliveredPieces) * 1000) / 10}%` : null,
    taps: activity?.taps ?? 0,
    leads: activity?.leads ?? 0,
    spendThisMonthCents,
    inProgress,
    suggestions: cometSuggestions({
      stages,
      inProgress,
      scans: scans.length,
      taps: activity?.taps ?? 0,
      leads: activity?.leads ?? 0,
      spendCents: spendThisMonthCents,
    }),
  }
}

export function resultsCsv(campaigns: readonly Campaign[]): string {
  const lines = ["name,mail status,pieces"]
  for (const campaign of campaigns) {
    const order = campaign.mailOrder
    const stage = order ? stageForJob(order.jobStatus, order.submitted) : null
    const name = (campaign.name || "Untitled campaign").replaceAll('"', "'")
    lines.push([`"${name}"`, stage ? STAGE_LABEL[stage] : "", stage && order ? String(order.pieceCount) : ""].join(","))
  }
  return `${lines.join("\n")}\n`
}

/** Suggestions name a real status. They do not list untitled drafts. */
export function cometSuggestions(input: {
  stages: { label: string; pieces: number }[]
  inProgress: readonly ProgressRow[]
  scans: number
  taps: number
  leads: number
  spendCents: number | null
}): string[] {
  const lines: string[] = []
  if (input.inProgress.length === 0) {
    lines.push("Nothing with a printer status is in progress.")
  } else {
    lines.push(input.inProgress.map((row) => `${row.name} is ${row.status.toLowerCase()}.`).join(" "))
  }
  lines.push(input.scans === 0 ? "Scans appear after your mail lands." : `${input.scans} QR scan${input.scans === 1 ? "" : "s"} are recorded.`)
  if (input.taps > 0) lines.push(`${input.taps} tap${input.taps === 1 ? "" : "s"} to call on the page.`)
  if (input.leads > 0) lines.push(`${input.leads} lead${input.leads === 1 ? "" : "s"} came in from the page.`)
  lines.push(input.spendCents == null ? "No charges are recorded this month." : `Recorded charges this month: $${(input.spendCents / 100).toFixed(2)}.`)
  return lines
}

function cents(after: unknown): number | null {
  if (!after || typeof after !== "object") return null
  const record = after as { charged?: unknown; amountCents?: unknown }
  if (record.charged !== true || typeof record.amountCents !== "number") return null
  return record.amountCents
}
