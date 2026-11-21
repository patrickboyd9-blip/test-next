"use server"

import { getCampaign } from "@/lib/campaign-creator/actions"

import { ensureCampaignQr, type PageParts } from "./store"

export async function saveScanChoice(
  campaignId: string,
  choice: "page" | "website",
  website: string,
  parts?: Partial<PageParts>,
  phone?: string
): Promise<void> {
  const campaign = await getCampaign(campaignId)
  if (!campaign) return
  ensureCampaignQr({
    campaignId,
    ownerId: campaign.ownerId,
    destination: choice === "website" ? "website" : "hosted",
    website,
    phone: phone ?? (campaign.brief.phone || campaign.brief.businessInfo?.phone || ""),
    businessName: campaign.brief.businessInfo?.name || campaign.name || "",
    offerType: String(campaign.brief.primarySuccessMetric || "unspecified"),
    headline: campaign.name || campaign.brief.businessInfo?.name || "",
    offer: campaign.brief.offer || campaign.brief.goal || "",
    parts,
  })
}
