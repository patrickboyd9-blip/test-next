import { createHmac, timingSafeEqual } from "crypto"

const TOLERANCE_MS = 5 * 60 * 1000

export interface StripeEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

export interface CheckoutAvailability {
  enabled: boolean
  /** Plain sentence when checkout cannot start. Null when it can. */
  message: string | null
}

export interface StripeCredentials {
  secretKey: string
  webhookSecret: string
  publishableKey: string
}

/**
 * Checkout stays off unless all three test-mode keys are present.
 * A live secret key does not turn checkout on.
 */
export function readStripeConfig(
  env: NodeJS.ProcessEnv = process.env
): { enabled: true; credentials: StripeCredentials } | { enabled: false; message: string } {
  const secretKey = env.STRIPE_SECRET_KEY?.trim() ?? ""
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim() ?? ""
  const publishableKey = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? ""
  const missing: string[] = []
  if (!secretKey) missing.push("the Stripe secret key")
  if (!webhookSecret) missing.push("the Stripe webhook secret")
  if (!publishableKey) missing.push("the Stripe publishable key")
  if (missing.length > 0) {
    return {
      enabled: false,
      message: `Card payment is not set up yet. Add ${joinList(missing)}, then this button can take a payment. Nothing is sent until then.`,
    }
  }
  if (!secretKey.startsWith("sk_test_") || !publishableKey.startsWith("pk_test_")) {
    return {
      enabled: false,
      message:
        "Card payment is turned off. This server needs Stripe test keys. A live key will not be charged. Nothing is sent until test checkout is on.",
    }
  }
  return { enabled: true, credentials: { secretKey, webhookSecret, publishableKey } }
}

export function checkoutAvailability(env: NodeJS.ProcessEnv = process.env): CheckoutAvailability {
  const config = readStripeConfig(env)
  if (config.enabled) return { enabled: true, message: null }
  return { enabled: false, message: config.message }
}

export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowMs: number = Date.now()
): StripeEvent | null {
  if (!header || !secret) return null
  const parts = Object.fromEntries(
    header.split(",").map((piece) => {
      const index = piece.indexOf("=")
      return [piece.slice(0, index), piece.slice(index + 1)]
    })
  )
  const timestamp = parts.t
  if (!timestamp || !/^\d+$/.test(timestamp)) return null
  const age = Math.abs(nowMs - Number(timestamp) * 1000)
  if (age > TOLERANCE_MS) return null
  const signed = `${timestamp}.${payload}`
  const expected = createHmac("sha256", secret).update(signed).digest("hex")
  const signatures = header
    .split(",")
    .filter((piece) => piece.startsWith("v1="))
    .map((piece) => piece.slice(3))
  const match = signatures.some((signature) => safeEqual(signature, expected))
  if (!match) return null
  try {
    const parsed = JSON.parse(payload) as Partial<StripeEvent>
    if (!parsed || typeof parsed.id !== "string" || typeof parsed.type !== "string" || !parsed.data?.object) {
      return null
    }
    return { id: parsed.id, type: parsed.type, data: { object: parsed.data.object } }
  } catch {
    return null
  }
}

function safeEqual(given: string, expected: string): boolean {
  const left = Buffer.from(given)
  const right = Buffer.from(expected)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0] ?? ""
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}
