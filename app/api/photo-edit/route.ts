import { getSession } from "@/lib/auth/session"
import { editCustomerPhoto } from "@/lib/image-edit/edit-customer-photo"
import { PHOTO_EDIT_FAILED, PHOTO_EDIT_SIGN_IN } from "@/lib/image-edit/messages"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request): Promise<Response> {
  const session = await getSession()
  if (!session) return Response.json({ ok: false, message: PHOTO_EDIT_SIGN_IN }, { status: 401 })

  let body: { templateId?: unknown; imageBase64?: unknown; instruction?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ ok: false, message: PHOTO_EDIT_FAILED }, { status: 400 })
  }

  const result = await editCustomerPhoto({
    userId: session.userId,
    templateId: typeof body.templateId === "string" ? body.templateId : undefined,
    imageBase64: typeof body.imageBase64 === "string" ? body.imageBase64 : undefined,
    instruction: typeof body.instruction === "string" ? body.instruction : "",
  })
  if (!result.ok) return Response.json({ ok: false, message: result.message }, { status: result.status })
  return Response.json({ ok: true, afterSrc: result.afterSrc, editId: result.editId })
}
