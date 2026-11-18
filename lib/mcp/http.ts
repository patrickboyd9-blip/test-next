import { resolveAssistantToken } from "./tokens"

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Protocol-Version",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Cache-Control": "no-store",
  }
}

export async function principalFromAuthorization(
  header: string | null
): Promise<{ userId: string; tokenId: string } | null> {
  const match = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? "")
  if (!match?.[1]) return null
  return resolveAssistantToken(match[1])
}

export function unauthorizedResponse(origin: string): Response {
  return new Response(
    JSON.stringify({
      error: "Connect Modern Mail with a token from Settings, or sign in when your assistant asks.",
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer realm="modern-mail", resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
        ...corsHeaders(),
      },
    }
  )
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;"
    if (char === "<") return "&lt;"
    if (char === ">") return "&gt;"
    if (char === '"') return "&quot;"
    return "&#39;"
  })
}
