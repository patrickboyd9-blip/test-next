import { isAtOrPastStatus } from "@/lib/campaign-creator/campaign-status"
import type { Campaign } from "@/lib/campaign-creator/types"

import { openUploadedDesign } from "./store"

/** Bytes of an approved upload, or null when the campaign uses Studio art. */
export async function loadApprovedUploadPdf(campaign: Campaign): Promise<Uint8Array | null> {
  if (campaign.designSource !== "upload") return null
  if (!isAtOrPastStatus(campaign.status, "creative_approved")) return null
  const key = campaign.uploadedDesign?.printFileKey
  if (!campaign.uploadedDesign?.approvedAt || !key) return null
  const file = await openUploadedDesign(campaign.id, key)
  if (!file) {
    throw new Error("The approved design could not be read. Approve the proof again.")
  }
  return file.bytes
}
