import { saveDesignFace } from "@/lib/bring-your-own-design/save-face"
import type { UploadedDesignStore } from "@/lib/bring-your-own-design/store"
import type { FinishedProofDetails } from "@/lib/campaign-creator/finished-proof"
import { getCampaignRepository, type CampaignRepository } from "@/lib/campaign-creator/repository"
import type { Campaign, UploadedDesign } from "@/lib/campaign-creator/types"

import { decodeKeptJpeg } from "./keep-edit"
import { PHOTO_SAVE_FAILED } from "./messages"

export async function acceptFinishedProof(input: {
  userId: string
  imageBase64: string
  businessName: string
  headline: string
  phone: string
  website?: string
  campaignName?: string
  size?: "5x8" | "6x9"
  repository?: CampaignRepository
  store?: UploadedDesignStore
  saveFace?: (campaign: Campaign, bytes: Buffer) => Promise<UploadedDesign>
}): Promise<{ ok: true; campaignId: string } | { ok: false; message: string }> {
  const bytes = decodeKeptJpeg(input.imageBase64)
  if (!bytes) return { ok: false, message: PHOTO_SAVE_FAILED }
  const details: FinishedProofDetails = {
    businessName: input.businessName,
    headline: input.headline,
    phone: input.phone,
    website: input.website ?? "",
    campaignName: input.campaignName,
    size: input.size,
  }
  if (details.businessName.trim().length < 2 || details.headline.trim().length < 2 || details.phone.trim().length < 7) {
    return { ok: false, message: PHOTO_SAVE_FAILED }
  }

  const repository = input.repository ?? getCampaignRepository()
  try {
    const created = await repository.createCampaign(input.userId)
    await repository.openFinishedProof(created.id, details)
    const opened = await repository.getCampaign(created.id)
    if (!opened) return { ok: false, message: PHOTO_SAVE_FAILED }
    const design = input.saveFace
      ? await input.saveFace(opened, bytes)
      : await saveDesignFace({
          campaign: opened,
          face: "front",
          fileName: "proof.jpg",
          bytes,
          declaredType: "image/jpeg",
          store: input.store,
        })
    await repository.saveUploadedDesign(created.id, design)
    return { ok: true, campaignId: created.id }
  } catch {
    return { ok: false, message: PHOTO_SAVE_FAILED }
  }
}
