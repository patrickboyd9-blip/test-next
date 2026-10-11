import { mediaTypeForKey, openUploadedDesign } from "@/lib/bring-your-own-design/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Streams an uploaded postcard face or the approved print file.
 * Local files and private Blob objects are both read here.
 * The browser does not open the private blob URL.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ campaignId: string; file: string }> }
): Promise<Response> {
  const { campaignId, file } = await context.params
  const opened = await openUploadedDesign(campaignId, file)
  if (!opened) return new Response("Not found", { status: 404 })

  return new Response(new Uint8Array(opened.bytes), {
    headers: {
      "Content-Type": mediaTypeForKey(file),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  })
}
