import { getSession } from "./session"

/** A 401 when nobody is signed in. Null means the request may continue. */
export async function denyUnlessSignedIn(): Promise<Response | null> {
  const session = await getSession()
  if (session) return null
  return new Response("Sign in required.", {
    status: 401,
    headers: { "Cache-Control": "private, no-store" },
  })
}
