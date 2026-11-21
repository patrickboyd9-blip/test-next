import assert from "node:assert/strict"
import { test } from "node:test"

import { formConsentLine, pageFooterNotice, personalRetentionMonths, PRIVACY_PATH } from "./privacy"
import {
  anonymousEvents,
  deletePerson,
  personalRecords,
  purgeExpiredPersonal,
  recordSeparatedEvent,
  resetPrivacyRecords,
  rollupRows,
} from "./privacy"
import { deleteAnalyticsPerson, ensureCampaignQr, resetAnalytics, saveLead } from "./store"

test("the page notice and the form line live in one place", () => {
  assert.equal(
    pageFooterNotice("Harbor Roofing"),
    "This page is provided by Modern Mail on behalf of Harbor Roofing. See our Privacy Policy."
  )
  assert.match(formConsentLine("Harbor Roofing"), /Harbor Roofing may contact you/)
  assert.match(formConsentLine("Harbor Roofing"), /Privacy Policy/)
  assert.equal(PRIVACY_PATH, "/privacy")
  assert.equal(personalRetentionMonths({} as unknown as NodeJS.ProcessEnv), 24)
})

test("personal details stay off the anonymous event and the long-term rollup", () => {
  resetPrivacyRecords()
  const saved = recordSeparatedEvent({
    at: "2026-11-21T15:00:00.000Z",
    kind: "lead",
    campaignId: "camp",
    industry: "roofing",
    offerType: "phone_call",
    place: "Austin, US, 78701",
    device: "phone",
    personal: { name: "Ada Lovelace", phone: "6195550100", email: "ada@example.com", ip: "203.0.113.8", personKey: "visitor-1" },
  })
  const packedAnonymous = JSON.stringify(saved.anonymous)
  assert.equal(packedAnonymous.includes("Ada"), false)
  assert.equal(packedAnonymous.includes("6195550100"), false)
  assert.equal(packedAnonymous.includes("ada@example.com"), false)
  assert.equal(packedAnonymous.includes("203.0.113.8"), false)
  assert.equal(saved.anonymous.zip3, "787")
  assert.equal(saved.anonymous.industry, "roofing")
  assert.equal(saved.personal?.ip, "203.0.113.8")
  assert.equal(rollupRows()[0]?.count, 1)
  recordSeparatedEvent({
    at: "2026-11-21T16:00:00.000Z",
    kind: "lead",
    campaignId: "camp",
    industry: "roofing",
    offerType: "phone_call",
    place: "78701",
    device: "phone",
    personal: { name: "Grace", email: "grace@example.com" },
  })
  assert.equal(rollupRows()[0]?.count, 2)
  assert.equal(deletePerson({ email: "ada@example.com" }), 1)
  assert.equal(personalRecords().some((row) => row.email === "ada@example.com"), false)
  assert.equal(rollupRows()[0]?.count, 2)
  assert.equal(anonymousEvents().length, 2)
})

test("raw personal rows older than the retention window are dropped", () => {
  resetPrivacyRecords()
  recordSeparatedEvent({
    at: "2024-01-01T00:00:00.000Z",
    kind: "scan",
    campaignId: "camp",
    personal: { ip: "198.51.100.4", personKey: "old" },
    now: new Date("2026-11-21T00:00:00.000Z"),
  })
  assert.equal(personalRecords().length, 0)
  assert.equal(anonymousEvents().length, 1)
  recordSeparatedEvent({
    at: "2026-11-01T00:00:00.000Z",
    kind: "scan",
    campaignId: "camp",
    personal: { ip: "198.51.100.9", personKey: "new" },
  })
  assert.equal(purgeExpiredPersonal(new Date("2026-11-21T00:00:00.000Z"), { ANALYTICS_PERSONAL_RETENTION_MONTHS: "24" } as unknown as NodeJS.ProcessEnv), 0)
  assert.equal(personalRecords().some((row) => row.personKey === "new"), true)
})

test("deleting a person removes the lead and leaves the rollup", () => {
  resetAnalytics()
  ensureCampaignQr({
    campaignId: "camp",
    ownerId: "ada",
    destination: "hosted",
    parts: { form: true },
  })
  saveLead({ campaignId: "camp", name: "Ada", phone: "6195550100", email: "ada@example.com", message: "Hi", ip: "203.0.113.8" })
  assert.equal(rollupRows().some((row) => row.kind === "lead"), true)
  deleteAnalyticsPerson({ email: "ada@example.com" })
  assert.equal(personalRecords().some((row) => row.email === "ada@example.com"), false)
  assert.equal(rollupRows().some((row) => row.kind === "lead" && row.count >= 1), true)
})
