import { coarsePlace, deviceFromAgent, VISITOR_COOKIE, visitorFromCookie } from "@/lib/analytics/read"
import { findQr, forwardTarget, logScan } from "@/lib/analytics/store"
import { limitPublic } from "@/lib/ops/public-rate"

export const dynamic = "force-dynamic"

/** Public on purpose. A mailed QR opens this, the scan is logged, then the browser moves on. */
export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
): Promise<Response> {
  const limited = await limitPublic(request, "qr-scan", 60)
  if (limited) return limited
  const { code } = await context.params
  const qr = findQr(code)
  if (!qr) return new Response("That code is not active.", { status: 404 })
  const visitor = visitorFromCookie(request.headers.get("cookie"))
  logScan({
    code,
    device: deviceFromAgent(request.headers.get("user-agent")),
    place: coarsePlace(request.headers),
    visitor: visitor.id,
    repeat: visitor.repeat,
  })
  const origin = new URL(request.url).origin
  const response = Response.redirect(forwardTarget(qr, origin), 302)
  if (!visitor.repeat) {
    response.headers.append(
      "set-cookie",
      `${VISITOR_COOKIE}=${visitor.id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`
    )
  }
  return response
}
