import type { Campaign } from "@/lib/campaign-creator/types"
import { fingerprintForSpec, imageBriefContextFor } from "@/lib/campaign-creator/studio-image-fingerprint"
import { studioImageFileBase } from "@/lib/campaign-creator/studio-image-jobs"
import { openStudioImage } from "@/lib/campaign-creator/studio-image-store"
import { readRasterSize } from "@/lib/print-spec/raster"
import type { PostcardPrintImage } from "@/lib/print-spec/render-campaign-postcard-pdf"

/**
 * The final-tier Studio photograph, when one has been saved.
 * A preview is not used: enlarging it would drop below 300 DPI.
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
  if (!opened) return null

  const bytes = opened.kind === "bytes" ? opened.bytes : await readRemote(opened.url)
  if (!bytes || bytes.length === 0) return null
  const size = readRasterSize(bytes)
  return { bytes, width: size.width, height: size.height }
}

async function readRemote(url: string): Promise<Buffer | null> {
  const response = await fetch(url)
  if (!response.ok) return null
  return Buffer.from(await response.arrayBuffer())
}
