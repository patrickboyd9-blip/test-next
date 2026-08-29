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
