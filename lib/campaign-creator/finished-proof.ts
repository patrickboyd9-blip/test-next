import type { Campaign } from "./types"
import { assignDefaultMailPieceSpec } from "./mail-piece"

/** Words the customer just put on a finished postcard. */
export interface FinishedProofDetails {
  businessName: string
  headline: string
  phone: string
  website: string
  /** The name from the gallery form. The business name is used when this is empty. */
  campaignName?: string
  size?: "5x8" | "6x9"
}

/**
 * Opens the upload proof on a fresh draft and keeps the edited front.
 * The return address is still empty. The customer adds the back in the proof.
 */
export function applyFinishedProofStart(campaign: Campaign, input: FinishedProofDetails, now: string): void {
  if (campaign.status !== "draft" || campaign.designSource || campaign.entry) {
    throw new Error("Start from a new campaign to keep this proof.")
  }
  const businessName = input.businessName.trim().slice(0, 80) || "Postcard"
  const phone = input.phone.trim().slice(0, 40)
  const website = input.website.trim().slice(0, 120)
  const campaignName = input.campaignName?.trim().slice(0, 80)
  campaign.name = campaignName || businessName
  campaign.entry = "upload"
  campaign.designSource = "upload"
  campaign.postcardSize = input.size === "6x9" ? "6x9" : "5x8"
  campaign.brief = {
    ...campaign.brief,
    offer: input.headline.trim().slice(0, 120),
    phone,
    website: website || undefined,
    businessInfo: {
      ...campaign.brief.businessInfo,
      name: businessName,
      phone,
      website: website || undefined,
    },
  }
  assignDefaultMailPieceSpec(campaign, now)
  campaign.status = "strategy_confirmed"
  campaign.updatedAt = now
}
