import { getSession } from "@/lib/auth/session"
import { editFinishedWords } from "@/lib/image-edit/edit-finished-words"
import { PHOTO_EDIT_FAILED, PHOTO_EDIT_SIGN_IN } from "@/lib/image-edit/messages"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request): Promise<Response> {
  const session = await getSession()
  if (!session) return Response.json({ ok: false, message: PHOTO_EDIT_SIGN_IN, code: "sign-in" }, { status: 401 })

  let body: {
    templateId?: unknown
    businessName?: unknown
    headline?: unknown
    phone?: unknown
    website?: unknown
    extra?: unknown
    placement?: unknown
    logoBase64?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ ok: false, message: PHOTO_EDIT_FAILED, code: "invalid" }, { status: 400 })
  }

  const result = await editFinishedWords({
    userId: session.userId,
    templateId: typeof body.templateId === "string" ? body.templateId : "",
    businessName: typeof body.businessName === "string" ? body.businessName : "",
    headline: typeof body.headline === "string" ? body.headline : "",
    phone: typeof body.phone === "string" ? body.phone : "",
    website: typeof body.website === "string" ? body.website : "",
    extra: typeof body.extra === "string" ? body.extra : "",
    placement: typeof body.placement === "string" ? body.placement : null,
    logoBase64: typeof body.logoBase64 === "string" ? body.logoBase64 : undefined,
  })
  if (!result.ok) {
    return Response.json({ ok: false, message: result.message, code: result.code }, { status: result.status })
  }
  return Response.json({ ok: true, afterSrc: result.afterSrc, proof: result.proof })
}
