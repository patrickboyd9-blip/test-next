import type { DeviceKind } from "./read"

/** Draft wording. Change it here when the legal text is final. */
export const PRIVACY_PATH = "/privacy"

export function pageFooterNotice(business: string): string {
  const name = business.trim() || "this business"
  return `This page is provided by Modern Mail on behalf of ${name}. See our Privacy Policy.`
}

export function formConsentLine(business: string): string {
  const name = business.trim() || "this business"
  return `By submitting, you agree ${name} may contact you about your request, and Modern Mail may store this information as described in our Privacy Policy.`
}

/** Months to keep name, phone, email, and IP. The anonymous rollup is kept. */
export function personalRetentionMonths(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.ANALYTICS_PERSONAL_RETENTION_MONTHS ?? "24")
  if (!Number.isFinite(raw) || raw < 1) return 24
  return Math.floor(raw)
}

export type EventKind = "scan" | "call_tap" | "booking_tap" | "lead"

/** No name, phone, email, IP, or visitor id. */
export interface AnonymousEvent {
  id: string
  at: string
  kind: EventKind
  campaignId: string
  industry: string
  zip3: string | null
  device: DeviceKind | "unknown"
  offerType: string
}

export interface PersonalRecord {
  id: string
  eventId: string
  at: string
  personKey: string
  name: string
  phone: string
  email: string
  ip: string
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

const anonymous: AnonymousEvent[] = []
const personal: PersonalRecord[] = []
const rollup = new Map<string, RollupRow>()
let seq = 0

export function resetPrivacyRecords(): void {
  anonymous.length = 0
  personal.length = 0
  rollup.clear()
  seq = 0
}

export function zip3FromPlace(place: string | null): string | null {
  const match = place?.match(/\b(\d{3,5})\b/)
  return match?.[1] ? match[1].slice(0, 3) : null
}

export function recordSeparatedEvent(input: {
  at?: string
  kind: EventKind
  campaignId: string
  industry?: string
  offerType?: string
  place?: string | null
  device?: DeviceKind | "unknown"
  personal?: { personKey?: string; name?: string; phone?: string; email?: string; ip?: string }
  now?: Date
}): { anonymous: AnonymousEvent; personal: PersonalRecord | null } {
  purgeExpiredPersonal(input.now ?? new Date(input.at ?? Date.now()))
  const at = input.at ?? new Date().toISOString()
  const event: AnonymousEvent = {
    id: `a${++seq}`,
    at,
    kind: input.kind,
    campaignId: input.campaignId,
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
    personKey: fields.personKey?.trim() || fields.email?.trim().toLowerCase() || fields.phone?.replace(/\D/g, "") || "",
    name: fields.name?.trim() ?? "",
    phone: fields.phone?.trim() ?? "",
    email: fields.email?.trim().toLowerCase() ?? "",
    ip: fields.ip?.trim() ?? "",
  }
  const cutoff = retentionCutoff(input.now ?? new Date(at), personalRetentionMonths())
  if (row.at < cutoff) return { anonymous: event, personal: null }
  personal.push(row)
  return { anonymous: event, personal: row }
}

function retentionCutoff(now: Date, months: number): string {
  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months)
  return cutoff.toISOString()
}

export function anonymousEvents(): readonly AnonymousEvent[] {
  return anonymous
}

export function personalRecords(): readonly PersonalRecord[] {
  return personal
}

export function rollupRows(): readonly RollupRow[] {
  return [...rollup.values()]
}

/** Removes one person's raw details. The long-term counts stay. */
export function deletePerson(input: { email?: string; phone?: string; visitorId?: string }): number {
  const email = input.email?.trim().toLowerCase() ?? ""
  const phone = input.phone?.replace(/\D/g, "") ?? ""
  const visitor = input.visitorId?.trim() ?? ""
  const before = personal.length
  for (let index = personal.length - 1; index >= 0; index -= 1) {
    const row = personal[index]
    if (!row) continue
    const rowPhone = row.phone.replace(/\D/g, "")
    const hit =
      (email && row.email === email) ||
      (phone && rowPhone && rowPhone === phone) ||
      (visitor && row.personKey === visitor)
    if (hit) personal.splice(index, 1)
  }
  return before - personal.length
}

export function purgeExpiredPersonal(now = new Date(), env: NodeJS.ProcessEnv = process.env): number {
  const limit = retentionCutoff(now, personalRetentionMonths(env))
  const before = personal.length
  for (let index = personal.length - 1; index >= 0; index -= 1) {
    const row = personal[index]
    if (row && row.at < limit) personal.splice(index, 1)
  }
  return before - personal.length
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
