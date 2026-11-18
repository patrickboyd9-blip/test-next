import type { Campaign } from "@/lib/campaign-creator/types"
import type { AuditEvent } from "@/lib/ops/audit"
import { resultsFor } from "@/lib/tracking/ledger"

export interface ProgressRow {
  id: string
  name: string
  status: string
}

export interface CommandSnapshot {
  sample: boolean
  printing: number
  mailed: number
  delivered: number
  scansToday: number | null
  callsToday: number | null
  spendThisMonthCents: number | null
  inProgress: ProgressRow[]
  suggestions: string[]
  analytics: { label: string; value: string }[]
}

export function emptySnapshot(): CommandSnapshot {
  return snapshotFrom([], [], new Date().toISOString())
}

/** Labeled sample for a screenshot. The live page does not use this unless asked. */
export function labeledSampleSnapshot(): CommandSnapshot {
  return {
    sample: true,
    printing: 1,
    mailed: 1,
    delivered: 0,
    scansToday: 4,
    callsToday: 1,
    spendThisMonthCents: 18600,
    inProgress: [
      { id: "sample-spring", name: "Spring tune-up", status: "Proof ready" },
      { id: "sample-heater", name: "Water heater check", status: "Printing" },
    ],
    suggestions: ["Sample only. Approve Spring tune-up when you are looking at a real proof."],
    analytics: [
      { label: "Scans", value: "4 sample" },
      { label: "Calls", value: "1 sample" },
      { label: "Pieces mailed", value: "Not a live count" },
    ],
  }
}

export function snapshotFrom(
  campaigns: readonly Campaign[],
  charges: readonly AuditEvent[],
  nowIso: string,
  ownerId?: string
): CommandSnapshot {
  const stages = { printing: 0, mailed: 0, delivered: 0 }
  const inProgress: ProgressRow[] = []
  let scansToday = 0
  let callsToday = 0
  let anyScan = false
  let anyCall = false
  const start = new Date(nowIso)
  start.setUTCHours(0, 0, 0, 0)
  for (const campaign of campaigns) {
    const stage = mailStage(campaign)
    if (stage) stages[stage] += 1
    if (stage !== "delivered") {
      inProgress.push({
        id: campaign.id,
        name: campaign.name || campaign.brief.businessInfo?.name || "Untitled campaign",
        status: stageLabel(campaign, stage),
      })
    }
    const results = resultsFor(campaign.id, ownerId)
    if (results.scans != null) {
      anyScan = true
      scansToday += results.scans
    }
    if (results.calls != null) {
      anyCall = true
      callsToday += results.calls
    }
  }
  const month = nowIso.slice(0, 7)
  const spend = charges
    .filter((event) => event.action === "charge" && event.at.slice(0, 7) === month)
    .map((event) => cents(event.after))
    .filter((value): value is number => value != null)
  const suggestions = cometSuggestions({
    inProgress,
    scansToday: anyScan ? scansToday : null,
    callsToday: anyCall ? callsToday : null,
    spendCents: spend.length > 0 ? spend.reduce((sum, value) => sum + value, 0) : null,
  })
  return {
    sample: false,
    printing: stages.printing,
    mailed: stages.mailed,
    delivered: stages.delivered,
    scansToday: anyScan ? scansToday : null,
    callsToday: anyCall ? callsToday : null,
    spendThisMonthCents: spend.length > 0 ? spend.reduce((sum, value) => sum + value, 0) : null,
    inProgress,
    suggestions,
    analytics: [
      { label: "Scans", value: anyScan ? String(scansToday) : "Not recorded" },
      { label: "Calls", value: anyCall ? String(callsToday) : "Not recorded" },
      { label: "Pieces mailed", value: stages.mailed + stages.delivered > 0 ? String(stages.mailed + stages.delivered) : "Not recorded" },
    ],
  }
}

export function resultsCsv(campaigns: readonly Campaign[], ownerId?: string): string {
  const lines = ["name,status,scans,calls"]
  for (const campaign of campaigns) {
    const results = resultsFor(campaign.id, ownerId)
    const name = (campaign.name || "Untitled campaign").replaceAll('"', "'")
    lines.push(
      [
        `"${name}"`,
        stageLabel(campaign, mailStage(campaign)),
        results.scans == null ? "" : String(results.scans),
        results.calls == null ? "" : String(results.calls),
      ].join(",")
    )
  }
  return `${lines.join("\n")}\n`
}

function mailStage(campaign: Campaign): "printing" | "mailed" | "delivered" | null {
  const job = campaign.mailOrder?.jobStatus?.toLowerCase() ?? ""
  if (campaign.mailOrder?.submitted && /deliver/.test(job)) return "delivered"
  if (campaign.mailOrder?.submitted) return "mailed"
  if (campaign.mailOrder) return "printing"
  return null
}

function stageLabel(campaign: Campaign, stage: "printing" | "mailed" | "delivered" | null): string {
  if (stage === "printing") return "Printing"
  if (stage === "mailed") return "Mailed"
  if (stage === "delivered") return "Delivered"
  if (campaign.status === "creative_approved" || campaign.status === "audience_confirmed") return "Proof ready"
  if (campaign.status === "launched") return "Approved"
  return "Designing"
}

/** Suggestions may repeat a recorded count. They do not estimate a rate or a result. */
export function cometSuggestions(input: {
  inProgress: readonly ProgressRow[]
  scansToday: number | null
  callsToday: number | null
  spendCents: number | null
}): string[] {
  const open = input.inProgress.length === 0
    ? "No campaigns are in progress."
    : `${input.inProgress.length} open: ${input.inProgress.map((row) => `${row.name}, ${row.status}`).join("; ")}.`
  const scans = input.scansToday == null ? "No scans are recorded." : `${input.scansToday} recorded scan${input.scansToday === 1 ? "" : "s"}.`
  const calls = input.callsToday == null ? "No tracking calls are recorded." : `${input.callsToday} recorded tracking call${input.callsToday === 1 ? "" : "s"}.`
  const spend = input.spendCents == null ? "No charges are recorded this month." : `Recorded charges this month: $${(input.spendCents / 100).toFixed(2)}.`
  return [open, scans, calls, spend]
}

function cents(after: unknown): number | null {
  if (!after || typeof after !== "object") return null
  const record = after as { charged?: unknown; amountCents?: unknown }
  if (record.charged !== true || typeof record.amountCents !== "number") return null
  return record.amountCents
}
