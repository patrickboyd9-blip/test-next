import { exchangeAuthorizationCode, exchangeRefreshToken } from "@/lib/mcp/oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  const fields = await readFields(request)
  const grant = fields.get("grant_type") ?? ""
  if (grant === "authorization_code") {
    const exchanged = await exchangeAuthorizationCode({
      code: fields.get("code") ?? "",
      clientId: fields.get("client_id") ?? "",
      redirectUri: fields.get("redirect_uri") ?? "",
      verifier: fields.get("code_verifier") ?? "",
    })
    if ("error" in exchanged) return Response.json({ error: "invalid_grant", error_description: exchanged.error }, { status: 400 })
    return Response.json(exchanged, { headers: { "Cache-Control": "no-store" } })
  }
  if (grant === "refresh_token") {
    const exchanged = await exchangeRefreshToken(fields.get("refresh_token") ?? "")
    if ("error" in exchanged) return Response.json({ error: "invalid_grant", error_description: exchanged.error }, { status: 400 })
    return Response.json(exchanged, { headers: { "Cache-Control": "no-store" } })
  }
  return Response.json({ error: "unsupported_grant_type" }, { status: 400 })
}

async function readFields(request: Request): Promise<URLSearchParams> {
  const type = request.headers.get("content-type") ?? ""
  if (type.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>
    const fields = new URLSearchParams()
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") fields.set(key, value)
    }
    return fields
  }
  return new URLSearchParams(await request.text())
}
