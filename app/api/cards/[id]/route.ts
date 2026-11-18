import { getSession } from "@/lib/auth/session"
import { CardRuleError, deleteUnlockedCard, updateUnlockedCard } from "@/lib/cards/service"
import { requireRate } from "@/lib/ops/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession()
  if (!session) return Response.json({ error: "Sign in required." }, { status: 401 })
  await requireRate(`create:${session.userId}`)
  const { id } = await context.params
  const body = (await request.json()) as { message?: string; fontId?: string; inkColorId?: string; name?: string }
  try {
    const card = await updateUnlockedCard(session.userId, id, {
      name: body.name,
      note: body.fontId || body.inkColorId || body.message !== undefined ? body : undefined,
    })
    return Response.json({ cardId: card.id, status: card.status, mailed: false, charged: card.charged })
  } catch (error) {
    const message = error instanceof CardRuleError ? error.message : "That card was not changed."
    return Response.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession()
  if (!session) return Response.json({ error: "Sign in required." }, { status: 401 })
  await requireRate(`create:${session.userId}`)
  const { id } = await context.params
  try {
    await deleteUnlockedCard(session.userId, id)
    return Response.json({ deleted: true, mailed: false, charged: false })
  } catch (error) {
    const message = error instanceof CardRuleError ? error.message : "That card was not deleted."
    return Response.json({ error: message }, { status: 400 })
  }
}
