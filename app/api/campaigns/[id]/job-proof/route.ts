import { denyUnlessCampaignOwner } from "@/lib/auth/campaign-access"
import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import { openStudioImage } from "@/lib/campaign-creator/studio-image-store"
import { renderJobProof } from "@/lib/job-photos/render"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Print proof of the saved job-photo crop. Does not generate a photograph. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params
  const denied = await denyUnlessCampaignOwner(id)
  if (denied) return denied
  const campaign = await getCampaignRepository().getCampaign(id)
  const creative = campaign?.jobCreative
  if (!creative) return new Response("Not found", { status: 404 })
  const photos = new Map<string, Uint8Array>()
  for (const photo of creative.photos) {
    const opened = await openStudioImage(id, photo.fileName)
    if (opened) photos.set(photo.fileName, opened.bytes)
  }
  const proof = await renderJobProof(creative, photos)
  return new Response(Buffer.from(proof.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  })
}
