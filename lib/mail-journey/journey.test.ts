import assert from "node:assert/strict"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import { POST as paymentWebhook } from "@/app/api/payments/webhook/route"
import type { MailPiece, UploadedDesign } from "@/lib/campaign-creator/types"

import { approvalCovers, createApproval } from "./approval"
import { createFileJourneyStore, jobFromApproval } from "./job"
import { listIdentity, reviewCustomerList } from "./list-import"
import { attemptMail, PRINT_TEST_REFUSAL } from "./mail-gate"
import { recordPayment } from "./record-payment"
import { buildQuote, readApprovedSchedule, type ApprovedPriceSchedule } from "./pricing"
import { createStagingPaymentAdapter, clientReturnLeavesOrder, signPaymentNotice, type PaymentNotice } from "./payment"
import { freezeProof } from "./proof"

const csv = [
  "First Name,Last Name,Street,Apt,City,State,ZIP",
  "Ada,Lovelace,123 Main St,Apt 4B,San Diego,CA,92101",
  "Ada,Lovelace,123 Main St,Apt 4B,San Diego,California,92101",
  "Grace,Hopper,1 Navy Way,,Arlington,VA,22201",
  "Bad,Row,,,,Nowhere,ZZ,12",
].join("\n")

const schedule: ApprovedPriceSchedule = {
  id: "price-2026-11",
  status: "approved",
  currency: "usd",
  perPieceCents: 250,
  termsVersion: "terms-1",
  effectiveUntil: "2026-12-01T00:00:00.000Z",
}

function piece(): MailPiece {
  return {
    id: "piece-1",
    version: 3,
    approvedAt: "2026-11-01T00:00:00.000Z",
    directionId: "d",
    revisionId: "r",
    catalogId: "postcard-5x8",
    catalogVersion: "1",
    spec: {},
  } as unknown as MailPiece
}

test("a customer CSV keeps the apartment, drops duplicates, and does not claim postal validation", () => {
  const review = reviewCustomerList(csv)
  assert.equal(review.validation, "syntax")
  assert.match(review.validationNote, /not a postal deliverability check/)
  assert.equal(review.submittedRows, 4)
  assert.equal(review.acceptedCount, 2)
  assert.equal(review.accepted[0]?.address2, "Apt 4B")
  assert.equal(review.accepted[0]?.state, "CA")
  assert.equal(review.accepted[1]?.first, "Grace")
  assert.equal(review.duplicates.length, 1)
  assert.equal(review.duplicates[0]?.matchesRow, 2)
  assert.equal(review.invalid.length, 1)
  assert.match(review.invalid[0]?.messages.join(" ") ?? "", /Row 5/)
  assert.equal(review.headerError, null)

  const missing = reviewCustomerList("Name,City\nAda,San Diego\n")
  assert.match(missing.headerError ?? "", /first, last, address1, state, zip/)
  assert.equal(missing.acceptedCount, 0)
})

test("a quote exists only from an explicit approved schedule", () => {
  const now = "2026-11-08T00:00:00.000Z"
  assert.equal(readApprovedSchedule({} as NodeJS.ProcessEnv), null)
  const blocked = buildQuote(null, 2, now)
  assert.equal(blocked.ok, false)
  if (!blocked.ok) assert.match(blocked.message, /no approved price/)
  const quoted = buildQuote(schedule, 2, now)
  assert.equal(quoted.ok, true)
  if (quoted.ok) {
    assert.equal(quoted.quote.totalCents, 500)
    assert.equal(quoted.quote.currency, "usd")
    assert.equal(quoted.quote.termsVersion, "terms-1")
  }
  const expired = buildQuote({ ...schedule, effectiveUntil: "2026-11-01T00:00:00.000Z" }, 2, now)
  assert.equal(expired.ok, false)
  if (!expired.ok) assert.equal(expired.code, "expired")
  const placeholder = readApprovedSchedule({
    MAIL_APPROVED_PRICE_JSON: JSON.stringify({ ...schedule, status: "draft" }),
  } as unknown as NodeJS.ProcessEnv)
  assert.equal(placeholder, null)
})

test("an edit to the proof, the list, or the price makes the approval stale", () => {
  const now = "2026-11-08T00:00:00.000Z"
  const review = reviewCustomerList(csv)
  const identity = listIdentity(review.accepted)
  const quoted = buildQuote(schedule, identity.count, now)
  assert.equal(quoted.ok, true)
  if (!quoted.ok) return
  const frozen = freezeProof({ mailPiece: piece() })
  assert.equal(frozen.ok, true)
  if (!frozen.ok) return
  const approval = createApproval({
    campaignId: "camp",
    ownerId: "alice@example.com",
    proof: frozen.proof,
    listHash: identity.hash,
    listCount: identity.count,
    quote: quoted.quote,
    acceptedAt: now,
  })
  const current = {
    proofHash: frozen.proof.proofHash,
    listHash: identity.hash,
    listCount: identity.count,
    quote: quoted.quote,
    nowIso: now,
  }
  assert.equal(approvalCovers(approval, current).ok, true)

  const changedBack: UploadedDesign = {
    issues: [],
    front: { fileName: "front.png", mediaType: "image/png", byteLength: 10, key: "front.png" },
    back: { fileName: "back.png", mediaType: "image/png", byteLength: 11, key: "back.png" },
  }
  const nextProof = freezeProof({ uploadedDesign: changedBack })
  assert.equal(nextProof.ok, true)
  if (!nextProof.ok) return
  const proofEdit = approvalCovers(approval, { ...current, proofHash: nextProof.proof.proofHash })
  assert.equal(proofEdit.ok, false)
  if (!proofEdit.ok) assert.match(proofEdit.message, /proof changed/)

  const shorter = listIdentity(review.accepted.slice(0, 1))
  const listEdit = approvalCovers(approval, { ...current, listHash: shorter.hash, listCount: shorter.count })
  assert.equal(listEdit.ok, false)

  const repriced = buildQuote({ ...schedule, perPieceCents: 300, id: "price-next" }, identity.count, now)
  assert.equal(repriced.ok, true)
  if (!repriced.ok) return
  const priceEdit = approvalCovers(approval, { ...current, quote: repriced.quote })
  assert.equal(priceEdit.ok, false)

  const later = approvalCovers(approval, { ...current, nowIso: "2026-12-02T00:00:00.000Z" })
  assert.equal(later.ok, false)
  if (!later.ok) assert.match(later.message, /expired/)
})

test("one checkout key creates one stored order when two requests race", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-journey-"))
  try {
    const first = createFileJourneyStore(directory)
    const second = createFileJourneyStore(directory)
    const now = "2026-11-08T00:00:00.000Z"
    const review = reviewCustomerList(csv)
    const identity = listIdentity(review.accepted)
    const quoted = buildQuote(schedule, identity.count, now)
    const frozen = freezeProof({ mailPiece: piece() })
    if (!quoted.ok || !frozen.ok) throw new Error("fixture")
    const approval = createApproval({
      campaignId: "camp",
      ownerId: "alice@example.com",
      proof: frozen.proof,
      listHash: identity.hash,
      listCount: identity.count,
      quote: quoted.quote,
      acceptedAt: now,
    })
    await first.saveApproval(approval)
    const key = "checkout-race-key"
    const [left, right] = await Promise.all([
      first.createJob(jobFromApproval(approval, key, now)),
      second.createJob(jobFromApproval(approval, key, now)),
    ])
    assert.equal(left.job.id, right.job.id)
    assert.equal([left.created, right.created].filter(Boolean).length, 1)
    const stored = await first.getJob(left.job.id)
    assert.equal(stored?.state, "awaiting_payment")
    assert.equal(stored?.amountCents, 500)
    const files = await readdir(directory)
    assert.equal(files.filter((file) => file.startsWith("idem-")).length, 1)
    await assert.rejects(
      () =>
        first.createJob({
          ...jobFromApproval(approval, key, now),
          ownerId: "bob@example.com",
        }),
      /different order/
    )
    assert.equal((await first.getJob(left.job.id))?.ownerId, "alice@example.com")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("payment notices mail nothing, and unknown or duplicate events stay safe", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-pay-"))
  const secret = "test-webhook-secret"
  const adapter = createStagingPaymentAdapter()
  try {
    const store = createFileJourneyStore(directory)
    const now = "2026-11-08T00:00:00.000Z"
    const review = reviewCustomerList(csv)
    const identity = listIdentity(review.accepted)
    const quoted = buildQuote(schedule, identity.count, now)
    const frozen = freezeProof({ mailPiece: piece() })
    if (!quoted.ok || !frozen.ok) throw new Error("fixture")
    const approval = createApproval({
      campaignId: "camp",
      ownerId: "alice@example.com",
      proof: frozen.proof,
      listHash: identity.hash,
      listCount: identity.count,
      quote: quoted.quote,
      acceptedAt: now,
    })
    const opened = await store.createJob(jobFromApproval(approval, "checkout-pay-key", now))
    const job = opened.job

    const pending: PaymentNotice = {
      eventId: "evt-pending",
      orderId: job.id,
      outcome: "pending",
      currency: "usd",
      amountCents: 500,
    }
    const unknown = await recordPayment(store, { ...pending, eventId: "evt-unknown", outcome: "unknown" }, signPaymentNotice({ ...pending, eventId: "evt-unknown", outcome: "unknown" }, secret), secret, now)
    assert.equal(unknown.ok, true)
    if (!unknown.ok) return
    assert.equal(unknown.job.state, "payment_unknown")
    assert.equal(unknown.mailed, false)
    const held = attemptMail(unknown.job, { payment: "live", mail: "live" })
    assert.equal(held.mailed, false)
    assert.equal(held.externalCalls, 0)
    assert.match(held.message, /not submitted again/)

    const paidNotice: PaymentNotice = { ...pending, eventId: "evt-paid", outcome: "succeeded" }
    const paid = await recordPayment(store, paidNotice, signPaymentNotice(paidNotice, secret), secret, now)
    assert.equal(paid.ok, true)
    if (!paid.ok) return
    assert.equal(paid.job.state, "paid")
    const again = await recordPayment(store, paidNotice, signPaymentNotice(paidNotice, secret), secret, now)
    assert.equal(again.ok, true)
    if (!again.ok) return
    assert.equal(again.job.appliedEventIds.filter((id) => id === "evt-paid").length, 1)

    const latePending: PaymentNotice = { ...pending, eventId: "evt-late" }
    const stillPaid = await recordPayment(store, latePending, signPaymentNotice(latePending, secret), secret, now)
    assert.equal(stillPaid.ok, true)
    if (!stillPaid.ok) return
    assert.equal(stillPaid.job.state, "paid")

    const mismatch: PaymentNotice = { ...paidNotice, eventId: "evt-wrong", amountCents: 50 }
    const wrong = await recordPayment(store, mismatch, signPaymentNotice(mismatch, secret), secret, now)
    assert.equal(wrong.ok, true)
    if (!wrong.ok) return
    assert.equal(wrong.job.state, "held")
    assert.equal(attemptMail(wrong.job).mailed, false)

    const returned = clientReturnLeavesOrder(wrong.job)
    assert.equal(returned.state, wrong.job.state)
    assert.equal(adapter.calls.length, 0)
    assert.throws(() => adapter.charge(), /does not contact a payment provider/)

    const forged = await recordPayment(store, paidNotice, "deadbeef", secret, now)
    assert.equal(forged.ok, false)
    const unsigned = await recordPayment(store, paidNotice, signPaymentNotice(paidNotice, secret), undefined, now)
    assert.equal(unsigned.ok, false)

    const staging = attemptMail(paid.job, { payment: "staging", mail: "staging" })
    assert.equal(staging.mailed, false)
    assert.equal(staging.externalCalls, 0)
    const live = attemptMail(paid.job, { payment: "live", mail: "live" })
    assert.equal(live.mailed, false)
    assert.match(live.message, /not connected/)
    assert.match(PRINT_TEST_REFUSAL, /Nothing was sent/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("an unverified webhook does not mark an order paid", async () => {
  const previous = process.env.PAYMENT_WEBHOOK_SECRET
  delete process.env.PAYMENT_WEBHOOK_SECRET
  try {
    const response = await paymentWebhook(
      new Request("http://localhost/api/payments/webhook", {
        method: "POST",
        body: JSON.stringify({
          eventId: "evt",
          orderId: "missing",
          outcome: "succeeded",
          currency: "usd",
          amountCents: 500,
        }),
        headers: { "x-payment-signature": "nope" },
      })
    )
    const body = (await response.json()) as { ok: boolean; mailed: boolean }
    assert.equal(response.status, 400)
    assert.equal(body.ok, false)
    assert.equal(body.mailed, false)
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_WEBHOOK_SECRET
    else process.env.PAYMENT_WEBHOOK_SECRET = previous
  }
})
