import type { Campaign } from "@/lib/campaign-creator/types"

import { advise, customerFacts } from "./advise"
import { readLibraryFiles } from "./library"

/** The line above the editor. A missing note file must not take the page down. */
export function campaignEditorNote(
  campaign: Campaign,
  files: () => Record<string, string> = readLibraryFiles
): string {
  if (campaign.strategyGuidance) {
    return campaign.strategyGuidance.status === "limited"
      ? "Saved guidance is limited. It is not a research finding."
      : `Saved guidance: ${campaign.strategyGuidance.plans[0]?.id ?? "limited"}. Not a performance claim.`
  }
  try {
    const status = advise({
      facts: customerFacts({
        businessName: campaign.brief.businessInfo?.name,
        offer: campaign.brief.offer,
        phone: campaign.brief.phone,
        serviceAction: campaign.jobCreative?.serviceAction,
        trade: campaign.jobCreative?.trade,
      }),
      goal: campaign.brief.goal,
      files: files(),
    }).status
    return status === "limited"
      ? "Guidance for this trade is limited. No home-service plan was substituted."
      : "A sourced recommendation is ready. It is not a promise of more replies."
  } catch {
    return "Guidance for this trade is limited. No home-service plan was substituted."
  }
}
