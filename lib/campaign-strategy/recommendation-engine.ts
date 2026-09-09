import type { CampaignBrief } from "../campaign-creator/types"

import type {
  Recommendation,
  RecommendationResult,
} from "./recommendation-types"

import { evaluateCampaign } from "./campaign-evaluator"

export function generateRecommendations(
  brief: CampaignBrief
): RecommendationResult {

  const evaluation = evaluateCampaign(brief)

  const recommendations: Recommendation[] = []

  if (!brief.offer) {
    recommendations.push({
      category: "Offer",
      title: "Add a compelling offer",
      explanation:
        "Campaigns with a strong, specific offer consistently outperform campaigns without one.",
      priority: "high",
    })
  }

  if (!brief.audience?.description) {
    recommendations.push({
      category: "Audience",
      title: "Define your ideal customer",
      explanation:
        "A clearly defined audience improves response rates and reduces wasted mailing costs.",
      priority: "high",
    })
  }

  if (!brief.goal) {
    recommendations.push({
      category: "Strategy",
      title: "Choose a primary campaign goal",
      explanation:
        "Every campaign should optimize toward one measurable objective such as phone calls, appointments, or purchases.",
      priority: "high",
    })
  }

  if (!brief.primarySuccessMetric) {
    recommendations.push({
      category: "Measurement",
      title: "Define a success metric",
      explanation:
        "Tracking campaign performance requires a measurable success metric before launch.",
      priority: "medium",
    })
  }

  return {
    evaluation,
    recommendations,
  }
}