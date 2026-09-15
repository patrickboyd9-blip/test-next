import { getMailPiece } from "@/lib/mail-catalog/catalog"
import type { CampaignBrief } from "../campaign-creator/types"
import type { CampaignStrategy } from "./strategy-types"

import { generateRecommendations } from "./recommendation-engine"

export function generateCampaignStrategy(
  brief: CampaignBrief
): CampaignStrategy {
  const recommendationResult = generateRecommendations(brief)

  const catalogPiece = getMailPiece("postcard_5x8", 1)

  return {
    audience:
      brief.audience?.description ??
      "Define a specific audience before launching the campaign.",

    offer:
      brief.offer ??
      "A compelling offer should be developed for this campaign.",

    formatRecommendation: {
      catalogId: catalogPiece.id,
      catalogVersion: catalogPiece.version,
      source: "catalog_default",
      rationale:
        "This is the currently catalogued default mail piece. It is the only physical format Modern Mail can produce today, not a claim that it is the best format for every campaign.",
    },

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
