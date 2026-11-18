import { authorizationServerMetadata } from "@/lib/mcp/oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function GET(request: Request): Response {
  const origin = new URL(request.url).origin
  return Response.json(authorizationServerMetadata(origin), {
    headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
  })
}
