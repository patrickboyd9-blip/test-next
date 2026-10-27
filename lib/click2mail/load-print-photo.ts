import type { Campaign } from "@/lib/campaign-creator/types"
import { fingerprintForSpec, imageBriefContextFor } from "@/lib/campaign-creator/studio-image-fingerprint"
import { studioImageFileBase } from "@/lib/campaign-creator/studio-image-jobs"
import { openStudioImage } from "@/lib/campaign-creator/studio-image-store"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { readRasterSize } from "@/lib/print-spec/raster"
import { MIN_EFFECTIVE_DPI, type PostcardPrintImage } from "@/lib/print-spec/render-campaign-postcard-pdf"
import { upscaleToPrintCanvas } from "@/lib/print-spec/upscale-print-image"

/**
 * The Studio photograph for print. A saved final file wins. A preview is
 * used when the final has not been generated yet, and either file is
 * enlarged to the 300 DPI canvas when it is still preview-sized.
 * openStudioImage already returns the bytes for a local file or a private blob.
 */
export async function loadFinalPostcardPhoto(
  campaign: Campaign
): Promise<PostcardPrintImage | null> {
  const mailPiece = campaign.mailPiece
  if (!mailPiece) return null
  const fingerprint = fingerprintForSpec(
    mailPiece.spec,
    imageBriefContextFor(mailPiece.directionId, campaign.brief)
  )
  if (!fingerprint) return null

  const finalName = `${studioImageFileBase(mailPiece.directionId, fingerprint, "final")}.png`
  const previewName = `${studioImageFileBase(mailPiece.directionId, fingerprint, "preview")}.png`
  const opened = await openStudioImage(campaign.id, finalName)
  const file = opened && opened.bytes.length > 0 ? opened : await openStudioImage(campaign.id, previewName)
  if (!file || file.bytes.length === 0) return null

  const size = readRasterSize(file.bytes)
  return upscaleToPrintCanvas(
    { bytes: file.bytes, width: size.width, height: size.height },
    buildPostcard5x8PrintSpec().artworkCanvasInches,
    MIN_EFFECTIVE_DPI
  )
}
