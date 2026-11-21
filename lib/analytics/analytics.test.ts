import assert from "node:assert/strict"
import { test } from "node:test"

import { createEmptyCampaignCreative, type Campaign } from "@/lib/campaign-creator/types"

import { addressKey, matchback, streetsFromCsv } from "./match"
import { outcomeFigures } from "./money"
import { coarsePlace, deviceFromAgent, visitorFromCookie } from "./read"
import { piecesByStage, stageForJob } from "./stage"
import { bookingPresentation, ensureCampaignQr, forwardTarget, issueRecipientQr, logScan, logTap, resetAnalytics, saveLead } from "./store"

test("only ordered, printing, and mailed come from a job status", () => {
  assert.equal(stageForJob("MAILED", true), "mailed")
  assert.equal(stageForJob("IN_PRODUCTION", true), "printing")
  assert.equal(stageForJob("ORDER_SUBMITTED", true), "ordered")
  assert.equal(stageForJob("MAILED", false), null)
  assert.equal(stageForJob("ERROR", true), null)
  const stages = piecesByStage([
    campaign("a", "MAILED", 40),
    campaign("b", "IN_PRODUCTION", 10),
  ])
  assert.deepEqual(stages, { ordered: 0, printing: 10, mailed: 40 })
  assert.equal(piecesByStage([campaign("c", "ERROR", 5)]), null)
})

test("a campaign QR can later grow a per-address code, and the scan log keeps the recipient empty for now", () => {
  resetAnalytics()
  const qr = ensureCampaignQr({
    campaignId: "camp",
    ownerId: "ada",
    destination: "hosted",
    phone: "6195550100",
    headline: "Free inspection",
    offer: "This week",
    parts: { form: true },
  })
  assert.equal(qr.recipientId, null)
  assert.equal(forwardTarget(qr, "https://mail.example"), `https://mail.example/p/${qr.code}`)
  const website = ensureCampaignQr({
    campaignId: "camp",
    ownerId: "ada",
    destination: "website",
    website: "https://shop.example/offer",
  })
  assert.equal(website.code, qr.code)
  assert.equal(forwardTarget(website, "https://mail.example"), "https://shop.example/offer")
  const perAddress = issueRecipientQr("camp", "recipient-1")
  assert.ok(perAddress)
  assert.equal(perAddress?.recipientId, "recipient-1")
  assert.notEqual(perAddress?.code, qr.code)
  const scan = logScan({
    code: qr.code,
    device: "phone",
    place: "Austin, US, 78701",
    visitor: "v1",
    repeat: false,
    at: "2026-11-21T15:00:00.000Z",
  })
  assert.equal(scan?.recipientId, null)
  assert.equal(saveLead({ campaignId: "camp", name: "Ada", phone: "", email: "", message: "Call me" })?.name, "Ada")
})

test("a booking tap is counted and is not treated as a booked time", () => {
  resetAnalytics()
  const qr = ensureCampaignQr({
    campaignId: "book",
    ownerId: "ada",
    destination: "hosted",
    parts: { booking: true, bookingUrl: "https://calendly.com/ada/visit" },
  })
  assert.equal(bookingPresentation("https://calendly.com/ada/visit"), "calendly")
  assert.equal(bookingPresentation("https://book.example/ada"), "button")
  assert.equal(logTap(qr.code, "booking"), true)
  assert.equal(logTap(qr.code, "call"), false)
  assert.equal(saveLead({ campaignId: "book", name: "Ada", phone: "", email: "", message: "" }), null)
})

test("matchback ignores punctuation and counts each new customer once", () => {
  assert.equal(addressKey({ street: "12 Main Street", city: "Austin", state: "Texas", zip: "78701-1234" }).includes("78701"), true)
  const result = matchback(
    ["12 Main St, Austin TX 78701", "9 Oak Ave"],
    ["12 Main Street, Austin TX 78701", "12 main st austin tx 78701", "4 Pine Rd"]
  )
  assert.equal(result.matched, 1)
  assert.match(result.sentence, /1 of your new customers received this mailer/)
  assert.deepEqual(streetsFromCsv("name,address\nAda,12 Main St"), ["12 Main St"])
})

test("cost figures stay blank until a charge and a count both exist", () => {
  assert.deepEqual(outcomeFigures({ chargeCents: null, leads: 2, jobs: 1, revenueCents: 1000 }), {
    costPerLead: null,
    costPerJob: null,
    returnOnSpend: null,
  })
  assert.equal(outcomeFigures({ chargeCents: 5000, leads: 2, jobs: 1, revenueCents: 10000 }).costPerLead, "$25.00")
  assert.equal(outcomeFigures({ chargeCents: 5000, leads: 2, jobs: 1, revenueCents: 10000 }).returnOnSpend, "2.00×")
})

test("a repeat visitor is the cookie, and place comes only from host headers", () => {
  assert.equal(deviceFromAgent("Mozilla/5.0 (iPhone)"), "phone")
  assert.equal(deviceFromAgent("Mozilla/5.0 (iPad)"), "tablet")
  assert.equal(visitorFromCookie("mm_visitor=abcdefghij").repeat, true)
  assert.equal(visitorFromCookie(null).repeat, false)
  const headers = new Headers({ "x-vercel-ip-city": "Austin", "x-vercel-ip-postal-code": "78701" })
  assert.equal(coarsePlace(headers), "Austin, 78701")
  assert.equal(coarsePlace(new Headers()), null)
})

function campaign(id: string, jobStatus: string, pieceCount: number): Campaign {
  return {
    id,
    ownerId: "ada",
    name: id,
    status: "launched",
    brief: {},
    creative: createEmptyCampaignCreative(),
    transcript: [],
    readyForBriefReview: false,
    createdAt: "2026-11-21T00:00:00.000Z",
    updatedAt: "2026-11-21T00:00:00.000Z",
    mailOrder: {
      id: "order",
      mode: "test",
      environment: "stage",
      pieceCount,
      estimatedCostLabel: "Placeholder",
      artwork: "type-plate",
      submitted: true,
      jobStatus,
      product: {
        documentClass: "Postcard",
        layout: "Double Sided Postcard",
        paperType: "White",
        printOption: "Color",
        mailClass: "First Class",
        productionTime: "Next Day",
        color: "Full",
      },
      createdAt: "2026-11-21T00:00:00.000Z",
      updatedAt: "2026-11-21T00:00:00.000Z",
    },
  }
}
