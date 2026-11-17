import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"

import { MemorySql } from "@/lib/storage/memory-sql"

import { appendAudit } from "./audit"
import { applyStripeWebhook, startApprovedCheckout } from "./mail-flow"
import { checkoutForm, stripeSecretDecision, STRIPE_WEBHOOK_EVENTS, STRIPE_WEBHOOK_PATH } from "./stripe"

const SCHEDULE = JSON.stringify({
  id: "sched-1",
  status: "approved",
  currency: "usd",
  perPieceCents: 250,
  termsVersion: "v1",
  effectiveUntil: "2099-01-01T00:00:00.000Z",
})

function env(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...process.env, MAIL_APPROVED_PRICE_JSON: SCHEDULE, ...extra }
}

function liveKey(): string {
  return ["sk", "live", "abcdefghij"].join("_")
}

test("the webhook path and the event list stay explicit", () => {
  assert.equal(STRIPE_WEBHOOK_PATH, "/api/stripe/webhook")
  assert.deepEqual(STRIPE_WEBHOOK_EVENTS, [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "payment_intent.processing",
  ])
})

test("a live secret does not run unless the live flag is set", () => {
  const blocked = stripeSecretDecision(env({ STRIPE_SECRET_KEY: liveKey() }))
  assert.equal(blocked.ok, false)
  const allowed = stripeSecretDecision(env({ STRIPE_SECRET_KEY: liveKey(), STRIPE_LIVE_ENABLED: "true" }))
  assert.equal(allowed.ok, true)
  const testKey = stripeSecretDecision(env({ STRIPE_SECRET_KEY: "sk_test_123" }))
  assert.equal(testKey.ok, true)
})

test("checkout is refused without approval and without a full price", async () => {
  const sql = new MemorySql()
  let called = false
  const fetchImpl: typeof fetch = async () => {
    called = true
    return new Response("{}", { status: 200 })
  }
  await assert.rejects(
    () =>
      startApprovedCheckout({
        actorId: "ada@example.com",
        subjectId: "camp-1",
        jobId: "job-1",
        pieceCount: 2,
        amountCents: 500,
        origin: "https://mail.example",
        env: env({ STRIPE_SECRET_KEY: "sk_test_123" }),
        fetchImpl,
        executor: sql,
        now: "2026-11-17T00:00:00.000Z",
      }),
    /without approval/
  )
  assert.equal(called, false)
  await appendAudit(
    { actorId: "ada@example.com", action: "approve", subjectId: "camp-1", before: null, after: { approved: true } },
    new Date("2026-11-17T00:00:00.000Z"),
    sql
  )
  await assert.rejects(
    () =>
      startApprovedCheckout({
        actorId: "ada@example.com",
        subjectId: "camp-1",
        jobId: "job-1",
        pieceCount: 2,
        amountCents: 80,
        origin: "https://mail.example",
        env: env({ STRIPE_SECRET_KEY: "sk_test_123" }),
        fetchImpl,
        executor: sql,
        now: "2026-11-17T00:00:00.000Z",
      }),
    /full price/
  )
  assert.equal(called, false)
})

test("an approved full price opens card and bank checkout and stays uncharged", async () => {
  const sql = new MemorySql()
  await appendAudit(
    { actorId: "ada@example.com", action: "approve", subjectId: "camp-1", before: null, after: { approved: true } },
    new Date("2026-11-17T00:00:00.000Z"),
    sql
  )
  let body = ""
  const fetchImpl: typeof fetch = async (_url, init) => {
    body = String(init?.body ?? "")
    return Response.json({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" })
  }
  const opened = await startApprovedCheckout({
    actorId: "ada@example.com",
    subjectId: "camp-1",
    jobId: "job-1",
    pieceCount: 2,
    amountCents: 500,
    origin: "https://mail.example",
    env: env({ STRIPE_SECRET_KEY: "sk_test_123" }),
    fetchImpl,
    executor: sql,
    now: "2026-11-17T00:00:00.000Z",
  })
  assert.equal(opened.charged, false)
  assert.match(opened.url, /^https:\/\/checkout\.stripe\.com\//)
  const params = new URLSearchParams(body)
  assert.equal(params.get("payment_method_types[0]"), "card")
  assert.equal(params.get("payment_method_types[1]"), "us_bank_account")
  assert.equal(params.get("line_items[0][price_data][unit_amount]"), "500")
  assert.equal(params.get("line_items[0][price_data][product_data][name]"), "Full price")
  assert.equal(params.get("metadata[postage_only]"), "false")
  assert.equal(params.get("allow_fallback_model"), null)
  const form = checkoutForm({
    actorId: "ada@example.com",
    subjectId: "camp-1",
    jobId: "job-1",
    pieceCount: 2,
    amountCents: 500,
    origin: "https://mail.example",
  })
  assert.match(form.replaceAll("+", " "), /Not postage by itself/)
})

function signed(payload: string, secret: string, now: number): string {
  const t = Math.floor(now / 1000)
  const sig = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")
  return `t=${t},v1=${sig}`
}

function sessionEvent(type: string, paymentStatus: string): string {
  return JSON.stringify({
    id: `evt_${type}`,
    type,
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        amount_total: 500,
        currency: "usd",
        payment_status: paymentStatus,
        metadata: {
          actor_id: "ada@example.com",
          subject_id: "camp-1",
          job_id: "job-1",
          piece_count: "2",
          amount_cents: "500",
          postage_only: "false",
        },
      },
    },
  })
}

test("only a verified paid webhook marks the charge, and a bank delay does not", async () => {
  const sql = new MemorySql()
  const now = Date.parse("2026-11-17T00:00:00.000Z")
  const secret = "whsec_test"
  const webhookEnv = env({ STRIPE_WEBHOOK_SECRET: secret })
  await appendAudit(
    { actorId: "ada@example.com", action: "approve", subjectId: "camp-1", before: null, after: { approved: true } },
    new Date(now),
    sql
  )
  const pending = sessionEvent("checkout.session.completed", "unpaid")
  const pendingResult = await applyStripeWebhook(pending, signed(pending, secret, now), webhookEnv, now, sql)
  assert.equal(pendingResult.charged, false)
  assert.equal(pendingResult.mailed, false)

  const paid = sessionEvent("checkout.session.async_payment_succeeded", "paid")
  const bad = await applyStripeWebhook(paid, "t=1,v1=nope", webhookEnv, now, sql)
  assert.equal(bad.charged, false)
  assert.equal(bad.status, 400)

  const good = await applyStripeWebhook(paid, signed(paid, secret, now), webhookEnv, now, sql)
  assert.equal(good.charged, true)
  assert.equal(good.mailed, false)
  const again = await applyStripeWebhook(paid, signed(paid, secret, now), webhookEnv, now, sql)
  assert.equal(again.charged, false)
})
