import { getSession } from "@/lib/auth/session"
import { escapeHtml } from "@/lib/mcp/http"
import { issueAuthorizationCode } from "@/lib/mcp/oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const session = await getSession()
  return new Response(page(url, session?.name ?? "", Boolean(session)), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  })
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession()
  const form = await request.formData()
  const redirectUri = String(form.get("redirect_uri") ?? "")
  const state = cleanState(String(form.get("state") ?? ""))
  if (!session) return new Response("Sign in to Modern Mail, then connect again.", { status: 401 })
  if (String(form.get("decision") ?? "") !== "allow") return deny(redirectUri, state)
  const issued = await issueAuthorizationCode({
    userId: session.userId,
    clientId: String(form.get("client_id") ?? ""),
    redirectUri,
    challenge: String(form.get("code_challenge") ?? ""),
    method: String(form.get("code_challenge_method") ?? ""),
  })
  if ("error" in issued) return new Response(issued.error, { status: 400 })
  return allow(redirectUri, issued.code, state)
}

function allow(redirectUri: string, code: string, state: string): Response {
  let url: URL
  try {
    url = new URL(redirectUri)
  } catch {
    return new Response("That return address is not valid.", { status: 400 })
  }
  url.searchParams.set("code", code)
  if (state) url.searchParams.set("state", state)
  return Response.redirect(url, 302)
}

function deny(redirectUri: string, state: string): Response {
  let url: URL
  try {
    url = new URL(redirectUri)
  } catch {
    return new Response("Connection cancelled.", { status: 400 })
  }
  url.searchParams.set("error", "access_denied")
  if (state) url.searchParams.set("state", state)
  return Response.redirect(url, 302)
}

function cleanState(value: string): string {
  if (value.length > 512 || /[\r\n]/.test(value)) return ""
  return value
}

function page(url: URL, name: string, signedIn: boolean): string {
  const fields = ["client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope"]
    .map((key) => {
      const value = url.searchParams.get(key) ?? ""
      return `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`
    })
    .join("")
  const body = signedIn
    ? `<p>Signed in as ${escapeHtml(name || "your account")}.</p>
       <p>This assistant can prepare mailers, show the proof, and show the full price. It cannot approve, print, or charge. You still do that in Modern Mail.</p>
       <form method="post">
         ${fields}
         <button name="decision" value="allow" type="submit">Allow</button>
         <button name="decision" value="deny" type="submit">Cancel</button>
       </form>`
    : `<p>Sign in to Modern Mail in another tab, then reload this page. Use the same email and password, or Google, that you already use.</p>
       <p><a href="/sign-in" target="_blank" rel="noopener">Sign in</a></p>`
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Connect Modern Mail</title>
  <style>
    body { margin: 0; font-family: Georgia, serif; background: #f7f4ee; color: #1c1915; }
    main { max-width: 32rem; margin: 4rem auto; padding: 2rem; background: white; border-radius: 16px; }
    button, a { font: inherit; }
    button { min-height: 44px; margin-right: 8px; padding: 0 16px; border-radius: 10px; border: 0; background: #1c1915; color: white; }
    p { line-height: 1.5; }
  </style>
</head>
<body><main><h1>Connect an assistant</h1>${body}</main></body>
</html>`
}
