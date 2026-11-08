"use server"

import { reviewUploadedArtwork } from "@/lib/campaign-creator/creative-engine-provider"
import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import type { Campaign, DesignSource, UploadedDesignFile } from "@/lib/campaign-creator/types"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"

import { normalizeDesignReview, uploadComplianceWarnings } from "./design-review"
import { preflightBlocksApproval } from "./preflight"
import { renderUploadedPostcardPdf } from "./render-uploaded-pdf"
import { openUploadedDesign, resolveUploadedDesignStore, uploadedDesignKey } from "./store"
import type { UploadPathBasics } from "./upload-path"

const repository = getCampaignRepository()

export async function chooseDesignPath(
  campaignId: string,
  source: DesignSource
): Promise<Campaign> {
  return repository.setDesignSource(campaignId, source)
}

export async function beginUploadedDesignPath(
  campaignId: string,
  basics: UploadPathBasics
): Promise<Campaign> {
  return repository.beginUploadPath(campaignId, basics)
}

export async function leaveUploadedDesignPath(campaignId: string): Promise<Campaign> {
  return repository.leaveUploadPath(campaignId)
}

export async function declineUploadedDesignReview(campaignId: string): Promise<Campaign> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign?.uploadedDesign) throw new Error(`Campaign ${campaignId} not found`)
  return repository.saveUploadedDesignReview(campaignId, { declined: true })
}

export async function requestUploadedDesignReview(campaignId: string): Promise<Campaign> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)
  const design = campaign.uploadedDesign
  if (campaign.designSource !== "upload" || !design?.front || !design.back) {
    throw new Error("Upload the front and the back before asking for a review.")
  }
  if (preflightBlocksApproval(design.issues)) {
    throw new Error("Fix the file problems before asking for a review.")
  }

  const front = await openPreparedFace(campaign.id, design.front)
  const back = await openPreparedFace(campaign.id, design.back)
  if (!front || !back) {
    throw new Error("The uploaded files could not be read. Upload them again.")
  }

  let suggestions: string[]
  let complianceWarnings: string[] = []
  try {
    const result = await reviewUploadedArtwork({
      front: { bytes: front.bytes, mediaType: front.mediaType },
      back: { bytes: back.bytes, mediaType: back.mediaType },
    })
    suggestions = normalizeDesignReview({ suggestions: result.suggestions })
    complianceWarnings = uploadComplianceWarnings(result.printedText, campaign.brief)
  } catch (error) {
    console.error("Uploaded design review failed:", error)
    throw new Error("We couldn't finish that review. You can still approve the proof.")
  }

  return repository.saveUploadedDesignReview(campaignId, {
    suggestions,
    ...(complianceWarnings.length ? { complianceWarnings } : {}),
    reviewedAt: new Date().toISOString(),
  })
}

export async function approveUploadedDesign(
  campaignId: string,
  options?: { acceptAddressCover?: boolean }
): Promise<Campaign> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)
  const design = campaign.uploadedDesign
  if (campaign.designSource !== "upload" || !design?.front || !design.back) {
    throw new Error("Upload the front and the back before approving.")
  }
  if (preflightBlocksApproval(design.issues)) {
    throw new Error("Fix the file problems before approving.")
  }

  if (design.issues.some((item) => item.code === "keep_out") && !options?.acceptAddressCover) {
    throw new Error("The address will cover part of the back. Confirm that before approving.")
  }

  const front = await openPreparedFace(campaign.id, design.front)
  const back = await openPreparedFace(campaign.id, design.back)
  if (!front || !back) {
    throw new Error("The uploaded files could not be read. Upload them again.")
  }

  const pdf = await renderUploadedPostcardPdf({
    geometry: buildPostcard5x8PrintSpec(),
    front,
    back,
  })
  const key = uploadedDesignKey("print", "application/pdf")
  await resolveUploadedDesignStore().put(campaign.id, key, Buffer.from(pdf), "application/pdf")
  return repository.approveUploadedDesign(campaign.id, key)
}

async function openPreparedFace(
  campaignId: string,
  file: UploadedDesignFile
): Promise<{ bytes: Uint8Array; mediaType: "application/pdf" | "image/png" | "image/jpeg" } | null> {
  if (file.preparedKey) {
    const prepared = await openUploadedDesign(campaignId, file.preparedKey)
    if (prepared) {
      return { bytes: prepared.bytes, mediaType: file.preparedMediaType ?? "image/png" }
    }
  }
  const original = await openUploadedDesign(campaignId, file.key)
  if (!original) return null
  return { bytes: original.bytes, mediaType: file.mediaType }
}
