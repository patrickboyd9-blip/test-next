import { readApprovedSchedule } from "@/lib/mail-journey/pricing"
import type { SqlExecutor } from "@/lib/storage/document-store"

import { appendAudit, approvedBy, readAudit, type AuditAction } from "./audit"
import { requireRate } from "./rate-limit"
import {
  checkoutForm,
  fullPriceCents,
  openStripeCheckout,
  readStripeNotice,
  stripeSecretDecision,
  verifyStripeSignature,
  type StripeNotice,
} from "./stripe"

/**
 * The one module for create, proof, price, approve, send, and charge.
 * Callers record the before and after here. This module does not print.
 * A checkout can open only after approval, and only for the full price.
 * charged stays false until a verified Stripe webhook says the payment succeeded.
 */

export async function beginMailAction(actorId: string, action: AuditAction | "ai", executor?: SqlExecutor): Promise<void> {
  await requireRate(`${action}:${actorId}`, executor)
}

export async function finishMailAction(
  input: {
    actorId: string
    action: AuditAction
    subjectId: string
    before: unknown
    after: unknown
  },
  executor?: SqlExecutor
): Promise<void> {
  await appendAudit(input, new Date(), executor)
}

export async function priceMailer(actorId: string, subjectId: string, env: NodeJS.ProcessEnv = process.env) {
  await beginMailAction(actorId, "price")
  const schedule = readApprovedSchedule(env)
  const after = schedule
    ? { configured: true, total: "full" as const }
    : { configured: false, total: "placeholder" as const, postageOnly: false }
  await finishMailAction({ actorId, action: "price", subjectId, before: null, after })
  return after
}

export async function chargeMailer(actorId: string, subjectId: string, executor?: SqlExecutor): Promise<{ charged: false }> {
  await beginMailAction(actorId, "charge", executor)
  const allowed = await approvedBy(actorId, subjectId, executor)
  await finishMailAction(
    {
      actorId,
      action: "charge",
      subjectId,
      before: { approved: allowed },
      after: { charged: false, refused: !allowed, postageOnly: false },
    },
    executor
  )
  if (!allowed) throw new Error("Nothing is charged without approval.")
  return { charged: false }
}

/**
 * Opens a Stripe test checkout after the approval gate. Does not mark the order paid.
 * Card and US bank account. The amount is the full price, never postage alone.
 */
export async function startApprovedCheckout(
  input: {
    actorId: string
    subjectId: string
    jobId: string
    pieceCount: number
    amountCents: number
    origin: string
    env?: NodeJS.ProcessEnv
    fetchImpl?: typeof fetch
    now?: string
    executor?: SqlExecutor
  }
): Promise<{ charged: false; url: string }> {
  const env = input.env ?? process.env
  const now = input.now ?? new Date().toISOString()
  await beginMailAction(input.actorId, "charge", input.executor)
  const allowed = await approvedBy(input.actorId, input.subjectId, input.executor)
  if (!allowed) {
    await finishMailAction(
      {
        actorId: input.actorId,
        action: "charge",
        subjectId: input.subjectId,
        before: { approved: false },
        after: { charged: false, refused: true, postageOnly: false },
      },
      input.executor
    )
    throw new Error("Nothing is charged without approval.")
  }
  const price = fullPriceCents(input.pieceCount, env, now)
  if (!price.ok || price.amountCents !== input.amountCents) {
    await finishMailAction(
      {
        actorId: input.actorId,
        action: "charge",
        subjectId: input.subjectId,
        before: { approved: true },
        after: { charged: false, postageOnly: false, total: "full", reason: price.ok ? "amount" : "unconfigured" },
      },
      input.executor
    )
    throw new Error(price.ok ? "The amount is not the full price. Nothing was charged." : price.message)
  }
  const key = stripeSecretDecision(env)
  if (!key.ok) {
    await finishMailAction(
      {
        actorId: input.actorId,
        action: "charge",
        subjectId: input.subjectId,
        before: { approved: true },
        after: { charged: false, postageOnly: false, total: "full" },
      },
      input.executor
    )
    throw new Error(key.message)
  }
  const session = await openStripeCheckout(
    key.secret,
    checkoutForm({ ...input, amountCents: price.amountCents }),
    input.fetchImpl
  )
  await finishMailAction(
    {
      actorId: input.actorId,
      action: "charge",
      subjectId: input.subjectId,
      before: { approved: true },
      after: { charged: false, postageOnly: false, total: "full", amountCents: price.amountCents, sessionId: session.id },
    },
    input.executor
  )
  return { charged: false, url: session.url }
}

/** A verified webhook is the only path that sets charged to true. It does not mail. */
export async function applyStripeWebhook(
  payload: string,
  header: string | null,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
  executor?: SqlExecutor
): Promise<{ charged: boolean; mailed: false; status: number; message: string }> {
  const verified = verifyStripeSignature(payload, header, env.STRIPE_WEBHOOK_SECRET, now)
  if (!verified.ok) return { charged: false, mailed: false, status: 400, message: verified.message }
  const notice = readStripeNotice(payload)
  if (notice.kind === "invalid") return { charged: false, mailed: false, status: 400, message: "The payment notice could not be read. Nothing was marked paid." }
  if (notice.kind === "ignore") return { charged: false, mailed: false, status: 200, message: "Ignored. Nothing was marked paid." }
  const prior = await readAudit(executor)
  if (prior.some((event) => event.action === "charge" && (event.after as { eventId?: string } | null)?.eventId === notice.eventId)) {
    return { charged: false, mailed: false, status: 200, message: "Already recorded. Nothing new was marked paid." }
  }
  const allowed = await approvedBy(notice.actorId, notice.subjectId, executor)
  const price = fullPriceCents(notice.pieceCount, env, new Date(now).toISOString())
  const full = price.ok && price.amountCents === notice.amountCents
  const paid = notice.kind === "paid" && allowed && full
  await appendAudit(
    {
      actorId: notice.actorId,
      action: "charge",
      subjectId: notice.subjectId,
      before: { approved: allowed },
      after: {
        charged: paid,
        postageOnly: false,
        total: "full",
        amountCents: notice.amountCents,
        eventId: notice.eventId,
        jobId: notice.jobId,
        outcome: notice.kind,
      },
    },
    new Date(now),
    executor
  )
  if (!paid) {
    return {
      charged: false,
      mailed: false,
      status: 200,
      message: notice.kind === "paid" ? "Payment was not applied. Nothing was marked paid." : "Recorded. Nothing was marked paid.",
    }
  }
  return { charged: true, mailed: false, status: 200, message: "Payment confirmed. Nothing was mailed." }
}

export type { StripeNotice }
