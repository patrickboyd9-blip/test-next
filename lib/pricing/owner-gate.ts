import { createHmac, timingSafeEqual } from "crypto"

export const PRICING_OWNER_COOKIE = "mm_pricing_owner"
const SESSION_MESSAGE = "modern-mail-pricing-owner"

/**
 * The pricing page is for the owner only.
 * Set PRICING_OWNER_KEY on the server (a password the owner chooses).
 * The cookie stores a signature of that key, not the key itself.
 */
export function pricingOwnerKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = env.PRICING_OWNER_KEY?.trim()
  return key ? key : null
}

export function ownerSessionToken(key: string): string {
  return createHmac("sha256", key).update(SESSION_MESSAGE).digest("hex")
}

export function ownerKeyMatches(input: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const key = pricingOwnerKey(env)
  if (!key) return false
  const given = Buffer.from(ownerSessionToken(input))
  const expected = Buffer.from(ownerSessionToken(key))
  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}

export function ownerCookieMatches(cookieValue: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  const key = pricingOwnerKey(env)
  if (!key || !cookieValue) return false
  const given = Buffer.from(cookieValue)
  const expected = Buffer.from(ownerSessionToken(key))
  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}
