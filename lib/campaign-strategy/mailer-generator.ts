import type { CampaignBrief } from "../campaign-creator/types"

import type { GeneratedMailer } from "./mailer-types"

import { generateCampaignStrategy } from "./strategy-generator"

export function generateMailerSkeleton(
  brief: CampaignBrief
): GeneratedMailer {
  const strategy = generateCampaignStrategy(brief)

  return {
    headline:
      strategy.messaging[0] ??
      "Your headline goes here.",

    subheadline:
      strategy.messaging[1] ??
      strategy.offer,

    front: {
      title: "Front",
      content:
        "The AI will generate the complete front side of the mail piece here.",
    },

    back: {
      title: "Back",
      content:
        "The AI will generate the back side of the mail piece here.",
    },

    callToAction: strategy.callToAction,

    offer: strategy.offer,

    imageSuggestions: [
      "Relevant hero image",
      "Brand logo",
      "QR code",
    ],

    layoutNotes: [
      `Recommended format: ${strategy.mailFormat}`,
      "Keep headline dominant.",
      "Use a clear visual hierarchy.",
    ],

    complianceNotes: [],

    reasoning: [
      "Mailer generated from campaign strategy.",
      "Industry recommendations were incorporated.",
    ],
  }
}