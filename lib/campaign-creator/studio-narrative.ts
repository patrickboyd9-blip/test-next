import type { CampaignBrief } from "./types"

const DEFAULTS = {
  goal: "generate new HVAC appointments",
  audience: "homeowners in Irvine",
  metric: "appointment bookings",
  business: "ABC Air Conditioning",
}

export function buildGenerationNarrativeLines(brief: CampaignBrief): string[] {
  const goal = brief.goal ?? DEFAULTS.goal
  const audience = brief.audience?.description ?? DEFAULTS.audience
  const metric =
    brief.primarySuccessMetric?.description ?? DEFAULTS.metric
  const business = brief.businessInfo?.name ?? DEFAULTS.business

  return [
    `Understanding your goal: ${goal}.`,
    `Designing for ${audience}.`,
    `Optimizing for ${metric}.`,
    `Exploring three creative directions for ${business}.`,
  ]
}

export const GENERATION_SLOW_LINE =
  "Taking a little longer — making sure each direction is genuinely distinct."

export const GENERATION_SECOND_SLOW_LINE =
  "Almost ready — finishing your concepts now."

export const GENERATION_FAILED_LINE =
  "Something went wrong creating your concepts. Try again, or tell us what to adjust first."

export const GENERATION_RETRY_LABEL = "Try again"
