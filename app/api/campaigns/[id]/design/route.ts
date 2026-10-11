import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import { saveDesignFace } from "@/lib/bring-your-own-design/save-face"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const repository = getCampaignRepository()

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params
  const campaign = await repository.getCampaign(id)
  if (!campaign) return json({ error: "Campaign not found." }, 404)
  if (campaign.designSource !== "upload") {
    return json({ error: "Choose upload before adding a design." }, 400)
  }
  if (campaign.mailPiece || campaign.status === "creative_approved") {
    return json({ error: "Unapprove the postcard before replacing the design." }, 400)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json({ error: "The upload could not be read. Try a smaller PDF, PNG, or JPG." }, 400)
  }

  const face = form.get("face")
  const file = form.get("file")
  if (face !== "front" && face !== "back") {
    return json({ error: "Choose the front or the back." }, 400)
  }
  if (!(file instanceof File)) {
    return json({ error: "Choose a PDF, PNG, or JPG." }, 400)
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const design = await saveDesignFace({
    campaign,
    face,
    fileName: file.name,
    bytes,
    declaredType: file.type,
  })
  const saved = await repository.saveUploadedDesign(id, design)
  return json({ campaign: saved })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
