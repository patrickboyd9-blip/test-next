import { findQr, logTap } from "@/lib/analytics/store"
import { clientIp, limitPublic } from "@/lib/ops/public-rate"

export const dynamic = "force-dynamic"

/** Counts the button tap, then opens the phone app with the customer's own number. */
export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
): Promise<Response> {
  const limited = await limitPublic(request, "page-tap", 30)
  if (limited) return limited
  const { code } = await context.params
  const qr = findQr(code)
  if (!qr?.parts.call || !qr.phone) return new Response("No phone number is on this page.", { status: 404 })
  logTap(code, "call", new Date().toISOString(), { ip: clientIp(request) })
  const digits = qr.phone.replace(/[^\d+]/g, "")
  return Response.redirect(`tel:${digits}`, 302)
}
