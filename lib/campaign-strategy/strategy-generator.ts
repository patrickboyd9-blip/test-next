import type { CampaignBrief } from "../campaign-creator/types"
import type { CampaignStrategy } from "./strategy-types"

import { generateRecommendations } from "./recommendation-engine"
import { findIndustryPlaybook } from "./playbooks"

export function generateCampaignStrategy(
  brief: CampaignBrief
): CampaignStrategy {
  const recommendationResult = generateRecommendations(brief)

  const searchableText = JSON.stringify(brief)

  const playbook = findIndustryPlaybook(searchableText)

  return {
    audience:
      brief.audience?.description ??
      "Define a specific audience before launching the campaign.",

    offer:
      brief.offer ??
      "A compelling offer should be developed for this campaign.",

    mailFormat:
      playbook
        ? "Recommended by industry playbook."
        : "6x11 Oversized Postcard",

    cadence: "Three mailings over 30 days",

    messaging: recommendationResult.recommendations.map(
      (recommendation) => recommendation.title
    ),

    callToAction:
      "Call today or scan the QR code to schedule your appointment.",

      successMetrics: [
        String(brief.primarySuccessMetric ?? "Phone calls"),
        "Appointments booked",
        "Cost per acquisition",
        "Return on investment",
      ],

    assumptions:
      recommendationResult.evaluation.confidence === "low"
        ? [
            "Some campaign details were missing and reasonable assumptions were made.",
          ]
        : [],
  }
}