import { getSession } from "@/lib/auth/session"
import { addPerson } from "@/lib/cards/service"
import type { CardAudience } from "@/lib/cards/pricing"
import { requireRate } from "@/lib/ops/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  const session = await getSession()
  if (!session) return Response.json({ error: "Sign in required." }, { status: 401 })
  await requireRate(`create:${session.userId}`)
  const body = (await request.json()) as {
    audience?: CardAudience
    name?: string
    month?: number
    day?: number
    address1?: string
    city?: string
    state?: string
    zip?: string
  }
  if (!body.name || !body.month || !body.day || !body.address1 || !body.city || !body.state || !body.zip) {
    return Response.json({ error: "Name, birthday, and address are required." }, { status: 400 })
  }
  const saved = await addPerson({
    ownerId: session.userId,
    audience: body.audience === "company" ? "company" : "personal",
    name: body.name,
    month: body.month,
    day: body.day,
    address1: body.address1,
    city: body.city,
    state: body.state,
    zip: body.zip,
  })
  return Response.json({
    personId: saved.person.id,
    cardId: saved.card.id,
    mailDate: saved.card.mailDate,
    recommendedOrderDate: saved.card.recommendedOrderDate,
    lockDate: saved.card.lockDate,
    priceCents: saved.card.priceCents,
    postageOnly: false,
    charged: false,
    mailed: false,
  })
}
