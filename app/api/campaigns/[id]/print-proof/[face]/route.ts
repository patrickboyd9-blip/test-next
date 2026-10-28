import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import { renderAiPrintFile } from "@/lib/click2mail/ai-print-file"
import { printFileKeepOutIssues, printFilePage } from "@/lib/print-spec/print-proof"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const repository = getCampaignRepository()

/**
 * The approved AI postcard's print file, one face at a time, for the proof.
 * `check` returns the address-area check as JSON.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; face: string }> }
): Promise<Response> {
  const { id, face } = await context.params
  if (face !== "front" && face !== "back" && face !== "check") return new Response("Not found", { status: 404 })
  const campaign = await repository.getCampaign(id)
  if (!campaign?.mailPiece) return new Response("Not found", { status: 404 })
  let file
  try {
    file = await renderAiPrintFile(campaign)
  } catch (error) {
    const message = error instanceof Error ? error.message : "The print file could not be built."
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
  if (face === "check") {
    const issues = await printFileKeepOutIssues(file.bytes, file.size)
    return new Response(JSON.stringify({ issues, size: file.size }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
    })
  }
  const page = await printFilePage(file.bytes, face)
  return new Response(new Uint8Array(page), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "private, no-store" },
  })
}
