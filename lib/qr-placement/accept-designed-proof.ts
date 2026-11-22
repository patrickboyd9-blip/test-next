import { saveDesignFace } from "@/lib/bring-your-own-design/save-face"
import type { UploadedDesignStore } from "@/lib/bring-your-own-design/store"
import { getCampaignRepository, type CampaignRepository } from "@/lib/campaign-creator/repository"
import { acceptFinishedProof } from "@/lib/image-edit/accept-finished-proof"
import { decodeKeptJpeg } from "@/lib/image-edit/keep-edit"
import { PHOTO_SAVE_FAILED } from "@/lib/image-edit/messages"
import type { Click2MailSize } from "@/lib/print-spec/click2mail-keep-outs"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"

import { paintBackForSave, paintQrsOnFace, type QrMark } from "./composite"
import { qrScanUrl, sanitizePlacedQrs, type SanitizedQr } from "./model"
import { assignScanCodes, registerPlacedQrs } from "./register"

export async function acceptDesignedProof(input: {
  userId: string
  imageBase64: string
  businessName: string
  headline: string
  offer?: string
  phone: string
  website?: string
  campaignName?: string
  size?: Click2MailSize
  origin: string
  /** Omitted, or an empty list, keeps the proof exactly as the edit returned it. */
  qrs?: unknown
  backBase64?: string
  repository?: CampaignRepository
  store?: UploadedDesignStore
  saveFace?: Parameters<typeof acceptFinishedProof>[0]["saveFace"]
  saveBack?: (bytes: Buffer) => Promise<void>
}): Promise<{ ok: true; campaignId: string } | { ok: false; message: string }> {
  const size: Click2MailSize = input.size === "6x9" ? "6x9" : "5x8"
  const front = decodeKeptJpeg(input.imageBase64)
  if (!front) return { ok: false, message: PHOTO_SAVE_FAILED }

  const sanitized = sanitizePlacedQrs(size, input.qrs ?? [])
  if (!sanitized.ok) return sanitized
  const codes = assignScanCodes(sanitized.codes)
  let paintedFront = front
  try {
    paintedFront = await paintSide(front, size, "trim", codes, "front", input.origin)
  } catch {
    return { ok: false, message: PHOTO_SAVE_FAILED }
  }

  const result = await acceptFinishedProof({
    userId: input.userId,
    imageBase64: `data:image/jpeg;base64,${paintedFront.toString("base64")}`,
    businessName: input.businessName,
    headline: input.headline,
    phone: input.phone,
    website: input.website,
    campaignName: input.campaignName,
    size,
    repository: input.repository,
    store: input.store,
    saveFace: input.saveFace,
  })
  if (!result.ok) return result
  if (codes.length === 0) return result

  const registered = registerPlacedQrs({
    campaignId: result.campaignId,
    ownerId: input.userId,
    origin: input.origin,
    businessName: input.businessName,
    headline: input.headline,
    offer: input.offer?.trim() || input.headline,
    phone: input.phone,
    codes,
  })
  if (registered.length !== codes.length) return { ok: false, message: PHOTO_SAVE_FAILED }

  const backCodes = codes.filter((code) => code.side === "back")
  if (backCodes.length === 0) return result
  const back = input.backBase64 ? decodeKeptJpeg(input.backBase64) : null
  if (!back) return { ok: false, message: PHOTO_SAVE_FAILED }
  try {
    const paintedBack = await paintBackForSave(back, size, marksFor(backCodes, input.origin))
    if (input.saveBack) {
      await input.saveBack(paintedBack)
      return result
    }
    const repository = input.repository ?? getCampaignRepository()
    const campaign = await repository.getCampaign(result.campaignId)
    if (!campaign) return { ok: false, message: PHOTO_SAVE_FAILED }
    const design = await saveDesignFace({
      campaign,
      face: "back",
      fileName: "back.jpg",
      bytes: paintedBack,
      declaredType: "image/jpeg",
      store: input.store,
      geometry: size === "6x9" ? buildPostcard6x9PrintSpec() : buildPostcard5x8PrintSpec(),
    })
    await repository.saveUploadedDesign(result.campaignId, design)
  } catch {
    return { ok: false, message: PHOTO_SAVE_FAILED }
  }
  return result
}

async function paintSide(
  image: Buffer,
  size: Click2MailSize,
  frame: "trim" | "canvas",
  codes: readonly SanitizedQr[],
  side: SanitizedQr["side"],
  origin: string
): Promise<Buffer> {
  const marks = marksFor(codes.filter((code) => code.side === side), origin)
  if (marks.length === 0) return image
  return paintQrsOnFace(image, { size, frame, marks })
}

function marksFor(codes: readonly SanitizedQr[], origin: string): QrMark[] {
  return codes.map((code) => ({
    xInches: code.xInches,
    yInches: code.yInches,
    sizeInches: code.sizeInches,
    payload: qrScanUrl(origin, code.code),
  }))
}
