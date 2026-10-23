import type { StripeCredentials } from "./stripe-config"

const STRIPE_API = "https://api.stripe.com/v1"

export interface CreateCheckoutInput {
  credentials: StripeCredentials
  paymentId: string
  campaignId: string
  orderId: string
  amountCents: number
  pieceCount: number
  successUrl: string
  cancelUrl: string
  productName: string
}

export interface StripeGateway {
  createCheckoutSession(input: CreateCheckoutInput): Promise<{ id: string; url: string }>
  refundPayment(input: { credentials: StripeCredentials; paymentIntentId: string }): Promise<{ id: string }>
}

export function createStripeGateway(fetchImpl: typeof fetch = fetch): StripeGateway {
  return {
    async createCheckoutSession(input) {
      const body = new URLSearchParams({
        mode: "payment",
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.paymentId,
        "metadata[campaignId]": input.campaignId,
        "metadata[paymentId]": input.paymentId,
        "metadata[orderId]": input.orderId,
        "payment_intent_data[metadata][campaignId]": input.campaignId,
        "payment_intent_data[metadata][paymentId]": input.paymentId,
        "payment_intent_data[metadata][orderId]": input.orderId,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(input.amountCents),
        "line_items[0][price_data][product_data][name]": input.productName,
        "line_items[0][price_data][product_data][description]": `${input.pieceCount} ${input.pieceCount === 1 ? "card" : "cards"}`,
      })
      const session = await stripePost<{ id?: string; url?: string }>(
        fetchImpl,
        input.credentials.secretKey,
        "/checkout/sessions",
        body,
        input.paymentId
      )
      if (!session.id || !session.url) {
        throw new Error("Stripe did not return a checkout page.")
      }
      return { id: session.id, url: session.url }
    },
    async refundPayment(input) {
      const body = new URLSearchParams({ payment_intent: input.paymentIntentId })
      const refund = await stripePost<{ id?: string }>(
        fetchImpl,
        input.credentials.secretKey,
        "/refunds",
        body,
        `refund-${input.paymentIntentId}`
      )
      if (!refund.id) throw new Error("Stripe did not confirm the refund.")
      return { id: refund.id }
    },
  }
}

async function stripePost<T>(
  fetchImpl: typeof fetch,
  secretKey: string,
  path: string,
  body: URLSearchParams,
  idempotencyKey: string
): Promise<T> {
  const response = await fetchImpl(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey,
    },
    body,
  })
  const payload = (await response.json()) as T & { error?: { message?: string } }
  if (!response.ok) {
    throw new Error(payload.error?.message || "Stripe could not complete that request.")
  }
  return payload
}
