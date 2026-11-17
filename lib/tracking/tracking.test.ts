import assert from "node:assert/strict"
import { test } from "node:test"

import { CLICK2MAIL_RESERVED_POINTS } from "@/lib/print-spec/click2mail-keep-outs"

import { issueRecipientCode, noteResults, recordScan, redirectUrl, resetTracking, resultsFor } from "./ledger"
import { pointsFromBottomRight, qrOverlapsReserved, qrSafeZone } from "./qr-zone"

test("the QR sits outside the address panel and the barcode zone", () => {
  for (const size of ["5x8", "6x9"] as const) {
    const qr = qrSafeZone(size)
    assert.equal(qrOverlapsReserved(size, qr), false)
    const fromCorner = pointsFromBottomRight(size, qr)
    const reserved = CLICK2MAIL_RESERVED_POINTS[size]
    assert.ok(fromCorner.right > reserved.mailingPanel.widthPoints || fromCorner.bottom > reserved.mailingPanel.heightPoints)
    assert.ok(fromCorner.right > reserved.barcodeClearZone.widthPoints || fromCorner.bottom > reserved.barcodeClearZone.heightPoints)
  }
})

test("a scan logs time, campaign, and recipient, then forwards, and a holdout does not count", () => {
  resetTracking()
  const mailed = issueRecipientCode({
    campaignId: "camp-1",
    recipientId: "r-1",
    destination: "https://shop.example/book",
    code: "roof123",
  })
  issueRecipientCode({
    campaignId: "camp-1",
    recipientId: "r-hold",
    destination: "https://shop.example/book",
    controlGroup: true,
    code: "holdout",
  })
  assert.equal(redirectUrl("https://mail.example", mailed.code), "https://mail.example/r/roof123")
  const hit = recordScan("roof123", "2026-11-17T12:00:00.000Z")
  assert.equal(hit?.destination, "https://shop.example/book")
  assert.equal(hit?.scan.campaignId, "camp-1")
  assert.equal(hit?.scan.recipientId, "r-1")
  assert.equal("phone" in (hit?.scan ?? {}), false)
  assert.equal(recordScan("holdout"), null)
  const empty = resultsFor("missing")
  assert.equal(empty.piecesMailed, null)
  assert.equal(empty.scans, null)
  assert.equal(empty.calls, null)
  noteResults("camp-1", { piecesMailed: 10, calls: 2 })
  const ledger = resultsFor("camp-1")
  assert.equal(ledger.scans, 1)
  assert.equal(ledger.uniqueScanners, 1)
  assert.equal(ledger.scanRate, 0.1)
  assert.equal(ledger.calls, 2)
  assert.equal(ledger.bookings, null)
  assert.equal(ledger.revenue, null)
})
