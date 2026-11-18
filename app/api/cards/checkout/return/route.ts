export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function GET(): Response {
  return Response.json({ charged: false, mailed: false, message: "Returning from payment does not mark a card paid, and nothing was mailed." })
}
