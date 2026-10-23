import assert from "node:assert/strict"
import { test } from "node:test"

import type { MailOrderRecord } from "@/lib/click2mail/order-record"
import type { PaymentRecord } from "@/lib/payments/types"

import { applyCancellation, cancelWindow } from "./cancel"
import { presentOrder } from "./present"

const now = "2026-10-22T15:00:00.000Z"

function payment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: "pay_1",
    campaignId: "camp_1",
    orderId: "order_1",
    status: "paid",
    amountCents: 500,
    currency: "usd",
    pieceCount: 10,
    productId: "postcard_5x8",
    mailClass: "first_class",
    perCardLabel: "$0.50",
    totalLabel: "$5.00",
    stripePaymentIntentId: "pi_1",
    createdAt: now,
    updatedAt: now,
    paidAt: now,
    ...overrides,
  }
}

function order(overrides: Partial<MailOrderRecord> = {}): MailOrderRecord {
  return {
    id: "order_1",
    mode: "test",
    environment: "stage",
    pieceCount: 10,
    estimatedCostLabel: "$5.00",
    artwork: "type-plate",
    jobId: "job_1",
    jobStatus: "ORDER_SUBMITTED",
    submitted: true,
    submittedAt: "2026-10-22T15:00:00.000Z",
    product: {
      documentClass: "Postcard 5 x 8",
      layout: "Double Sided Postcard",
      paperType: "White Matte with Gloss UV Finish",
      printOption: "Printing both sides",
      mailClass: "First Class",
      productionTime: "Next Day",
      color: "Full Color",
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

test("order steps follow paid, submitted, printing, and mailed", () => {
  const paid = presentOrder({
    payment: payment({ fulfillment: undefined }),
    order: order({ submitted: false, submittedAt: undefined, jobStatus: "EDITING" }),
    campaignName: "Spring offer",
    now: new Date("2026-10-22T16:00:00.000Z"),
  })
  assert.equal(paid.steps.find((step) => step.state === "current")?.label, "Paid")
  assert.match(paid.sentence, /not been sent/)
  assert.equal(paid.canCancel, true)

  const submitted = presentOrder({
    payment: payment({ fulfillment: "submitted" }),
    order: order(),
    campaignName: "Spring offer",
    now: new Date("2026-10-22T16:00:00.000Z"),
  })
  assert.equal(submitted.steps.map((step) => step.state).join(","), "complete,current,upcoming,upcoming")

  const printing = presentOrder({
    payment: payment({ fulfillment: "submitted" }),
    order: order({ jobStatus: "IN_PRODUCTION" }),
    campaignName: "Spring offer",
    now: new Date("2026-10-22T16:00:00.000Z"),
  })
  assert.equal(printing.steps.find((step) => step.state === "current")?.label, "Printing")
  assert.equal(printing.canCancel, false)

  const mailed = presentOrder({
    payment: payment({ fulfillment: "submitted" }),
    order: order({ jobStatus: "MAILED" }),
    campaignName: "Spring offer",
    now: new Date("2026-10-22T16:00:00.000Z"),
  })
  assert.equal(mailed.steps.every((step, index) => (index < 3 ? step.state === "complete" : step.state === "current")), true)
  assert.equal(mailed.sentence, "Mailed.")
})

test("cancel refunds before the cutoff and refuses after it", async () => {
  const open = cancelWindow({
    payment: payment(),
    order: order(),
    now: new Date("2026-10-22T16:00:00.000Z"),
  })
  assert.equal(open.allowed, true)

  const closed = cancelWindow({
    payment: payment(),
    order: order(),
    now: new Date("2026-10-23T00:00:00.000Z"),
  })
  assert.equal(closed.allowed, false)

  let cancelledJob = ""
  let refunded = ""
  const done = await applyCancellation({
    payment: payment(),
    order: order(),
    now: "2026-10-22T16:00:00.000Z",
    async cancelJob(jobId) {
      cancelledJob = jobId
    },
    async refund(paymentIntentId) {
      refunded = paymentIntentId
      return { id: "re_1" }
    },
  })
  assert.equal(done.ok, true)
  if (done.ok) {
    assert.equal(done.payment.status, "refunded")
    assert.equal(done.payment.refundId, "re_1")
  }
  assert.equal(cancelledJob, "job_1")
  assert.equal(refunded, "pi_1")

  const tooLate = await applyCancellation({
    payment: payment(),
    order: order(),
    now: "2026-10-23T00:00:00.000Z",
    async cancelJob() {
      throw new Error("should not cancel")
    },
    async refund() {
      throw new Error("should not refund")
    },
  })
  assert.equal(tooLate.ok, false)

  const printerRefused = await applyCancellation({
    payment: payment(),
    order: order(),
    now: "2026-10-22T16:00:00.000Z",
    async cancelJob() {
      throw new Error("Click2Mail could not cancel this job.")
    },
    async refund() {
      throw new Error("should not refund")
    },
  })
  assert.equal(printerRefused.ok, false)
  if (!printerRefused.ok) assert.match(printerRefused.message, /not refunded/)
})

test("a paid job that was never submitted can be refunded without calling the printer", async () => {
  let cancelCalls = 0
  const done = await applyCancellation({
    payment: payment(),
    order: order({ submitted: false, submittedAt: undefined, jobStatus: "EDITING" }),
    now: "2026-10-22T23:30:00.000Z",
    async cancelJob() {
      cancelCalls += 1
    },
    async refund() {
      return { id: "re_2" }
    },
  })
  assert.equal(done.ok, true)
  assert.equal(cancelCalls, 0)
})
