import type { CampaignRule } from "./rule"

export const missingAudienceRule: CampaignRule = {
  id: "missing-audience",

  description: "Detects campaigns without a defined audience.",

  evaluate(brief) {
    if (brief.audience?.description) {
      return null
    }

    return {
      category: "Audience",
      severity: "critical",
      title: "Target audience missing",
      explanation:
        "The audience determines messaging, offer, creative, and mailing list.",
      recommendation:
        "Define exactly who should receive the mail.",
    }
  },
}