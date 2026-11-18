import { getSession } from "@/lib/auth/session"
import { reviewCardList } from "@/lib/cards/import"
import { requireRate } from "@/lib/ops/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  const session = await getSession()
  if (!session) return Response.json({ error: "Sign in required." }, { status: 401 })
  await requireRate(`create:${session.userId}`)
  const body = (await request.json()) as { text?: string }
  const review = reviewCardList(body.text ?? "")
  return Response.json({
    accepted: review.accepted.length,
    invalid: review.invalid,
    duplicates: review.duplicates,
    headerError: review.headerError,
    rows: review.accepted.map((row) => ({
      row: row.row,
      name: row.name,
      month: row.month,
      day: row.day,
      city: row.city,
      state: row.state,
    })),
  })
}
