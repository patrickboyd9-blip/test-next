import { canonicalJobStatus } from "@/lib/click2mail/job-status"
import type { Campaign } from "@/lib/campaign-creator/types"

/** Stages a job status can actually support. Postal in-transit and in-home are not among them. */
export type MeasurableStage = "ordered" | "printing" | "mailed"

export const STAGE_LABEL: Record<MeasurableStage, string> = {
  ordered: "Ordered",
  printing: "Printing",
  mailed: "Mailed",
}

export function stageForJob(status: string | undefined, submitted: boolean): MeasurableStage | null {
  if (!submitted) return null
  const canonical = canonicalJobStatus(status)
  if (canonical === "MAILED") return "mailed"
  if (canonical === "AWAITING_PRODUCTION" || canonical === "IN_PRODUCTION") return "printing"
  if (canonical === "ORDER_SUBMITTED" || canonical === "ORDER_PROCESSING" || canonical === "PROOF_ACCEPTED") return "ordered"
  return null
}

/** Piece counts for stages we can classify. Null when no job has one of those statuses. */
export function piecesByStage(campaigns: readonly Campaign[]): Record<MeasurableStage, number> | null {
  const totals: Record<MeasurableStage, number> = { ordered: 0, printing: 0, mailed: 0 }
  let any = false
  for (const campaign of campaigns) {
    const order = campaign.mailOrder
    if (!order) continue
    const stage = stageForJob(order.jobStatus, order.submitted)
    if (!stage) continue
    any = true
    totals[stage] += Math.max(0, order.pieceCount || 0)
  }
  return any ? totals : null
}
