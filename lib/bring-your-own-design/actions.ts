"use server"

import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import type { Campaign, DesignSource } from "@/lib/campaign-creator/types"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"

import { preflightBlocksApproval } from "./preflight"
import { renderUploadedPostcardPdf } from "./render-uploaded-pdf"
import { openUploadedDesign, resolveUploadedDesignStore, uploadedDesignKey } from "./store"

const repository = getCampaignRepository()

export async function chooseDesignPath(
  campaignId: string,
  source: DesignSource
): Promise<Campaign> {
  return repository.setDesignSource(campaignId, source)
}

export async function approveUploadedDesign(campaignId: string): Promise<Campaign> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)
  const design = campaign.uploadedDesign
  if (campaign.designSource !== "upload" || !design?.front || !design.back) {
    throw new Error("Upload the front and the back before approving.")
  }
  if (preflightBlocksApproval(design.issues)) {
    throw new Error("Fix the file problems before approving.")
  }

  const front = await openUploadedDesign(campaign.id, design.front.key)
  const back = await openUploadedDesign(campaign.id, design.back.key)
  if (!front || !back) {
    throw new Error("The uploaded files could not be read. Upload them again.")
  }

  const pdf = await renderUploadedPostcardPdf({
    geometry: buildPostcard5x8PrintSpec(),
    front: { bytes: front.bytes, mediaType: design.front.mediaType },
    back: { bytes: back.bytes, mediaType: design.back.mediaType },
  })
  const key = uploadedDesignKey("print", "application/pdf")
  await resolveUploadedDesignStore().put(campaign.id, key, Buffer.from(pdf), "application/pdf")
  return repository.approveUploadedDesign(campaign.id, key)
}
