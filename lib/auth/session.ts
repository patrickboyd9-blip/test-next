import { AsyncLocalStorage } from "node:async_hooks"
import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * The signed-in account. This is not a login provider.
 * A provider may create a token with signSessionToken after it has verified
 * the person. Until that provider is configured, getSession fails closed.
 */
export interface AccountSession {
  userId: string
  email: string
  name: string
  businessName: string
  /** Local fixture only. Never set on a signed token, and never in production. */
  fixture: boolean
}

const storage = new AsyncLocalStorage<AccountSession | null>()
const COOKIE = "mm_session"
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

/** Runs fn with a session, including an explicit signed-out null. */
export function runAs<T>(session: AccountSession | null, fn: () => T): T {
  return storage.run(session, fn)
}

/**
 * Preview deployments and an explicit DEMO_MODE flag use a sample account.
 * Production never does, even if DEMO_MODE is set there.
 * Vercel preview runs with NODE_ENV=production, so the check is VERCEL_ENV.
 */
export function previewDemoAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VERCEL_ENV === "production") return false
  if (env.VERCEL_ENV === "preview") return true
  if (env.NODE_ENV === "production") return false
  const flag = env.DEMO_MODE?.trim().toLowerCase()
  return flag === "1" || flag === "true"
}

export function previewDemoSession(): AccountSession {
  return {
    userId: "preview-demo@example.com",
    email: "preview-demo@example.com",
    name: "Preview demo",
    businessName: "Jordan's Plumbing",
    fixture: true,
  }
}

export async function getSession(): Promise<AccountSession | null> {
  const scoped = storage.getStore()
  if (scoped !== undefined) return scoped
  if (previewDemoAllowed()) return previewDemoSession()
  if (process.env.NODE_ENV !== "production" && process.env.AUTH_MODE === "dev-fixture") return devFixture()
  const signedIn = await readProviderSession()
  if (signedIn) return signedIn
  return readCookieSession()
}

async function readProviderSession(): Promise<AccountSession | null> {
  if (!process.env.AUTH_SECRET) return null
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    const user = session?.user
    if (!user?.id || !user.email) return null
    return {
      userId: user.id,
      email: user.email,
      name: user.name ?? "",
      businessName: user.businessName ?? "",
      fixture: false,
    }
  } catch {
    return null
  }
}

export function signSessionToken(session: AccountSession, secret: string, now = Date.now()): string {
  const body = Buffer.from(
    JSON.stringify({
      userId: session.userId,
      email: session.email,
      name: session.name,
      businessName: session.businessName,
      exp: now + FOURTEEN_DAYS_MS,
    })
  ).toString("base64url")
  const sig = createHmac("sha256", secret).update(body).digest("base64url")
  return `${body}.${sig}`
}

export function verifySessionToken(token: string, secret: string, now = Date.now()): AccountSession | null {
  if (!secret) return null
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [body, sig] = parts
  if (!body || !sig) return null
  const expected = createHmac("sha256", secret).update(body).digest("base64url")
  const given = Buffer.from(sig)
  const check = Buffer.from(expected)
  if (given.length !== check.length || !timingSafeEqual(given, check)) return null
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      userId?: unknown
      email?: unknown
      name?: unknown
      businessName?: unknown
      exp?: unknown
    }
    if (typeof parsed.userId !== "string" || !parsed.userId.trim()) return null
    if (typeof parsed.exp !== "number" || parsed.exp < now) return null
    return {
      userId: parsed.userId,
      email: typeof parsed.email === "string" ? parsed.email : "",
      name: typeof parsed.name === "string" ? parsed.name : "",
      businessName: typeof parsed.businessName === "string" ? parsed.businessName : "",
      fixture: false,
    }
  } catch {
    return null
  }
}

export function sessionInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
  return letters.join("") || "?"
}

function devFixture(): AccountSession {
  return {
    userId: process.env.AUTH_DEV_USER_ID?.trim() || "jordan@jordansplumbing.com",
    email: process.env.AUTH_DEV_USER_ID?.trim() || "jordan@jordansplumbing.com",
    name: "Jordan Alvarez",
    businessName: "Jordan's Plumbing",
    fixture: true,
  }
}

async function readCookieSession(): Promise<AccountSession | null> {
  const secret = process.env.AUTH_SECRET
  if (!secret) return null
  try {
    const { cookies } = await import("next/headers")
    const jar = await cookies()
    const token = jar.get(COOKIE)?.value
    if (!token) return null
    return verifySessionToken(token, secret)
  } catch {
    return null
  }
}
