"use server"

import { redirect } from "next/navigation"

import { CampaignAccessError, requireOwnedCampaign } from "@/lib/auth/campaign-access"
import { getSession } from "@/lib/auth/session"
import { getCampaignRepository } from "@/lib/campaign-creator/repository"

import { advise, customerFacts } from "./advise"
import { readLibraryFiles } from "./library"

export async function saveGuidanceAction(campaignId: string): Promise<void> {
  const session = await getSession()
  if (!session) throw new CampaignAccessError(401, "Sign in required.")
  const campaign = await requireOwnedCampaign(campaignId)
  const guidance = advise({
    facts: customerFacts({
      businessName: campaign.brief.businessInfo?.name,
      offer: campaign.brief.offer,
      phone: campaign.brief.phone ?? campaign.brief.businessInfo?.phone,
      serviceAction: campaign.jobCreative?.serviceAction,
      trade: campaign.jobCreative?.trade,
    }),
    goal: campaign.brief.goal,
    files: readLibraryFiles(),
  })
  await getCampaignRepository().saveStrategyGuidance(campaignId, guidance, { explicit: true })
  redirect(`/app/campaigns/${campaignId}/guidance`)
}
