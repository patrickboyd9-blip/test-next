import { registerOAuthClient } from "@/lib/mcp/oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  let body: { client_name?: string; redirect_uris?: string[] } = {}
  try {
    body = (await request.json()) as { client_name?: string; redirect_uris?: string[] }
  } catch {
    return Response.json({ error: "The connection could not be read." }, { status: 400 })
  }
  const registered = await registerOAuthClient(body)
  if ("error" in registered) return Response.json({ error: registered.error }, { status: 400 })
  return Response.json(registered, { status: 201, headers: { "Cache-Control": "no-store" } })
}
