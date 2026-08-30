import type { CampaignBrief } from "./types"

/** Customer-visible Studio copy shared by mock and live engines. Not a prompt. */

export function conflictCopyQr(brief: CampaignBrief): string {
  const metric =
    brief.primarySuccessMetric?.description ?? "appointment bookings"
  return `I'd recommend keeping the QR code — ${metric} is your primary success metric, and the QR is the fastest path there. I can make it smaller or move it if it's competing visually. What would you prefer?`
}

export function conflictCopyPhone(): string {
  return "Phone calls are how you'll measure success for this campaign, so I'd keep your number visible. I can make it smaller or move it — what works better for you?"
}

export function conflictCopyOffer(): string {
  return "Your offer is a core part of this campaign's goal. I'd keep it visible — want me to make it bigger, smaller, or move it instead?"
}

export function conflictCopyAmbiguous(): string {
  return "Better how — bolder, warmer, or more focused on the offer?"
}

export function conflictCopyUnrecognized(): string {
  return "I can adjust the headline, colors, phone placement, or QR prominence. What would you like to change?"
}

export function conflictCopyGeneric(brief: CampaignBrief): string {
  const goal = brief.goal ?? "this campaign"
  return `That change could work against your goal of ${goal}. I can adjust emphasis or placement instead — what would you prefer?`
}

export const RECOMMENDATION_HEADLINE = "★ Our recommendation"

export const REFINEMENT_APPLYING_LINE = "Applying your change…"

export const REFINEMENT_SLOW_NETWORK_LINE =
  "Having trouble applying that change. Check your connection and try again."
