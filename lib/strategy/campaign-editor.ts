import type { Campaign } from "@/lib/campaign-creator/types"

import { advise, customerFacts } from "./advise"
import { readLibraryFiles } from "./library"

export type CampaignEditorLoad =
  | { ok: true; campaign: Campaign; note: string }
  | { ok: false; reason: "missing" | "unavailable" }

/**
 * Opens the editor without letting a missing note file or a store error
 * become the Next.js server-error page.
 */
export async function loadCampaignEditor(
  id: string,
  load: (campaignId: string) => Promise<Campaign | null>,
  files: () => Record<string, string> = readLibraryFiles
): Promise<CampaignEditorLoad> {
  let campaign: Campaign | null
  try {
    campaign = await load(id)
  } catch {
    return { ok: false, reason: "unavailable" }
  }
  if (!campaign) return { ok: false, reason: "missing" }
  return { ok: true, campaign, note: guidanceNote(campaign, files) }
}

export function guidanceNote(campaign: Campaign, files: () => Record<string, string>): string {
  if (campaign.strategyGuidance) {
    return campaign.strategyGuidance.status === "limited"
      ? "Saved guidance is limited. It is not a research finding."
      : `Saved guidance: ${campaign.strategyGuidance.plans[0]?.id ?? "limited"}. Not a performance claim.`
  }
  let library: Record<string, string> = {}
  try {
    library = files()
  } catch {
    library = {}
  }
  const status = advise({
    facts: customerFacts({
      businessName: campaign.brief.businessInfo?.name,
      offer: campaign.brief.offer,
      phone: campaign.brief.phone,
      serviceAction: campaign.jobCreative?.serviceAction,
      trade: campaign.jobCreative?.trade,
    }),
    goal: campaign.brief.goal,
    files: library,
  }).status
  return status === "limited"
    ? "Guidance for this trade is limited. No home-service plan was substituted."
    : "A sourced recommendation is ready. It is not a promise of more replies."
}
