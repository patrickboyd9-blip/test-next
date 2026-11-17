"use server"

import { redirect } from "next/navigation"

import { CampaignAccessError, requireOwnedCampaign } from "@/lib/auth/campaign-access"
import { getSession } from "@/lib/auth/session"
import { getCampaignRepository } from "@/lib/campaign-creator/repository"

import { noteForSession } from "@/lib/ledger/note"

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
  const saved = await getCampaignRepository().saveStrategyGuidance(campaignId, guidance, { explicit: true })
  await noteForSession({
    campaignId,
    type: "guidance_saved",
    outcome: "completed",
    versionKey: `${saved.strategyGuidance?.sourceVersion ?? guidance.sourceVersion}:${saved.strategyGuidance?.facts.offer ?? ""}`,
    creativeVersion: saved.strategyGuidance?.sourceVersion ?? null,
    listHash: null,
    listCount: null,
    amountCents: null,
    note: "Guidance saved. No replies were measured.",
  })
  redirect(`/app/campaigns/${campaignId}/guidance`)
}
