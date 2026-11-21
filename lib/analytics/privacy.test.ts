import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  anonymousEvents,
  CATCH_ALL_ZIP3,
  consentRecords,
  consentRetentionYears,
  consentVariantFor,
  crossCustomerBenchmarks,
  deletePerson,
  emailHash,
  phoneHash,
  formConsentLine,
  landingMarkupFindings,
  optOutRecords,
  pageFooterNotice,
  personalRecords,
  personalRetentionMonths,
  PRIVACY_PATH,
  purgeExpiredConsent,
  purgeExpiredPersonal,
  recordConsent,
  recordOptOut,
  recordSeparatedEvent,
  rejectSensitiveFields,
  resetPrivacyRecords,
  rollupRows,
  sensitiveFieldFindings,
} from "./privacy"
import { LANDING_COOKIE } from "./privacy"
import { deleteAnalyticsPerson, ensureCampaignQr, followUpLeads, leadsFor, logScan, resetAnalytics, runRetentionJob, saveLead, scansFor } from "./store"

const root = join(dirname(fileURLToPath(import.meta.url)), "../..")

test("the page notice and the four consent lines name one seller and stay marked draft", () => {
  assert.equal(
    pageFooterNotice("Harbor Roofing"),
    "DRAFT. This page is provided by Modern Mail on behalf of Harbor Roofing. See our Privacy Policy."
  )
  assert.equal(consentVariantFor({ phone: true, email: false }), "call_text")
  assert.equal(consentVariantFor({ phone: false, email: true }), "email")
  assert.equal(consentVariantFor({ phone: true, email: true }), "call_email")
  assert.equal(consentVariantFor({ phone: false, email: false }), "general")
  const lines = [
    formConsentLine("Harbor Roofing", "call_text"),
    formConsentLine("Harbor Roofing", "email"),
    formConsentLine("Harbor Roofing", "call_email"),
    formConsentLine("Harbor Roofing"),
  ]
  assert.match(lines[0], /call or text/)
  assert.match(lines[1], /email you/)
  assert.match(lines[2], /call, text, or email/)
  assert.match(lines[3], /Harbor Roofing may contact you/)
  for (const line of lines) {
    assert.match(line, /^DRAFT\./)
    assert.match(line, /Harbor Roofing is the only business that may contact you/)
    assert.match(line, /Privacy Policy/)
  }
  assert.equal(PRIVACY_PATH, "/privacy")
  assert.equal(personalRetentionMonths({} as unknown as NodeJS.ProcessEnv), 24)
  assert.equal(consentRetentionYears(), 5)
  assert.equal(LANDING_COOKIE, "mm_visitor")
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
  assert.equal(saved.personal?.emailHash, emailHash("ada@example.com"))
  assert.equal(saved.personal?.phoneHash, phoneHash("6195550100"))
  assert.equal(JSON.stringify(saved.personal).includes("ada@example.com"), false)
  assert.equal(JSON.stringify(saved.personal).includes("6195550100"), false)
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
  assert.equal(personalRecords().some((row) => row.emailHash === emailHash("ada@example.com")), false)
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

test("deletePerson removes every personal row tied to that personKey", () => {
  resetPrivacyRecords()
  recordSeparatedEvent({
    at: "2026-11-21T12:00:00.000Z",
    kind: "scan",
    campaignId: "camp",
    personal: { personKey: "visitor-9", ip: "203.0.113.1" },
  })
  recordSeparatedEvent({
    at: "2026-11-21T13:00:00.000Z",
    kind: "lead",
    campaignId: "camp",
    personal: { personKey: "visitor-9", email: "ada@example.com", ip: "203.0.113.1" },
  })
  recordSeparatedEvent({
    at: "2026-11-21T14:00:00.000Z",
    kind: "scan",
    campaignId: "camp",
    personal: { personKey: "other", ip: "198.51.100.2" },
  })
  recordConsent({
    at: "2026-11-21T13:00:00.000Z",
    personKey: "visitor-9",
    variant: "call_email",
    page: "/p/abc",
    businessName: "Harbor Roofing",
  })
  assert.equal(deletePerson({ personKey: "visitor-9" }), 2)
  assert.equal(personalRecords().some((row) => row.personKey === "visitor-9"), false)
  assert.equal(personalRecords().length, 1)
  assert.equal(consentRecords().length, 1)
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
  assert.equal(personalRecords().some((row) => row.emailHash === emailHash("ada@example.com")), false)
  assert.equal(leadsFor("camp").some((row) => row.email === "ada@example.com"), false)
  assert.equal(rollupRows().some((row) => row.kind === "lead" && row.count >= 1), true)
})

test("consent is kept for 5 years and is exempt from the 24-month purge", () => {
  resetPrivacyRecords()
  const now = new Date("2026-11-21T00:00:00.000Z")
  recordConsent({
    at: "2024-01-01T00:00:00.000Z",
    personKey: "visitor-1",
    variant: "general",
    page: "/p/abc",
    businessName: "Harbor Roofing",
    now,
  })
  recordConsent({
    at: "2020-01-01T00:00:00.000Z",
    personKey: "visitor-old",
    variant: "email",
    page: "/p/abc",
    businessName: "Harbor Roofing",
    now: new Date("2024-06-01T00:00:00.000Z"),
  })
  recordOptOut({ at: "2024-01-01T00:00:00.000Z", personKey: "visitor-1", email: "ada@example.com", page: "/p/abc" })
  recordSeparatedEvent({
    at: "2024-01-01T00:00:00.000Z",
    kind: "scan",
    campaignId: "camp",
    personal: { personKey: "visitor-1", ip: "203.0.113.8" },
    now,
  })
  assert.equal(personalRecords().length, 0)
  assert.equal(purgeExpiredPersonal(now), 0)
  assert.equal(consentRecords().some((row) => row.personKey === "visitor-1"), true)
  assert.equal(optOutRecords()[0]?.emailHash, emailHash("ada@example.com"))
  assert.equal(optOutRecords()[0]?.personKey, "")
  assert.equal(purgeExpiredConsent(now), 1)
  assert.equal(consentRecords().some((row) => row.personKey === "visitor-1"), true)
  assert.equal(consentRecords().some((row) => row.personKey === "visitor-old"), false)
})

test("an opted-out person is left off the follow-up list", () => {
  resetAnalytics()
  ensureCampaignQr({
    campaignId: "camp",
    ownerId: "ada",
    destination: "hosted",
    parts: { form: true },
  })
  saveLead({ campaignId: "camp", name: "Ada", phone: "6195550100", email: "ada@example.com", message: "Hi", visitor: "v1" })
  saveLead({ campaignId: "camp", name: "Grace", phone: "6195550199", email: "grace@example.com", message: "Hi", visitor: "v2" })
  recordOptOut({ personKey: "v1", email: "ada@example.com", page: "/p/abc" })
  const list = followUpLeads("camp")
  assert.equal(list.some((row) => row.email === "ada@example.com"), false)
  assert.equal(list.some((row) => row.email === "grace@example.com"), true)
  assert.equal(leadsFor("camp").length, 2)
})

test("a comparison is hidden until 10 scans come from 5 businesses, and small areas fold together", () => {
  resetPrivacyRecords()
  const now = new Date("2026-11-21T00:00:00.000Z")
  for (let index = 0; index < 9; index += 1) {
    recordSeparatedEvent({
      at: "2026-11-21T00:00:00.000Z",
      kind: "scan",
      campaignId: `c${index}`,
      customerId: `owner-${index % 5}`,
      industry: "roofing",
      place: "78701",
      now,
    })
  }
  assert.deepEqual(crossCustomerBenchmarks(), [])
  recordSeparatedEvent({
    at: "2026-11-21T00:00:00.000Z",
    kind: "scan",
    campaignId: "c9",
    customerId: "owner-0",
    industry: "roofing",
    place: "78701",
    now,
  })
  const shown = crossCustomerBenchmarks()
  assert.equal(shown.length, 1)
  assert.equal(shown[0]?.zip3, "787")
  assert.equal(shown[0]?.scans, 10)
  assert.equal(shown[0]?.customers, 5)
  resetPrivacyRecords()
  for (let index = 0; index < 12; index += 1) {
    recordSeparatedEvent({
      at: "2026-11-21T00:00:00.000Z",
      kind: "scan",
      campaignId: `few-${index}`,
      customerId: `few-${index % 4}`,
      industry: "roofing",
      place: "78701",
      now,
    })
  }
  assert.deepEqual(crossCustomerBenchmarks(), [])
  resetPrivacyRecords()
  for (let index = 0; index < 6; index += 1) {
    recordSeparatedEvent({
      at: "2026-11-21T00:00:00.000Z",
      kind: "scan",
      campaignId: `small-a-${index}`,
      customerId: `a-${index}`,
      industry: "roofing",
      place: "82101",
      now,
    })
    recordSeparatedEvent({
      at: "2026-11-21T00:00:00.000Z",
      kind: "scan",
      campaignId: `small-b-${index}`,
      customerId: `b-${index}`,
      industry: "roofing",
      place: "88401",
      now,
    })
  }
  const folded = crossCustomerBenchmarks()
  assert.equal(folded.length, 1)
  assert.equal(folded[0]?.zip3, CATCH_ALL_ZIP3)
  assert.equal(folded[0]?.scans, 12)
  assert.equal(folded[0]?.customers, 12)
  assert.equal(anonymousEvents()[0]?.zip3, "821")
})

test("landing pages set one first-party cookie and no tracker scripts", () => {
  const landingFiles = [
    "app/p/[code]/page.tsx",
    "app/p/[code]/book/route.ts",
    "app/p/[code]/call/route.ts",
    "app/layout.tsx",
  ]
  for (const file of landingFiles) {
    const source = readFileSync(join(root, file), "utf8")
    assert.deepEqual(landingMarkupFindings(source), [], file)
    assert.equal(source.includes("set-cookie"), false, file)
    assert.equal(source.includes("document.cookie"), false, file)
  }
  const qr = readFileSync(join(root, "app/q/[code]/route.ts"), "utf8")
  assert.deepEqual(landingMarkupFindings(qr), [])
  assert.equal(qr.match(/set-cookie/gi)?.length, 1)
  assert.match(qr, /VISITOR_COOKIE/)
  assert.doesNotMatch(qr, /Domain=/)
  assert.deepEqual(landingMarkupFindings(`<script src="https://www.googletagmanager.com/gtag/js"></script>`), [
    "googletagmanager.com",
    "script tag",
  ])
})

test("health and medicare fields are rejected on the landing form and in the analytics schema", () => {
  assert.equal(rejectSensitiveFields(["name", "phone", "email", "message", "consent"]), null)
  assert.equal(rejectSensitiveFields(["medicareId"]), "medicareId")
  assert.equal(rejectSensitiveFields(["health_status"]), "health_status")
  const files = ["lib/analytics/privacy.ts", "lib/analytics/store.ts", "app/p/[code]/page.tsx"]
  for (const file of files) {
    assert.deepEqual(sensitiveFieldFindings(readFileSync(join(root, file), "utf8")), [], file)
  }
  assert.doesNotMatch(readFileSync(join(root, "app/p/[code]/page.tsx"), "utf8"), /medicare|medicaid|health status|diagnosis/i)
})

test("the retention job drops old leads and cookie ids and keeps a younger consent record", () => {
  resetAnalytics()
  const qr = ensureCampaignQr({
    campaignId: "camp",
    ownerId: "ada",
    destination: "hosted",
    parts: { form: true },
  })
  logScan({
    code: qr.code,
    device: "phone",
    place: "78701",
    visitor: "old-cookie",
    repeat: false,
    at: "2026-06-01T00:00:00.000Z",
    ip: "203.0.113.4",
  })
  saveLead({
    campaignId: "camp",
    name: "Ada",
    phone: "6195550100",
    email: "ada@example.com",
    message: "Hi",
    visitor: "old-cookie",
    at: "2026-06-01T00:00:00.000Z",
    ip: "203.0.113.4",
  })
  recordConsent({
    at: "2024-06-01T00:00:00.000Z",
    personKey: "old-cookie",
    variant: "call_email",
    page: "/p/abc",
    businessName: "Harbor Roofing",
    now: new Date("2026-11-21T00:00:00.000Z"),
  })
  const result = runRetentionJob(new Date("2028-12-01T00:00:00.000Z"))
  assert.equal(result.personal, 2)
  assert.equal(result.leads, 1)
  assert.equal(result.cookieIds, 1)
  assert.equal(result.consent, 0)
  assert.equal(scansFor("camp")[0]?.visitor, "")
  assert.equal(leadsFor("camp").length, 0)
  assert.equal(personalRecords().length, 0)
  assert.equal(consentRecords().length, 1)
})
