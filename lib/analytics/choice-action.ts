"use server"

import { getCampaign } from "@/lib/campaign-creator/actions"

import { ensureCampaignQr } from "./store"

export async function saveScanChoice(
  campaignId: string,
  choice: "page" | "website",
  website: string
): Promise<void> {
  const campaign = await getCampaign(campaignId)
  if (!campaign) return
  ensureCampaignQr({
    campaignId,
    ownerId: campaign.ownerId,
    destination: choice === "website" ? "website" : "hosted",
    website,
    phone: campaign.brief.phone || campaign.brief.businessInfo?.phone || "",
    headline: campaign.name || campaign.brief.businessInfo?.name || "",
    offer: campaign.brief.offer || campaign.brief.goal || "",
  })
}
