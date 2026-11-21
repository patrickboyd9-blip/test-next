import { getSession } from "@/lib/auth/session"
import { createDraftCampaign } from "@/lib/campaign-creator/actions"
import { keepEditedPhoto } from "@/lib/image-edit/keep-edit"
import { PHOTO_EDIT_SIGN_IN, PHOTO_KEPT, PHOTO_SAVE_FAILED } from "@/lib/image-edit/messages"
import { resolveUploadedDesignStore } from "@/lib/bring-your-own-design/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  const session = await getSession()
  if (!session) return Response.json({ ok: false, message: PHOTO_EDIT_SIGN_IN }, { status: 401 })

  let body: { imageBase64?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ ok: false, message: PHOTO_SAVE_FAILED }, { status: 400 })
  }
  if (typeof body.imageBase64 !== "string") {
    return Response.json({ ok: false, message: PHOTO_SAVE_FAILED }, { status: 400 })
  }

  let campaignId: string
  try {
    campaignId = (await createDraftCampaign()).id
  } catch {
    return Response.json({ ok: false, message: PHOTO_SAVE_FAILED }, { status: 500 })
  }

  const saved = await keepEditedPhoto({
    imageBase64: body.imageBase64,
    campaignId,
    store: resolveUploadedDesignStore(),
  })
  if (!saved.ok) return Response.json({ ok: false, message: saved.message }, { status: 400 })
  return Response.json({ ok: true, message: PHOTO_KEPT, campaignId })
}
