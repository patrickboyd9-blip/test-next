import type { CampaignBrief } from "@/lib/campaign-creator/types"

import type { DesignVertical } from "./rationale"

/**
 * Maps a campaign brief onto the six verticals the playbook knows.
 * Medicare and other insurance are recognized first so a roofing word
 * inside a benefits mailer cannot pull the card into a trade layout.
 */
export function verticalForBrief(brief: CampaignBrief): DesignVertical {
  const text = [
    brief.goal,
    brief.offer,
    brief.audience?.description,
    brief.businessInfo?.name,
    brief.emotionalTone,
    brief.otherRequirements,
    brief.desiredRecipientAction,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")

  if (/\bmedicare\b|\bmedicaid\b|\binsurance\b|\bfinal expense\b|\bsupplement\b|\bannuit/i.test(text)) {
    return "medicare_insurance"
  }
  if (/\broof|shingle|gutter|storm damage\b/i.test(text)) return "roofing"
  if (/\bplumb|drain|water heater|pipe\b/i.test(text)) return "plumbing"
  if (/\bhvac\b|\bair condition|\bfurnace\b|\bheating\b|\bcooling\b|\bduct\b/i.test(text)) return "hvac"
  if (/\breal estate\b|\brealtor\b|\blisting\b|\bopen house\b|\bhome for sale\b/i.test(text)) {
    return "real_estate"
  }
  return "general_local_service"
}

export function briefHasNumeralOffer(brief: CampaignBrief): boolean {
  return /\$\s?\d|\d\s?%|\bpercent\b/i.test(brief.offer ?? "")
}
