import { recordCardScan } from "@/lib/cards/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await context.params
  const scan = await recordCardScan(code)
  if (!scan) return new Response("That link was not found.", { status: 404 })
  return Response.redirect(scan.destination, 302)
}
