import { findQr, logTap } from "@/lib/analytics/store"
import { clientIp, limitPublic } from "@/lib/ops/public-rate"

export const dynamic = "force-dynamic"

/** Counts the booking-button tap, then opens their booking page. A tap is not a booked time. */
export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
): Promise<Response> {
  const limited = await limitPublic(request, "book-tap", 30)
  if (limited) return limited
  const { code } = await context.params
  const qr = findQr(code)
  const url = qr?.parts.booking ? qr.parts.bookingUrl : null
  if (!qr || !url) return new Response("No booking button is on this page.", { status: 404 })
  logTap(code, "booking", new Date().toISOString(), { ip: clientIp(request) })
  return Response.redirect(url, 302)
}
