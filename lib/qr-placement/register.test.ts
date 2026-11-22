import assert from "node:assert/strict"
import test from "node:test"

import { findQr, forwardTarget, logScan, resetAnalytics, scansFor, upsertPlacedQr } from "@/lib/analytics/store"

import { sanitizePlacedQrs } from "./model"
import { registerPlacedQrs } from "./register"

test("each QR keeps its own tracked destination", () => {
  resetAnalytics()
  const front = {
    id: "qr-front",
    side: "front",
    xInches: 0.4,
    yInches: 0.4,
    sizeInches: 1,
    destination: "page",
    website: "https://harbor.example",
    phone: "(619) 555-0148",
    code: "abcd2345",
    parts: { call: false, form: false, booking: false, bookingUrl: null },
  }
  const back = {
    ...front,
    id: "qr-back",
    side: "back",
    code: "efgh6789",
    destination: "website",
    website: "https://harbor.example/offer",
  }
  const sanitized = sanitizePlacedQrs("5x8", [front, back])
  assert.equal(sanitized.ok, true)
  if (!sanitized.ok) return
  const saved = registerPlacedQrs({
    campaignId: "camp-qr",
    ownerId: "owner",
    origin: "https://mail.example",
    businessName: "Harbor Roofing",
    headline: "Free roof inspection",
    offer: "Call to book a visit",
    phone: "(619) 555-0148",
    codes: sanitized.codes,
  })
  assert.equal(saved.length, 2)
  assert.equal(saved[0]?.scanUrl, "https://mail.example/q/abcd2345")
  assert.equal(saved[1]?.scanUrl, "https://mail.example/q/efgh6789")
  const page = findQr("abcd2345")
  const site = findQr("efgh6789")
  assert.ok(page && site)
  assert.equal(forwardTarget(page!, "https://mail.example"), "https://mail.example/p/abcd2345")
  assert.equal(forwardTarget(site!, "https://mail.example"), "https://harbor.example/offer")
  assert.ok(logScan({ code: "efgh6789", device: "phone", place: null, visitor: "v1", repeat: false }))
  assert.equal(scansFor("camp-qr").length, 1)
  assert.equal(scansFor("camp-qr")[0]?.code, "efgh6789")

  const third = upsertPlacedQr({
    code: "hjk23456",
    campaignId: "camp-qr",
    ownerId: "owner",
    destination: "hosted",
    headline: "Another",
  })
  assert.equal(third, null)
})
