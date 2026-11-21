import { createHash } from "node:crypto"

import { VISITOR_COOKIE, type DeviceKind } from "./read"

/** Draft wording. Change it here when the legal text is final. */
export const PRIVACY_PATH = "/privacy"

/** The only cookie a QR landing page may set. It is first-party. */
export const LANDING_COOKIE = VISITOR_COOKIE

export const BENCHMARK_MIN_SCANS = 10
export const BENCHMARK_MIN_CUSTOMERS = 5
export const CATCH_ALL_ZIP3 = "other"
export const ZIP3_POPULATION_LIMIT = 20_000

/**
 * DRAFT placeholder. TODO: replace with a Census table of 3-digit ZIP
 * populations before a real comparison relies on this list. Prefixes here are
 * treated as population <= 20,000 and fold into the catch-all bucket.
 */
export const SMALL_ZIP3_PLACEHOLDER = ["036", "059", "821", "884"] as const

const TRACKER_MARKERS = [
  "googletagmanager.com",
  "google-analytics.com",
  "gtag(",
  "fbq(",
  "connect.facebook.net",
  "hotjar",
  "fullstory",
  "logrocket",
  "mouseflow",
  "clarity.ms",
  "segment.com",
  "mixpanel",
  "doubleclick.net",
  "snap.licdn.com",
  "analytics.tiktok.com",
  "ct.pinterest.com",
  "session-replay",
  "js.hs-scripts.com",
]

const SENSITIVE_FIELD = /medicare|medicaid|health|diagnos|prescription|hipaa|\bphi\b|\bssn\b|social.?security|date.?of.?birth|\bdob\b|icd-?10|medical/i

export function pageFooterNotice(business: string): string {
  const name = business.trim() || "this business"
  return `DRAFT. This page is provided by Modern Mail on behalf of ${name}. See our Privacy Policy.`
}

export type ConsentVariant = "call_text" | "email" | "call_email" | "general"

export function consentVariantFor(input: { phone: boolean; email: boolean }): ConsentVariant {
  if (input.phone && input.email) return "call_email"
  if (input.phone) return "call_text"
  if (input.email) return "email"
  return "general"
}

/** Single-seller line. The customer's business is the only party that may make contact. */
export function formConsentLine(business: string, variant: ConsentVariant = "general"): string {
  const name = business.trim() || "this business"
  const permission = {
    call_text: `${name} may call or text you about this request`,
    email: `${name} may email you about this request`,
    call_email: `${name} may call, text, or email you about this request`,
    general: `${name} may contact you about this request`,
  }[variant]
  return `DRAFT. By submitting, you agree ${permission}. ${name} is the only business that may contact you. See our Privacy Policy.`
}

/** Months to keep hashed phone, hashed email, IP, and cookie id. Consent is kept for 5 years. */
export function personalRetentionMonths(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.ANALYTICS_PERSONAL_RETENTION_MONTHS ?? "24")
  if (!Number.isFinite(raw) || raw < 1) return 24
  return Math.floor(raw)
}

export function consentRetentionYears(): number {
  return 5
}

export function emailHash(email: string): string {
  const normalized = email.trim().toLowerCase()
  return normalized ? sha256(normalized) : ""
}

export function phoneHash(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits ? sha256(digits) : ""
}

export function personKeyFor(input: { personKey?: string; email?: string; phone?: string }): string {
  const explicit = input.personKey?.trim() ?? ""
  if (explicit) return explicit
  return emailHash(input.email ?? "") || phoneHash(input.phone ?? "") || ""
}

export type EventKind = "scan" | "call_tap" | "booking_tap" | "lead"

/** No name, phone, email, IP, or visitor id. */
export interface AnonymousEvent {
  id: string
  at: string
  kind: EventKind
  campaignId: string
  customerId: string
  industry: string
  zip3: string | null
  device: DeviceKind | "unknown"
  offerType: string
}

/** Hashed contact details, the IP, and the cookie id. These are personal data. */
export interface PersonalRecord {
  id: string
  eventId: string
  at: string
  personKey: string
  name: string
  phoneHash: string
  emailHash: string
  ip: string
}

export interface ConsentRecord {
  id: string
  at: string
  personKey: string
  variant: ConsentVariant
  page: string
  businessName: string
  wording: string
}

export interface OptOutRecord {
  id: string
  at: string
  personKey: string
  emailHash: string
  phoneHash: string
  page: string
}

export interface RollupRow {
  day: string
  kind: EventKind
  industry: string
  zip3: string
  device: string
  offerType: string
  count: number
}

export interface BenchmarkGroup {
  industry: string
  zip3: string
  scans: number
  customers: number
}

const anonymous: AnonymousEvent[] = []
const personal: PersonalRecord[] = []
const consent: ConsentRecord[] = []
const optOuts: OptOutRecord[] = []
const rollup = new Map<string, RollupRow>()
let seq = 0

export function resetPrivacyRecords(): void {
  anonymous.length = 0
  personal.length = 0
  consent.length = 0
  optOuts.length = 0
  rollup.clear()
  seq = 0
}

export function zip3FromPlace(place: string | null): string | null {
  const match = place?.match(/\b(\d{3,5})\b/)
  return match?.[1] ? match[1].slice(0, 3) : null
}

export function benchmarkZip3(zip3: string | null): string {
  if (!zip3) return CATCH_ALL_ZIP3
  if ((SMALL_ZIP3_PLACEHOLDER as readonly string[]).includes(zip3)) return CATCH_ALL_ZIP3
  return zip3
}

export function recordSeparatedEvent(input: {
  at?: string
  kind: EventKind
  campaignId: string
  customerId?: string
  industry?: string
  offerType?: string
  place?: string | null
  device?: DeviceKind | "unknown"
  personal?: { personKey?: string; name?: string; phone?: string; email?: string; ip?: string }
  now?: Date
}): { anonymous: AnonymousEvent; personal: PersonalRecord | null } {
  const now = input.now ?? new Date(input.at ?? Date.now())
  purgeExpiredPersonal(now)
  const at = input.at ?? new Date().toISOString()
  const event: AnonymousEvent = {
    id: `a${++seq}`,
    at,
    kind: input.kind,
    campaignId: input.campaignId,
    customerId: input.customerId?.trim() || "",
    industry: input.industry?.trim() || "unspecified",
    zip3: zip3FromPlace(input.place ?? null),
    device: input.device ?? "unknown",
    offerType: input.offerType?.trim() || "unspecified",
  }
  anonymous.push(event)
  addRollup(event)
  const fields = input.personal
  const hasPersonal = Boolean(fields && (fields.personKey || fields.name || fields.phone || fields.email || fields.ip))
  if (!hasPersonal || !fields) return { anonymous: event, personal: null }
  const row: PersonalRecord = {
    id: `p${seq}`,
    eventId: event.id,
    at,
    personKey: personKeyFor(fields),
    name: fields.name?.trim() ?? "",
    phoneHash: phoneHash(fields.phone ?? ""),
    emailHash: emailHash(fields.email ?? ""),
    ip: fields.ip?.trim() ?? "",
  }
  if (row.at < personalRetentionCutoff(now)) return { anonymous: event, personal: null }
  personal.push(row)
  return { anonymous: event, personal: row }
}

export function recordConsent(input: {
  at?: string
  personKey?: string
  email?: string
  phone?: string
  variant: ConsentVariant
  page: string
  businessName: string
  wording?: string
  now?: Date
}): ConsentRecord | null {
  const now = input.now ?? new Date(input.at ?? Date.now())
  const at = input.at ?? now.toISOString()
  if (at < consentCutoff(now)) return null
  const businessName = input.businessName.trim() || "this business"
  const variant = input.variant
  const row: ConsentRecord = {
    id: `c${++seq}`,
    at,
    personKey: personKeyFor(input),
    variant,
    page: input.page.trim() || "/",
    businessName,
    wording: input.wording?.trim() || formConsentLine(businessName, variant),
  }
  consent.push(row)
  return row
}

export function recordOptOut(input: {
  at?: string
  personKey?: string
  email?: string
  phone?: string
  page: string
}): OptOutRecord | null {
  const email = emailHash(input.email ?? "")
  const phone = phoneHash(input.phone ?? "")
  const personKey = personKeyFor(input)
  if (!personKey && !email && !phone) return null
  const row: OptOutRecord = {
    id: `o${++seq}`,
    at: input.at ?? new Date().toISOString(),
    personKey,
    emailHash: email,
    phoneHash: phone,
    page: input.page.trim() || "/",
  }
  optOuts.push(row)
  return row
}

export function isOptedOut(input: { personKey?: string; email?: string; phone?: string }): boolean {
  const personKey = input.personKey?.trim() ?? ""
  const email = emailHash(input.email ?? "")
  const phone = phoneHash(input.phone ?? "")
  if (!personKey && !email && !phone) return false
  return optOuts.some(
    (row) =>
      (personKey && row.personKey === personKey) ||
      (email && row.emailHash === email) ||
      (phone && row.phoneHash === phone)
  )
}

export function excludeOptedOut<T extends { personKey?: string; email?: string; phone?: string }>(rows: readonly T[]): T[] {
  return rows.filter((row) => !isOptedOut(row))
}

function retentionCutoff(now: Date, months: number): string {
  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months)
  return cutoff.toISOString()
}

function consentCutoff(now: Date): string {
  const cutoff = new Date(now)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - consentRetentionYears())
  return cutoff.toISOString()
}

export function personalRetentionCutoff(now = new Date(), env: NodeJS.ProcessEnv = process.env): string {
  return retentionCutoff(now, personalRetentionMonths(env))
}

export function anonymousEvents(): readonly AnonymousEvent[] {
  return anonymous
}

export function personalRecords(): readonly PersonalRecord[] {
  return personal
}

export function consentRecords(): readonly ConsentRecord[] {
  return consent
}

export function optOutRecords(): readonly OptOutRecord[] {
  return optOuts
}

export function rollupRows(): readonly RollupRow[] {
  return [...rollup.values()]
}

/** Removes every personal analytics row tied to this person. Consent and opt-out stay. */
export function deletePerson(input: { email?: string; phone?: string; visitorId?: string; personKey?: string }): number {
  const email = emailHash(input.email ?? "")
  const phone = phoneHash(input.phone ?? "")
  const keys = new Set<string>()
  const explicit = input.personKey?.trim() || input.visitorId?.trim() || ""
  if (explicit) keys.add(explicit)
  if (!email && !phone && keys.size === 0) return 0
  for (const row of personal) {
    if ((email && row.emailHash === email) || (phone && row.phoneHash === phone) || (row.personKey && keys.has(row.personKey))) {
      if (row.personKey) keys.add(row.personKey)
    }
  }
  const before = personal.length
  for (let index = personal.length - 1; index >= 0; index -= 1) {
    const row = personal[index]
    if (!row) continue
    const hit =
      (row.personKey && keys.has(row.personKey)) ||
      (email && row.emailHash === email) ||
      (phone && row.phoneHash === phone)
    if (hit) personal.splice(index, 1)
  }
  return before - personal.length
}

/** Deletes hashed contact details, IPs, and cookie ids older than 24 months. Consent is exempt. */
export function purgeExpiredPersonal(now = new Date(), env: NodeJS.ProcessEnv = process.env): number {
  const limit = personalRetentionCutoff(now, env)
  const before = personal.length
  for (let index = personal.length - 1; index >= 0; index -= 1) {
    const row = personal[index]
    if (row && row.at < limit) personal.splice(index, 1)
  }
  for (const row of optOuts) {
    if (row.at < limit) row.personKey = ""
  }
  return before - personal.length
}

/** Deletes consent records older than 5 years. The 24-month purge does not call this. */
export function purgeExpiredConsent(now = new Date()): number {
  const limit = consentCutoff(now)
  const before = consent.length
  for (let index = consent.length - 1; index >= 0; index -= 1) {
    const row = consent[index]
    if (row && row.at < limit) consent.splice(index, 1)
  }
  return before - consent.length
}

export function crossCustomerBenchmarks(events: readonly AnonymousEvent[] = anonymous): BenchmarkGroup[] {
  const groups = new Map<string, { industry: string; zip3: string; scans: number; customers: Set<string> }>()
  for (const event of events) {
    if (event.kind !== "scan") continue
    const zip3 = benchmarkZip3(event.zip3)
    const industry = event.industry || "unspecified"
    const key = `${industry}|${zip3}`
    const group = groups.get(key) ?? { industry, zip3, scans: 0, customers: new Set<string>() }
    group.scans += 1
    if (event.customerId) group.customers.add(event.customerId)
    groups.set(key, group)
  }
  return [...groups.values()]
    .filter((group) => group.scans >= BENCHMARK_MIN_SCANS && group.customers.size >= BENCHMARK_MIN_CUSTOMERS)
    .map((group) => ({
      industry: group.industry,
      zip3: group.zip3,
      scans: group.scans,
      customers: group.customers.size,
    }))
    .sort((a, b) => a.industry.localeCompare(b.industry) || a.zip3.localeCompare(b.zip3))
}

export function sensitiveFieldName(name: string): boolean {
  return SENSITIVE_FIELD.test(name.replace(/[_-]+/g, " "))
}

export function rejectSensitiveFields(names: readonly string[]): string | null {
  for (const name of names) {
    if (sensitiveFieldName(name)) return name
  }
  return null
}

/** Field names on a landing form, plus 2-space schema properties in the analytics source. */
export function sensitiveFieldFindings(source: string): string[] {
  const found = new Set<string>()
  for (const match of source.matchAll(/name=["']([^"']+)["']/g)) {
    if (match[1] && sensitiveFieldName(match[1])) found.add(match[1])
  }
  for (const match of source.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9_]*)\??:/gm)) {
    if (match[1] && sensitiveFieldName(match[1])) found.add(match[1])
  }
  return [...found]
}

export function landingMarkupFindings(source: string): string[] {
  const findings: string[] = []
  const lower = source.toLowerCase()
  for (const marker of TRACKER_MARKERS) {
    if (lower.includes(marker)) findings.push(marker)
  }
  if (/<script\b/i.test(source)) findings.push("script tag")
  if (/<iframe\b/i.test(source)) findings.push("iframe")
  if (/next\/script/.test(source)) findings.push("next/script")
  return findings
}

function addRollup(event: AnonymousEvent): void {
  const key = [event.at.slice(0, 10), event.kind, event.industry, event.zip3 ?? "", event.device, event.offerType].join("|")
  const existing = rollup.get(key)
  if (existing) {
    existing.count += 1
    return
  }
  rollup.set(key, {
    day: event.at.slice(0, 10),
    kind: event.kind,
    industry: event.industry,
    zip3: event.zip3 ?? "",
    device: event.device,
    offerType: event.offerType,
    count: 1,
  })
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}
