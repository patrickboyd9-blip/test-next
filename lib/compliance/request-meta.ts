import { randomUUID } from "crypto"
import { cookies, headers } from "next/headers"

export interface RequestMeta {
  ip: string
  userAgent: string
  sessionId: string
}

const SESSION_COOKIE = "mm_session"

/** Server-observed client facts for an acceptance row. */
export async function readRequestMeta(): Promise<RequestMeta> {
  const headerList = await headers()
  const cookieStore = await cookies()
  const forwarded = headerList.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip")?.trim() || "local"
  const userAgent = (headerList.get("user-agent") || "unknown").slice(0, 512)
  let sessionId = cookieStore.get(SESSION_COOKIE)?.value
  if (!sessionId) {
    sessionId = randomUUID()
    cookieStore.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    })
  }
  return { ip, userAgent, sessionId }
}
