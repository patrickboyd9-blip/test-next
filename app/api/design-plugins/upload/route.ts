import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import { pluginUserId, uploadPluginDesign } from "@/lib/design-plugins/handoff"
import { RateLimitError, requireRate } from "@/lib/ops/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: cors })
}

export async function POST(request: Request): Promise<Response> {
  const userId = await pluginUserId(request)
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401, headers: cors })
  try {
    await requireRate(`proof:${userId}`)
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ error: error.message }, { status: 429, headers: cors })
    }
    throw error
  }
  const body = (await request.json()) as {
    campaignId?: string
    face?: string
    fileName?: string
    contentBase64?: string
    businessName?: string
    street?: string
    city?: string
    state?: string
    postalCode?: string
  }
  try {
    const saved = await uploadPluginDesign(userId, body, getCampaignRepository())
    return Response.json(saved, { headers: cors })
  } catch (error) {
    const message = error instanceof Error ? error.message : "The design was not uploaded."
    return Response.json({ error: message, mailed: false, charged: false }, { status: 400, headers: cors })
  }
}
