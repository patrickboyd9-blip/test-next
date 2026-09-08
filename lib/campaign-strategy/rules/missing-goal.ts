import type { CampaignRule } from "./rule"

export const missingGoalRule: CampaignRule = {
  id: "missing-goal",

  description: "Detects campaigns without a defined objective.",

  evaluate(brief) {
    if (brief.goal) {
      return null
    }

    return {
      category: "Strategy",
      severity: "critical",
      title: "Campaign goal missing",
      explanation:
        "A campaign without a clear objective cannot be optimized.",
      recommendation:
        "Define the single primary goal before designing the campaign.",
    }
  },
}