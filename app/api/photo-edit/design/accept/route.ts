import { getSession } from "@/lib/auth/session"
import { PHOTO_EDIT_SIGN_IN, PHOTO_SAVE_FAILED } from "@/lib/image-edit/messages"
import { acceptDesignedProof } from "@/lib/qr-placement/accept-designed-proof"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  const session = await getSession()
  if (!session) return Response.json({ ok: false, message: PHOTO_EDIT_SIGN_IN }, { status: 401 })

  let body: {
    imageBase64?: unknown
    backBase64?: unknown
    businessName?: unknown
    headline?: unknown
    offer?: unknown
    phone?: unknown
    website?: unknown
    campaignName?: unknown
    size?: unknown
    qrs?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ ok: false, message: PHOTO_SAVE_FAILED }, { status: 400 })
  }

  const result = await acceptDesignedProof({
    userId: session.userId,
    imageBase64: typeof body.imageBase64 === "string" ? body.imageBase64 : "",
    backBase64: typeof body.backBase64 === "string" ? body.backBase64 : undefined,
    businessName: typeof body.businessName === "string" ? body.businessName : "",
    headline: typeof body.headline === "string" ? body.headline : "",
    offer: typeof body.offer === "string" ? body.offer : "",
    phone: typeof body.phone === "string" ? body.phone : "",
    website: typeof body.website === "string" ? body.website : "",
    campaignName: typeof body.campaignName === "string" ? body.campaignName : "",
    size: body.size === "6x9" ? "6x9" : "5x8",
    origin: new URL(request.url).origin,
    qrs: body.qrs,
  })
  if (!result.ok) return Response.json({ ok: false, message: result.message }, { status: 400 })
  return Response.json({ ok: true, campaignId: result.campaignId })
}
