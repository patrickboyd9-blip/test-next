import type { Campaign } from "@/lib/campaign-creator/types"
import { fingerprintForSpec, imageBriefContextFor } from "@/lib/campaign-creator/studio-image-fingerprint"
import { studioImageFileBase } from "@/lib/campaign-creator/studio-image-jobs"
import { openStudioImage } from "@/lib/campaign-creator/studio-image-store"
import { readRasterSize } from "@/lib/print-spec/raster"
import type { PostcardPrintImage } from "@/lib/print-spec/render-campaign-postcard-pdf"

/**
 * The final-tier Studio photograph, when one has been saved.
 * A preview is not used: enlarging it would drop below 300 DPI.
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

  const fileName = `${studioImageFileBase(mailPiece.directionId, fingerprint, "final")}.png`
  const opened = await openStudioImage(campaign.id, fileName)
  if (!opened || opened.bytes.length === 0) return null

  const size = readRasterSize(opened.bytes)
  return { bytes: opened.bytes, width: size.width, height: size.height }
}
