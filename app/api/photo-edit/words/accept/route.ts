import { getSession } from "@/lib/auth/session"
import { acceptFinishedProof } from "@/lib/image-edit/accept-finished-proof"
import { PHOTO_EDIT_SIGN_IN, PHOTO_SAVE_FAILED } from "@/lib/image-edit/messages"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  const session = await getSession()
  if (!session) return Response.json({ ok: false, message: PHOTO_EDIT_SIGN_IN }, { status: 401 })

  let body: {
    imageBase64?: unknown
    businessName?: unknown
    headline?: unknown
    phone?: unknown
    website?: unknown
    campaignName?: unknown
    size?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ ok: false, message: PHOTO_SAVE_FAILED }, { status: 400 })
  }

  const result = await acceptFinishedProof({
    userId: session.userId,
    imageBase64: typeof body.imageBase64 === "string" ? body.imageBase64 : "",
    businessName: typeof body.businessName === "string" ? body.businessName : "",
    headline: typeof body.headline === "string" ? body.headline : "",
    phone: typeof body.phone === "string" ? body.phone : "",
    website: typeof body.website === "string" ? body.website : "",
    campaignName: typeof body.campaignName === "string" ? body.campaignName : "",
    size: body.size === "6x9" ? "6x9" : body.size === "5x8" ? "5x8" : undefined,
  })
  if (!result.ok) return Response.json({ ok: false, message: result.message }, { status: 400 })
  return Response.json({ ok: true, campaignId: result.campaignId })
}
