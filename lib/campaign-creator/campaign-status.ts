import type { CampaignStatus } from "./types"

/** Canonical lifecycle order — used for progress and at-or-past checks. */
export const CAMPAIGN_STATUS_ORDER: readonly CampaignStatus[] = [
  "draft",
  "strategy_confirmed",
  "generating_creative",
  "creative_ready",
  "creative_approved",
  "audience_confirmed",
  "quantity_confirmed",
  "launched",
] as const

export type CampaignProgressStepId =
  | "strategy"
  | "creative"
  | "audience"
  | "quantity"
  | "launch"

export type ProgressStepState = "complete" | "active" | "upcoming"

export const CAMPAIGN_PROGRESS_STEPS: ReadonlyArray<{
  id: CampaignProgressStepId
  label: string
}> = [
  { id: "strategy", label: "Strategy" },
  { id: "creative", label: "Creative" },
  { id: "audience", label: "Audience" },
  { id: "quantity", label: "Quantity" },
  { id: "launch", label: "Launch" },
]

const LEGACY_STATUS_MAP: Record<string, CampaignStatus> = {
  brief_confirmed: "strategy_confirmed",
}

/** Normalize persisted status values from earlier milestones. */
export function normalizeCampaignStatus(status: string): CampaignStatus {
  return LEGACY_STATUS_MAP[status] ?? (status as CampaignStatus)
}

export function statusIndex(status: CampaignStatus): number {
  const index = CAMPAIGN_STATUS_ORDER.indexOf(status)
  return index === -1 ? 0 : index
}

export function isAtOrPastStatus(
  current: CampaignStatus,
  threshold: CampaignStatus
): boolean {
  return statusIndex(current) >= statusIndex(threshold)
}

/** Interview ends once strategy is confirmed; Studio owns creative and beyond. */
export function isInterviewMode(status: CampaignStatus): boolean {
  return status === "draft"
}

export function isStudioMode(status: CampaignStatus): boolean {
  return !isInterviewMode(status)
}

export function isCreativePhase(status: CampaignStatus): boolean {
  return (
    status === "strategy_confirmed" ||
    status === "generating_creative" ||
    status === "creative_ready" ||
    status === "creative_approved"
  )
}

export function getProgressStepStates(
  status: CampaignStatus
): Record<CampaignProgressStepId, ProgressStepState> {
  const states: Record<CampaignProgressStepId, ProgressStepState> = {
    strategy: "upcoming",
    creative: "upcoming",
    audience: "upcoming",
    quantity: "upcoming",
    launch: "upcoming",
  }

  switch (status) {
    case "draft":
      states.strategy = "active"
      break
    case "strategy_confirmed":
    case "generating_creative":
    case "creative_ready":
      states.strategy = "complete"
      states.creative = "active"
      break
    case "creative_approved":
      states.strategy = "complete"
      states.creative = "complete"
      states.audience = "active"
      break
    case "audience_confirmed":
      states.strategy = "complete"
      states.creative = "complete"
      states.audience = "complete"
      states.quantity = "active"
      break
    case "quantity_confirmed":
      states.strategy = "complete"
      states.creative = "complete"
      states.audience = "complete"
      states.quantity = "complete"
      states.launch = "active"
      break
    case "launched":
      for (const step of CAMPAIGN_PROGRESS_STEPS) {
        states[step.id] = "complete"
      }
      break
  }

  return states
}
