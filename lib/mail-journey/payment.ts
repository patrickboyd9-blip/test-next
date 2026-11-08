import { createHmac, timingSafeEqual } from "node:crypto"

import type { MailJob } from "./job"

export type PaymentOutcome = "succeeded" | "failed" | "pending" | "unknown"

export interface PaymentNotice {
  eventId: string
  orderId: string
  outcome: PaymentOutcome
  currency: string
  amountCents: number
}

export function paymentCanonical(notice: PaymentNotice): string {
  return [notice.eventId, notice.orderId, notice.outcome, notice.currency, String(notice.amountCents)].join(".")
}

export function signPaymentNotice(notice: PaymentNotice, secret: string): string {
  return createHmac("sha256", secret).update(paymentCanonical(notice)).digest("hex")
}

export function verifyPaymentNotice(
  notice: PaymentNotice,
  signature: string,
  secret: string | undefined
): { ok: true } | { ok: false; message: string } {
  if (!secret) return { ok: false, message: "Payment webhooks are not configured. Nothing was marked paid." }
  const expected = signPaymentNotice(notice, secret)
  const given = Buffer.from(signature)
  const check = Buffer.from(expected)
  if (given.length !== check.length || !timingSafeEqual(given, check)) {
    return { ok: false, message: "The payment notice could not be verified. Nothing was marked paid." }
  }
  return { ok: true }
}

export interface StagingPaymentAdapter {
  calls: string[]
  charge(): never
}

/** Records that a test asked for a charge and refuses to make one. */
export function createStagingPaymentAdapter(): StagingPaymentAdapter {
  const calls: string[] = []
  return {
    calls,
    charge(): never {
      calls.push("charge")
      throw new Error("Staging adapter does not contact a payment provider.")
    },
  }
}

/**
 * Applies one verified notice. Does not mail and does not start another charge.
 * A client return URL must not call this.
 */
export function applyVerifiedPayment(job: MailJob, notice: PaymentNotice, nowIso: string): MailJob {
  if (notice.orderId !== job.id) {
    return hold(job, "The payment notice names a different order.", nowIso, notice.eventId)
  }
  if (job.appliedEventIds.includes(notice.eventId)) return job
  if (notice.currency !== job.currency || notice.amountCents !== job.amountCents) {
    return hold(job, "The payment amount or currency does not match this order.", nowIso, notice.eventId)
  }
  if (notice.outcome === "unknown" || notice.outcome === "pending") {
    if (job.state === "paid" || job.state === "held") {
      return { ...job, appliedEventIds: [...job.appliedEventIds, notice.eventId], updatedAt: nowIso }
    }
    return {
      ...job,
      state: "payment_unknown",
      appliedEventIds: [...job.appliedEventIds, notice.eventId],
      heldReason: "The payment provider has not confirmed this charge. It is held for reconciliation and was not submitted again.",
      updatedAt: nowIso,
    }
  }
  if (notice.outcome === "failed") {
    if (job.state === "paid") {
      return hold(job, "A later failure arrived after payment. It is held for reconciliation and was not mailed.", nowIso, notice.eventId)
    }
    return {
      ...job,
      state: "awaiting_payment",
      appliedEventIds: [...job.appliedEventIds, notice.eventId],
      updatedAt: nowIso,
    }
  }
  if (job.state === "held") {
    return { ...job, appliedEventIds: [...job.appliedEventIds, notice.eventId], updatedAt: nowIso }
  }
  return {
    ...job,
    state: "paid",
    appliedEventIds: [...job.appliedEventIds, notice.eventId],
    heldReason: undefined,
    updatedAt: nowIso,
  }
}

function hold(job: MailJob, reason: string, nowIso: string, eventId: string): MailJob {
  return {
    ...job,
    state: "held",
    heldReason: reason,
    appliedEventIds: job.appliedEventIds.includes(eventId) ? job.appliedEventIds : [...job.appliedEventIds, eventId],
    updatedAt: nowIso,
  }
}

/** A browser return never changes the order and never mails. */
export function clientReturnLeavesOrder(job: MailJob): MailJob {
  return job
}
