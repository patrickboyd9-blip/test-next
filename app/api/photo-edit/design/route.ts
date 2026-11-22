import { getSession } from "@/lib/auth/session"
import { editLockedHero } from "@/lib/image-edit/edit-locked-hero"
import { HERO_EDIT_FAILED, PHOTO_EDIT_SIGN_IN } from "@/lib/image-edit/messages"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request): Promise<Response> {
  const session = await getSession()
  if (!session) return Response.json({ ok: false, message: PHOTO_EDIT_SIGN_IN, code: "sign-in" }, { status: 401 })

  let body: {
    templateId?: unknown
    campaignName?: unknown
    size?: unknown
    businessName?: unknown
    offer?: unknown
    callToAction?: unknown
    phone?: unknown
    website?: unknown
    instructions?: unknown
    changeNote?: unknown
    phoneOnFront?: unknown
    logoBase64?: unknown
    currentFrontBase64?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ ok: false, message: HERO_EDIT_FAILED, code: "invalid" }, { status: 400 })
  }

  const result = await editLockedHero({
    userId: session.userId,
    templateId: typeof body.templateId === "string" ? body.templateId : "",
    campaignName: typeof body.campaignName === "string" ? body.campaignName : "",
    size: typeof body.size === "string" ? body.size : null,
    businessName: typeof body.businessName === "string" ? body.businessName : "",
    offer: typeof body.offer === "string" ? body.offer : "",
    callToAction: typeof body.callToAction === "string" ? body.callToAction : "",
    phone: typeof body.phone === "string" ? body.phone : "",
    website: typeof body.website === "string" ? body.website : "",
    instructions: typeof body.instructions === "string" ? body.instructions : "",
    changeNote: typeof body.changeNote === "string" ? body.changeNote : "",
    phoneOnFront: body.phoneOnFront !== false,
    logoBase64: typeof body.logoBase64 === "string" ? body.logoBase64 : undefined,
    currentFrontBase64: typeof body.currentFrontBase64 === "string" ? body.currentFrontBase64 : undefined,
  })
  if (!result.ok) {
    return Response.json({ ok: false, message: result.message, code: result.code }, { status: result.status })
  }
  return Response.json({ ok: true, frontSrc: result.frontSrc, backSrc: result.backSrc, proof: result.proof })
}
