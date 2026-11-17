import { createHmac, timingSafeEqual } from "node:crypto"

import { buildQuote, readApprovedSchedule } from "@/lib/mail-journey/pricing"

/** Hosted Checkout. Card and US bank (ACH). The browser return does not mark anything paid. */
export const STRIPE_WEBHOOK_PATH = "/api/stripe/webhook"

export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.processing",
] as const

const TOLERANCE_MS = 5 * 60 * 1000

export interface StripeChargeRequest {
  actorId: string
  subjectId: string
  jobId: string
  pieceCount: number
  amountCents: number
  origin: string
}

export function stripeSecretDecision(
  env: NodeJS.ProcessEnv
): { ok: true; secret: string } | { ok: false; message: string } {
  const secret = env.STRIPE_SECRET_KEY?.trim() ?? ""
  const liveEnabled = env.STRIPE_LIVE_ENABLED?.trim() === "true"
  if (!secret) return { ok: false, message: "STRIPE_SECRET_KEY is not set. Nothing was charged." }
  if (secret.startsWith("sk_live_")) {
    if (!liveEnabled) {
      return {
        ok: false,
        message: "A live Stripe key is set. Nothing was charged. STRIPE_LIVE_ENABLED is required before a live key can run.",
      }
    }
    return publishable(env, liveEnabled, secret)
  }
  if (!secret.startsWith("sk_test_")) {
    return { ok: false, message: "STRIPE_SECRET_KEY must be a test key. Nothing was charged." }
  }
  return publishable(env, liveEnabled, secret)
}

function publishable(
  env: NodeJS.ProcessEnv,
  liveEnabled: boolean,
  secret: string
): { ok: true; secret: string } | { ok: false; message: string } {
  const pub = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? ""
  if (!pub) return { ok: true, secret }
  if (pub.startsWith("pk_live_") && !liveEnabled) {
    return { ok: false, message: "A live publishable key is set. Nothing was charged." }
  }
  if (!pub.startsWith("pk_test_") && !pub.startsWith("pk_live_")) {
    return { ok: false, message: "The publishable key is not a Stripe test key. Nothing was charged." }
  }
  return { ok: true, secret }
}

/** Full price for the piece count. Postage by itself is refused. */
export function fullPriceCents(
  pieceCount: number,
  env: NodeJS.ProcessEnv,
  nowIso: string
): { ok: true; amountCents: number } | { ok: false; message: string } {
  const quote = buildQuote(readApprovedSchedule(env), pieceCount, nowIso)
  if (!quote.ok) return { ok: false, message: quote.message }
  return { ok: true, amountCents: quote.quote.totalCents }
}

export function checkoutForm(input: StripeChargeRequest & { amountCents: number }): string {
  const fields: Record<string, string> = {
    mode: "payment",
    success_url: `${input.origin}/app/campaigns/${input.subjectId}/order?checkout=return`,
    cancel_url: `${input.origin}/app/campaigns/${input.subjectId}/order?checkout=cancel`,
    client_reference_id: input.subjectId,
    "metadata[subject_id]": input.subjectId,
    "metadata[actor_id]": input.actorId,
    "metadata[job_id]": input.jobId,
    "metadata[piece_count]": String(input.pieceCount),
    "metadata[amount_cents]": String(input.amountCents),
    "metadata[postage_only]": "false",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(input.amountCents),
    "line_items[0][price_data][product_data][name]": "Full price",
    "line_items[0][price_data][product_data][description]": "Printing, postage, and the list. Not postage by itself.",
    "payment_method_types[0]": "card",
    "payment_method_types[1]": "us_bank_account",
    "payment_intent_data[metadata][subject_id]": input.subjectId,
    "payment_intent_data[metadata][actor_id]": input.actorId,
    "payment_intent_data[metadata][job_id]": input.jobId,
    "payment_intent_data[metadata][piece_count]": String(input.pieceCount),
    "payment_intent_data[metadata][amount_cents]": String(input.amountCents),
    "payment_intent_data[metadata][postage_only]": "false",
  }
  return new URLSearchParams(fields).toString()
}

export async function openStripeCheckout(
  secret: string,
  form: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ id: string; url: string }> {
  const res = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    },
    body: form,
  })
  if (!res.ok) throw new Error("Stripe did not open checkout. Nothing was charged.")
  const body = (await res.json()) as { id?: string; url?: string }
  if (!body.id || !body.url) throw new Error("Stripe did not return a checkout. Nothing was charged.")
  return { id: body.id, url: body.url }
}

export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string | undefined,
  now = Date.now()
): { ok: true } | { ok: false; message: string } {
  if (!secret?.trim()) return { ok: false, message: "STRIPE_WEBHOOK_SECRET is not set. Nothing was marked paid." }
  if (!header) return { ok: false, message: "The Stripe signature is missing. Nothing was marked paid." }
  const parts = header.split(",").map((part) => part.trim())
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2)
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3))
  if (!timestamp || signatures.length === 0) {
    return { ok: false, message: "The Stripe signature could not be read. Nothing was marked paid." }
  }
  const sent = Number(timestamp)
  if (!Number.isFinite(sent) || Math.abs(now - sent * 1000) > TOLERANCE_MS) {
    return { ok: false, message: "The Stripe signature is too old. Nothing was marked paid." }
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")
  const match = signatures.some((signature) => {
    const given = Buffer.from(signature)
    const check = Buffer.from(expected)
    return given.length === check.length && timingSafeEqual(given, check)
  })
  if (!match) return { ok: false, message: "The Stripe signature did not match. Nothing was marked paid." }
  return { ok: true }
}

export type StripeNotice =
  | { kind: "ignore" }
  | {
      kind: "pending" | "failed" | "paid"
      eventId: string
      actorId: string
      subjectId: string
      jobId: string
      pieceCount: number
      amountCents: number
    }

interface StripeObject {
  id?: string
  object?: string
  amount?: number
  amount_total?: number
  currency?: string
  payment_status?: string
  status?: string
  metadata?: Record<string, string>
}

export function readStripeNotice(payload: string): StripeNotice | { kind: "invalid" } {
  let event: { id?: string; type?: string; data?: { object?: StripeObject } }
  try {
    event = JSON.parse(payload) as typeof event
  } catch {
    return { kind: "invalid" }
  }
  if (!event.id || !event.type) return { kind: "invalid" }
  if (!STRIPE_WEBHOOK_EVENTS.includes(event.type as (typeof STRIPE_WEBHOOK_EVENTS)[number])) return { kind: "ignore" }
  const object = event.data?.object
  if (!object) return { kind: "invalid" }
  const meta = object.metadata ?? {}
  if (meta.postage_only === "true") return { kind: "invalid" }
  const amount = object.amount_total ?? object.amount
  const notice = {
    eventId: event.id,
    actorId: meta.actor_id ?? "",
    subjectId: meta.subject_id ?? "",
    jobId: meta.job_id ?? "",
    pieceCount: Number(meta.piece_count),
    amountCents: Number(meta.amount_cents),
  }
  if (!notice.actorId || !notice.subjectId || !notice.jobId) return { kind: "invalid" }
  if (!Number.isInteger(notice.pieceCount) || notice.pieceCount <= 0) return { kind: "invalid" }
  if (!Number.isInteger(notice.amountCents) || notice.amountCents <= 0) return { kind: "invalid" }
  if (amount !== notice.amountCents || object.currency !== "usd") return { kind: "invalid" }
  if (event.type === "payment_intent.processing" || (event.type === "checkout.session.completed" && object.payment_status !== "paid")) {
    return { kind: "pending", ...notice }
  }
  if (event.type === "checkout.session.async_payment_failed" || event.type === "payment_intent.payment_failed") {
    return { kind: "failed", ...notice }
  }
  if (
    event.type === "checkout.session.async_payment_succeeded" ||
    event.type === "payment_intent.succeeded" ||
    (event.type === "checkout.session.completed" && object.payment_status === "paid")
  ) {
    return { kind: "paid", ...notice }
  }
  return { kind: "ignore" }
}
