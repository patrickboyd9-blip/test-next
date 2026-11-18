import { recordCardScan } from "@/lib/cards/service"
import { limitPublic } from "@/lib/ops/public-rate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Public on purpose. The person who receives the card is not signed in. */
export async function GET(request: Request, context: { params: Promise<{ code: string }> }): Promise<Response> {
  const limited = await limitPublic(request, "card-scan", 60)
  if (limited) return limited
  const { code } = await context.params
  const scan = await recordCardScan(code)
  if (!scan) return new Response("That link was not found.", { status: 404 })
  return Response.redirect(scan.destination, 302)
}
