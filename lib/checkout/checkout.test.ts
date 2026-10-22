import assert from "node:assert/strict"
import { createHmac } from "crypto"
import { test } from "node:test"

import { DEFAULT_PRICING_CONFIG } from "@/lib/pricing/defaults"
import { quoteMailing } from "@/lib/pricing/quote"
import { createFilePaymentStore } from "@/lib/payments/store"
import type { PaymentRecord } from "@/lib/payments/types"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { checkoutDecision } from "./decision"
import { applyStripeEvent } from "./fulfill"
import { checkoutAvailability, readStripeConfig, verifyStripeSignature } from "./stripe-config"

const acceptance = { acceptedAt: "2026-10-22T00:00:00.000Z", version: "checkout-hook" }

function price(count = 2) {
  return quoteMailing(DEFAULT_PRICING_CONFIG, {
    productId: "postcard_5x8",
    mailClass: "first_class",
    pieceCount: count,
  })
}

test("checkout stays off until every Stripe test key is present", () => {
  assert.equal(readStripeConfig({ NODE_ENV: "test" }).enabled, false)
  assert.match(checkoutAvailability({ NODE_ENV: "test" }).message ?? "", /not set up yet/)
  assert.match(checkoutAvailability({ STRIPE_SECRET_KEY: "sk_test_a", NODE_ENV: "test" }).message ?? "", /webhook secret/)
  const live = readStripeConfig({
    STRIPE_SECRET_KEY: "sk_live_a",
    STRIPE_WEBHOOK_SECRET: "whsec_a",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_a",
    NODE_ENV: "test",
  })
  assert.equal(live.enabled, false)
  const ready = readStripeConfig({
    STRIPE_SECRET_KEY: "sk_test_a",
    STRIPE_WEBHOOK_SECRET: "whsec_a",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_a",
    NODE_ENV: "test",
  })
  assert.equal(ready.enabled, true)
})

test("payment cannot start before the compliance hook is accepted", () => {
  const blocked = checkoutDecision({
    pieceCount: 2,
    acceptance: null,
    checkout: { enabled: true, message: null },
    price: price(),
    credentialsConfigured: true,
    productionLocked: false,
  })
  assert.equal(blocked.ok, false)
  if (!blocked.ok) assert.match(blocked.message, /mailing terms/)

  const ready = checkoutDecision({
    pieceCount: 2,
    acceptance,
    checkout: { enabled: true, message: null },
    price: price(),
    credentialsConfigured: true,
    productionLocked: false,
  })
  assert.equal(ready.ok, true)
})

test("a missing Stripe setup blocks checkout without sending the mailing", () => {
  const decision = checkoutDecision({
    pieceCount: 2,
    acceptance,
    checkout: checkoutAvailability({} as NodeJS.ProcessEnv),
    price: price(),
    credentialsConfigured: true,
    productionLocked: false,
  })
  assert.equal(decision.ok, false)
  if (!decision.ok) assert.match(decision.message, /Nothing is sent/)
})

test("webhook signature rejects a missing or stale signature", () => {
  const payload = JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test", metadata: { paymentId: "pay_1" } } },
  })
  const secret = "whsec_test"
  const nowMs = 1_700_000_000_000
  const timestamp = String(Math.floor(nowMs / 1000))
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")
  const header = `t=${timestamp},v1=${signature}`
  const event = verifyStripeSignature(payload, header, secret, nowMs)
  assert.equal(event?.id, "evt_1")
  assert.equal(verifyStripeSignature(payload, header, "whsec_other", nowMs), null)
  assert.equal(verifyStripeSignature(payload, `t=${Number(timestamp) - 600},v1=${signature}`, secret, nowMs), null)
  assert.equal(verifyStripeSignature(payload, null, secret, nowMs), null)
})

test("a paid webhook submits once, and a failed payment does not", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mm-pay-"))
  try {
    const payments = createFilePaymentStore(dir)
    const payment: PaymentRecord = {
      id: "pay_1",
      campaignId: "camp_1",
      orderId: "order_1",
      status: "pending",
      amountCents: 99,
      currency: "usd",
      pieceCount: 2,
      productId: "postcard_5x8",
      mailClass: "first_class",
      perCardLabel: "$0.495",
      totalLabel: "$0.99",
      createdAt: "2026-10-22T00:00:00.000Z",
      updatedAt: "2026-10-22T00:00:00.000Z",
    }
    await payments.put(payment)
    let submits = 0
    const fulfillment = {
      async submit() {
        submits += 1
        return { ok: true as const }
      },
    }
    const paid = await applyStripeEvent({
      payments,
      now: () => "2026-10-22T01:00:00.000Z",
      fulfillment,
      event: {
        id: "evt_paid",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_1",
            payment_status: "paid",
            amount_total: 99,
            payment_intent: "pi_1",
            metadata: { paymentId: "pay_1" },
          },
        },
      },
    })
    assert.equal(paid.submitted, true)
    assert.equal(submits, 1)
    const again = await applyStripeEvent({
      payments,
      now: () => "2026-10-22T01:05:00.000Z",
      fulfillment,
      event: {
        id: "evt_paid_2",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_1",
            payment_status: "paid",
            amount_total: 99,
            payment_intent: "pi_1",
            metadata: { paymentId: "pay_1" },
          },
        },
      },
    })
    assert.equal(again.submitted, true)
    assert.equal(submits, 1)
    const saved = await payments.get("pay_1")
    assert.equal(saved?.status, "paid")
    assert.equal(saved?.stripePaymentIntentId, "pi_1")
    assert.equal(saved?.fulfillment, "submitted")
    assert.equal(saved?.campaignId, "camp_1")
    assert.equal(saved?.orderId, "order_1")

    const failedPayment: PaymentRecord = { ...payment, id: "pay_2", status: "pending" }
    await payments.put(failedPayment)
    const failed = await applyStripeEvent({
      payments,
      now: () => "2026-10-22T02:00:00.000Z",
      fulfillment,
      event: {
        id: "evt_fail",
        type: "payment_intent.payment_failed",
        data: {
          object: {
            metadata: { paymentId: "pay_2" },
            last_payment_error: { message: "The card was declined." },
          },
        },
      },
    })
    assert.equal(failed.submitted, false)
    assert.equal(submits, 1)
    assert.equal((await payments.get("pay_2"))?.status, "failed")

    const abandoned: PaymentRecord = { ...payment, id: "pay_3", status: "pending" }
    await payments.put(abandoned)
    await applyStripeEvent({
      payments,
      now: () => "2026-10-22T03:00:00.000Z",
      fulfillment,
      event: {
        id: "evt_expired",
        type: "checkout.session.expired",
        data: { object: { metadata: { paymentId: "pay_3" } } },
      },
    })
    assert.equal((await payments.get("pay_3"))?.status, "cancelled")
    assert.equal(submits, 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
