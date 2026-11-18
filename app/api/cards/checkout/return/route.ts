import { limitPublic } from "@/lib/ops/public-rate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  const limited = await limitPublic(request, "card-return", 30)
  if (limited) return limited
  return Response.json({ charged: false, mailed: false, message: "Returning from payment does not mark a card paid, and nothing was mailed." })
}
