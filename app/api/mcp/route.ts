import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import { resolveUploadedDesignStore } from "@/lib/bring-your-own-design/store"
import { getJourneyStore } from "@/lib/mail-journey/job"
import { corsHeaders, principalFromAuthorization, unauthorizedResponse } from "@/lib/mcp/http"
import { handleMcp } from "@/lib/mcp/protocol"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export function GET(): Response {
  return Response.json(
    { error: "Send assistant messages with POST." },
    { status: 405, headers: { Allow: "POST, OPTIONS", ...corsHeaders() } }
  )
}

export async function POST(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin
  const principal = await principalFromAuthorization(request.headers.get("authorization"))
  if (!principal) return unauthorizedResponse(origin)
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "The message could not be read." } },
      { status: 400, headers: corsHeaders() }
    )
  }
  const result = await handleMcp(body, {
    userId: principal.userId,
    origin,
    repository: getCampaignRepository(),
    journey: getJourneyStore(),
    designs: resolveUploadedDesignStore(),
  })
  if (result === null) return new Response(null, { status: 202, headers: corsHeaders() })
  return Response.json(result, { headers: corsHeaders() })
}
