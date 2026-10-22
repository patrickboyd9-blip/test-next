import type { PaymentRecord } from "@/lib/payments/types"
import type { PaymentStore } from "@/lib/payments/store"

import type { StripeEvent } from "./stripe-config"

export interface PaidFulfillment {
  submit: (payment: PaymentRecord) => Promise<{ ok: true } | { ok: false; message: string }>
}

/**
 * Stripe is the only thing that may submit a paid mailing.
 * A completed checkout marks the payment paid, then submits the Click2Mail job.
 * Failed, expired, and cancelled events never submit. Repeated events do not
 * submit twice.
 */
export async function applyStripeEvent(input: {
  event: StripeEvent
  payments: PaymentStore
  now: () => string
  fulfillment: PaidFulfillment
}): Promise<{ handled: boolean; submitted: boolean }> {
  const object = input.event.data.object
  const paymentId = metadataPaymentId(object)
  if (!paymentId) return { handled: false, submitted: false }
  const payment = await input.payments.get(paymentId)
  if (!payment) return { handled: false, submitted: false }
  const now = input.now()

  if (input.event.type === "checkout.session.completed") {
    return completeCheckout(payment, object, input.payments, now, input.fulfillment)
  }
  if (input.event.type === "checkout.session.expired") {
    return markClosed(payment, input.payments, now, "cancelled", "The checkout page expired before payment.")
  }
  if (
    input.event.type === "checkout.session.async_payment_failed" ||
    input.event.type === "payment_intent.payment_failed"
  ) {
    const message =
      typeof object.last_payment_error === "object" &&
      object.last_payment_error &&
      "message" in object.last_payment_error &&
      typeof (object.last_payment_error as { message?: unknown }).message === "string"
        ? (object.last_payment_error as { message: string }).message
        : "The card payment did not go through."
    return markClosed(payment, input.payments, now, "failed", message)
  }
  return { handled: false, submitted: false }
}

async function completeCheckout(
  payment: PaymentRecord,
  object: Record<string, unknown>,
  payments: PaymentStore,
  now: string,
  fulfillment: PaidFulfillment
): Promise<{ handled: boolean; submitted: boolean }> {
  if (payment.fulfillment === "submitted") {
    return { handled: true, submitted: true }
  }
  if (payment.status === "refunded" || payment.status === "cancelled" || payment.status === "failed") {
    return { handled: true, submitted: false }
  }
  const paid = object.payment_status === "paid" || object.status === "succeeded"
  if (!paid) {
    payment.status = "pending"
    payment.updatedAt = now
    payment.failureMessage = "The checkout session is not paid yet."
    await payments.put(payment)
    return { handled: true, submitted: false }
  }
  const amount = typeof object.amount_total === "number" ? object.amount_total : payment.amountCents
  const intent = paymentIntentId(object)
  if (amount !== payment.amountCents) {
    payment.status = "failed"
    payment.updatedAt = now
    payment.stripePaymentIntentId = intent ?? payment.stripePaymentIntentId
    payment.failureMessage = "The paid amount did not match the order, so the mailing was not sent."
    await payments.put(payment)
    return { handled: true, submitted: false }
  }
  payment.status = "paid"
  payment.paidAt = payment.paidAt ?? now
  payment.updatedAt = now
  payment.fulfillment = "started"
  payment.failureMessage = undefined
  if (intent) payment.stripePaymentIntentId = intent
  if (typeof object.id === "string" && object.id.startsWith("cs_")) {
    payment.stripeCheckoutSessionId = object.id
  }
  await payments.put(payment)

  const result = await fulfillment.submit(payment)
  const latest = (await payments.get(payment.id)) ?? payment
  if (result.ok) {
    latest.fulfillment = "submitted"
    latest.failureMessage = undefined
  } else {
    latest.fulfillment = "error"
    latest.failureMessage = result.message
  }
  latest.updatedAt = now
  await payments.put(latest)
  return { handled: true, submitted: result.ok }
}

async function markClosed(
  payment: PaymentRecord,
  payments: PaymentStore,
  now: string,
  status: "cancelled" | "failed",
  message: string
): Promise<{ handled: boolean; submitted: boolean }> {
  if (payment.status === "paid" || payment.status === "refunded" || payment.fulfillment === "submitted") {
    return { handled: true, submitted: payment.fulfillment === "submitted" }
  }
  payment.status = status
  payment.updatedAt = now
  payment.failureMessage = message
  if (status === "cancelled") payment.cancelledAt = now
  await payments.put(payment)
  return { handled: true, submitted: false }
}

function metadataPaymentId(object: Record<string, unknown>): string | null {
  const metadata = object.metadata
  if (!metadata || typeof metadata !== "object") return null
  const id = (metadata as { paymentId?: unknown }).paymentId
  return typeof id === "string" && id ? id : null
}

function paymentIntentId(object: Record<string, unknown>): string | undefined {
  const intent = object.payment_intent
  if (typeof intent === "string") return intent
  if (intent && typeof intent === "object" && typeof (intent as { id?: unknown }).id === "string") {
    return (intent as { id: string }).id
  }
  return undefined
}
