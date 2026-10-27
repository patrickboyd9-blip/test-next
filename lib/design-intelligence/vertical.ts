import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { industryForBrief } from "@/lib/research-library/industry"

import type { DesignVertical } from "./rationale"

/**
 * Layout families the art director can paint.
 * The research industry is one of the gold slugs. This maps that industry
 * onto the six families the card schema knows. Insurance other than Medicare
 * does not use the Medicare family. Windows, gutters, siding, and garage doors
 * do not use roofing. Senior living does not use the Medicare family.
 * The newer local trades use the general local-service family.
 */
export function verticalForBrief(brief: CampaignBrief): DesignVertical {
  return designVerticalForIndustry(industryForBrief(brief))
}

export function designVerticalForIndustry(industry: string): DesignVertical {
  if (industry === "medicare") return "medicare_insurance"
  if (industry === "roofing") return "roofing"
  if (industry === "plumbing") return "plumbing"
  if (industry === "hvac") return "hvac"
  if (industry === "real-estate-agents" || industry === "home-buying") return "real_estate"
  return "general_local_service"
}

export function briefHasNumeralOffer(brief: CampaignBrief): boolean {
  return /\$\s?\d|\d\s?%|\bpercent\b/i.test(brief.offer ?? "")
}
