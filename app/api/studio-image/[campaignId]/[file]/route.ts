import { openStudioImage } from "@/lib/campaign-creator/studio-image-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Cached Studio photograph. Not customer artwork upload and not the print-spec guide.
 * Local files and private Blob objects are both streamed from here.
 * The filename includes the photograph's fingerprint, so the bytes do not change.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ campaignId: string; file: string }> }
): Promise<Response> {
  const { campaignId, file } = await context.params
  const image = await openStudioImage(campaignId, file)
  if (!image) return new Response("Not found", { status: 404 })

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
