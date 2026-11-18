import { getSession } from "@/lib/auth/session"
import { CardRuleError, lockDueCards, openLockCheckout } from "@/lib/cards/service"
import { requireRate } from "@/lib/ops/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession()
  if (!session) return Response.json({ error: "Sign in required." }, { status: 401 })
  await requireRate(`charge:${session.userId}`)
  const { id } = await context.params
  const today = new Date().toISOString().slice(0, 10)
  try {
    await lockDueCards(session.userId, today)
    const checkout = await openLockCheckout({ ownerId: session.userId, cardId: id, origin: new URL(request.url).origin })
    return Response.json(checkout)
  } catch (error) {
    const message = error instanceof CardRuleError ? error.message : "Nothing was charged."
    return Response.json({ charged: false, mailed: false, error: message }, { status: 400 })
  }
}
