import type { CampaignRule } from "./rule"

export const missingOfferRule: CampaignRule = {
  id: "missing-offer",

  description: "Detects campaigns without an offer.",

  evaluate(brief) {
    if (brief.offer) {
      return null
    }

    return {
      category: "Offer",
      severity: "warning",
      title: "No offer specified",
      explanation:
        "Direct mail performs significantly better when recipients receive a compelling offer.",
      recommendation:
        "Consider adding a discount, incentive, consultation, or limited-time offer.",
    }
  },
}