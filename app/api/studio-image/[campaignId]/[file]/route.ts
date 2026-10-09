import { openStudioImage } from "@/lib/campaign-creator/studio-image-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Cached Studio photograph. Not customer artwork upload and not the print-spec guide.
 * Local files are served directly. Blob-backed files redirect to the public blob URL.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ campaignId: string; file: string }> }
): Promise<Response> {
  const { campaignId, file } = await context.params
  const image = await openStudioImage(campaignId, file)
  if (!image) return new Response("Not found", { status: 404 })

  if (image.kind === "redirect") {
    return new Response(null, {
      status: 307,
      headers: {
        Location: image.url,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  }

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
