import { recordScan } from "@/lib/tracking/ledger"
import { appendAudit } from "@/lib/ops/audit"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> }
): Promise<Response> {
  const { code } = await context.params
  const hit = recordScan(code)
  if (!hit) return new Response("That code is not active.", { status: 404 })
  await appendAudit({
    actorId: "scan",
    action: "scan",
    subjectId: hit.scan.campaignId,
    before: null,
    after: { recipientId: hit.scan.recipientId, at: hit.scan.at },
  })
  return Response.redirect(hit.destination, 302)
}
