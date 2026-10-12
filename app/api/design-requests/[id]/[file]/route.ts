import { readDesignRequestImage } from "@/lib/design-requests/read"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Streams a logo or reference image from a design request.
 * Local files and private Blob objects are both read here.
 * The browser does not open the private blob URL.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; file: string }> }
): Promise<Response> {
  const { id, file } = await context.params
  const opened = await readDesignRequestImage(id, file)
  if (!opened) return new Response("Not found", { status: 404 })

  return new Response(new Uint8Array(opened.bytes), {
    headers: {
      "Content-Type": opened.mediaType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  })
}
