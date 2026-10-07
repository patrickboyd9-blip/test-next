import { readFile } from "fs/promises"

import { resolveStudioImageFile } from "@/lib/campaign-creator/studio-image-paths"

/**
 * Cached Studio photograph. Not customer artwork upload and not the print-spec guide.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ campaignId: string; file: string }> }
): Promise<Response> {
  const { campaignId, file } = await context.params
  const filePath = resolveStudioImageFile(campaignId, file)
  if (!filePath) return new Response("Not found", { status: 404 })

  try {
    const bytes = await readFile(filePath)
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
