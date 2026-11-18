import { recordScan } from "@/lib/tracking/ledger"
import { appendAudit } from "@/lib/ops/audit"
import { limitPublic } from "@/lib/ops/public-rate"

export const dynamic = "force-dynamic"

/** Public on purpose. A mailed QR code is opened by the recipient. */
export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
): Promise<Response> {
  const limited = await limitPublic(request, "mail-scan", 60)
  if (limited) return limited
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
