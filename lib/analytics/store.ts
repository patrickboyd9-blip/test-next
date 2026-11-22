import { randomBytes } from "node:crypto"

import {
  deletePerson as deletePersonalRows,
  emailHash,
  isOptedOut,
  personalRecords,
  personalRetentionCutoff,
  personKeyFor,
  phoneHash,
  purgeExpiredConsent,
  purgeExpiredPersonal,
  recordSeparatedEvent,
  resetPrivacyRecords,
} from "./privacy"
import type { DeviceKind } from "./read"

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"

export type QrDestination = "hosted" | "website"

export interface PageParts {
  /** Off unless the customer turns it on. */
  call: boolean
  form: boolean
  booking: boolean
  bookingUrl: string | null
}

export interface CampaignQr {
  code: string
  campaignId: string
  ownerId: string
  /** Null on a campaign code. Set when a later per-address code is issued. */
  recipientId: string | null
  destination: QrDestination
  website: string | null
  phone: string
  headline: string
  offer: string
  businessName: string
  /** Coarse label only. Not the offer sentence. */
  offerType: string
  industry: string
  parts: PageParts
}

export interface ScanLog {
  at: string
  code: string
  campaignId: string
  recipientId: string | null
  device: DeviceKind
  place: string | null
  visitor: string
  repeat: boolean
}

export interface LeadRecord {
  id: string
  at: string
  campaignId: string
  name: string
  phone: string
  email: string
  message: string
  personKey: string
}

export interface CheckIn {
  campaignId: string
  jobs: number
  revenueCents: number
}

interface Tap {
  at: string
  campaignId: string
  kind: "call" | "booking"
}

const qrs = new Map<string, CampaignQr>()
const scans: ScanLog[] = []
const taps: Tap[] = []
const leads: LeadRecord[] = []
const checks = new Map<string, CheckIn>()
const mailed = new Map<string, string[]>()
const lastMatch = new Map<string, string>()

export function resetAnalytics(): void {
  qrs.clear()
  scans.length = 0
  taps.length = 0
  leads.length = 0
  checks.clear()
  mailed.clear()
  lastMatch.clear()
  resetPrivacyRecords()
}

const EMPTY_PARTS: PageParts = { call: false, form: false, booking: false, bookingUrl: null }

export function ensureCampaignQr(input: {
  campaignId: string
  ownerId: string
  destination: QrDestination
  website?: string | null
  phone?: string
  headline?: string
  offer?: string
  businessName?: string
  offerType?: string
  industry?: string
  parts?: Partial<PageParts>
}): CampaignQr {
  const existing = [...qrs.values()].find((row) => row.campaignId === input.campaignId && row.recipientId == null)
  const website = cleanWebsite(input.website)
  const prior = existing?.parts ?? EMPTY_PARTS
  const parts = normalizeParts({ ...prior, ...input.parts })
  const next: CampaignQr = {
    code: existing?.code ?? mintCode(),
    campaignId: input.campaignId,
    ownerId: input.ownerId,
    recipientId: null,
    destination: input.destination === "website" && website ? "website" : "hosted",
    website,
    phone: (input.phone ?? existing?.phone ?? "").trim(),
    headline: (input.headline ?? existing?.headline ?? "").trim(),
    offer: (input.offer ?? existing?.offer ?? "").trim(),
    businessName: (input.businessName ?? existing?.businessName ?? "").trim(),
    offerType: (input.offerType ?? existing?.offerType ?? "unspecified").trim() || "unspecified",
    industry: (input.industry ?? existing?.industry ?? "unspecified").trim() || "unspecified",
    parts,
  }
  qrs.set(next.code, next)
  return next
}

export function findQr(code: string): CampaignQr | null {
  return qrs.get(code) ?? null
}

const PLACED_CODE = /^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/

/** Keeps a requested code when it is free. Otherwise mints a new one. */
export function availablePlacedCode(preferred: string): string {
  if (PLACED_CODE.test(preferred) && !qrs.has(preferred)) return preferred
  return mintCode()
}

/**
 * Saves one placed code on a campaign. A campaign can hold two of these.
 * The original one-code helper still updates only the first.
 */
export function upsertPlacedQr(input: {
  code?: string
  campaignId: string
  ownerId: string
  destination: QrDestination
  website?: string | null
  phone?: string
  headline?: string
  offer?: string
  businessName?: string
  offerType?: string
  industry?: string
  parts?: Partial<PageParts>
}): CampaignQr | null {
  const owned = [...qrs.values()].filter((row) => row.campaignId === input.campaignId && row.recipientId == null)
  const requested = input.code && PLACED_CODE.test(input.code) ? input.code : ""
  const existing = requested ? qrs.get(requested) : undefined
  if (existing && (existing.campaignId !== input.campaignId || existing.recipientId != null)) return null
  if (!existing && owned.length >= 2) return null
  const website = cleanWebsite(input.website)
  const prior = existing?.parts ?? EMPTY_PARTS
  const parts = normalizeParts({ ...prior, ...input.parts })
  const next: CampaignQr = {
    code: existing?.code ?? (requested || mintCode()),
    campaignId: input.campaignId,
    ownerId: input.ownerId,
    recipientId: null,
    destination: input.destination === "website" && website ? "website" : "hosted",
    website,
    phone: (input.phone ?? existing?.phone ?? "").trim(),
    headline: (input.headline ?? existing?.headline ?? "").trim(),
    offer: (input.offer ?? existing?.offer ?? "").trim(),
    businessName: (input.businessName ?? existing?.businessName ?? "").trim(),
    offerType: (input.offerType ?? existing?.offerType ?? "unspecified").trim() || "unspecified",
    industry: (input.industry ?? existing?.industry ?? "unspecified").trim() || "unspecified",
    parts,
  }
  qrs.set(next.code, next)
  return next
}

export function qrForCampaign(campaignId: string): CampaignQr | null {
  return [...qrs.values()].find((row) => row.campaignId === campaignId && row.recipientId == null) ?? null
}

/** Reserved for a later unique code per mailed address. The print file does not use this yet. */
export function issueRecipientQr(campaignId: string, recipientId: string): CampaignQr | null {
  const base = qrForCampaign(campaignId)
  if (!base || !recipientId.trim()) return null
  const row: CampaignQr = { ...base, code: mintCode(), recipientId: recipientId.trim() }
  qrs.set(row.code, row)
  return row
}

export function forwardTarget(qr: CampaignQr, origin: string): string {
  if (qr.destination === "website" && qr.website) return qr.website
  return `${origin.replace(/\/$/, "")}/p/${qr.code}`
}

export function logScan(input: Omit<ScanLog, "at" | "campaignId" | "recipientId"> & { at?: string; ip?: string }): ScanLog | null {
  const qr = qrs.get(input.code)
  if (!qr) return null
  const scan: ScanLog = {
    at: input.at ?? new Date().toISOString(),
    code: qr.code,
    campaignId: qr.campaignId,
    recipientId: qr.recipientId,
    device: input.device,
    place: null,
    visitor: input.visitor,
    repeat: input.repeat,
  }
  scans.push(scan)
  recordSeparatedEvent({
    at: scan.at,
    kind: "scan",
    campaignId: qr.campaignId,
    customerId: qr.ownerId,
    industry: qr.industry,
    offerType: qr.offerType,
    place: input.place,
    device: input.device,
    personal: { personKey: input.visitor, ip: input.ip },
  })
  runRetentionJob()
  return scan
}

export function scansFor(campaignId: string): ScanLog[] {
  return scans.filter((row) => row.campaignId === campaignId)
}

export function allScans(): readonly ScanLog[] {
  return scans
}

export function logTap(code: string, kind: "call" | "booking", at = new Date().toISOString(), personal?: { visitor?: string; ip?: string }): boolean {
  const qr = qrs.get(code)
  if (!qr) return false
  if (kind === "call" && (!qr.parts.call || !qr.phone)) return false
  if (kind === "booking" && (!qr.parts.booking || !qr.parts.bookingUrl)) return false
  taps.push({ at, campaignId: qr.campaignId, kind })
  recordSeparatedEvent({
    at,
    kind: kind === "call" ? "call_tap" : "booking_tap",
    campaignId: qr.campaignId,
    customerId: qr.ownerId,
    industry: qr.industry,
    offerType: qr.offerType,
    personal: { personKey: personal?.visitor, ip: personal?.ip },
  })
  runRetentionJob()
  return true
}

export function tapsFor(campaignId: string, kind: "call" | "booking"): number {
  return taps.filter((row) => row.campaignId === campaignId && row.kind === kind).length
}

export function usesAction(campaignIds: readonly string[], action: "call" | "form" | "booking"): boolean {
  const ids = new Set(campaignIds)
  return [...qrs.values()].some(
    (row) => ids.has(row.campaignId) && row.recipientId == null && row.destination === "hosted" && row.parts[action]
  )
}

export function activityFor(campaignIds: readonly string[]): {
  scans: ScanLog[]
  callTaps: number | null
  bookingTaps: number | null
  leads: number | null
} {
  const ids = new Set(campaignIds)
  return {
    scans: scans.filter((row) => ids.has(row.campaignId)),
    callTaps: usesAction(campaignIds, "call")
      ? taps.filter((row) => ids.has(row.campaignId) && row.kind === "call").length
      : null,
    bookingTaps: usesAction(campaignIds, "booking")
      ? taps.filter((row) => ids.has(row.campaignId) && row.kind === "booking").length
      : null,
    leads: usesAction(campaignIds, "form")
      ? leads.filter((row) => ids.has(row.campaignId)).length
      : null,
  }
}

export function saveLead(input: Omit<LeadRecord, "id" | "at" | "personKey"> & { at?: string; ip?: string; visitor?: string }): LeadRecord | null {
  const qr = [...qrs.values()].find((row) => row.campaignId === input.campaignId && row.recipientId == null)
  if (!qr?.parts.form) return null
  const name = input.name.trim()
  if (name.length < 2) return null
  const personKey = personKeyFor({ personKey: input.visitor, email: input.email, phone: input.phone })
  const lead: LeadRecord = {
    id: mintCode(),
    at: input.at ?? new Date().toISOString(),
    campaignId: input.campaignId,
    name,
    phone: input.phone.trim(),
    email: input.email.trim(),
    message: input.message.trim().slice(0, 1000),
    personKey,
  }
  leads.push(lead)
  recordSeparatedEvent({
    at: lead.at,
    kind: "lead",
    campaignId: qr.campaignId,
    customerId: qr.ownerId,
    industry: qr.industry,
    offerType: qr.offerType,
    personal: { name: lead.name, phone: lead.phone, email: lead.email, ip: input.ip, personKey },
  })
  runRetentionJob()
  return lead
}

/** People who asked not to be contacted are left off this list. */
export function followUpLeads(campaignId: string): LeadRecord[] {
  return leads.filter(
    (row) =>
      row.campaignId === campaignId &&
      !isOptedOut({ personKey: row.personKey, email: row.email, phone: row.phone })
  )
}

/** 24-month purge for personal analytics, plus the separate 5-year consent purge. */
export function runRetentionJob(now = new Date()): { personal: number; leads: number; cookieIds: number; consent: number } {
  const cutoff = personalRetentionCutoff(now)
  const personalRemoved = purgeExpiredPersonal(now)
  const consentRemoved = purgeExpiredConsent(now)
  let leadsRemoved = 0
  for (let index = leads.length - 1; index >= 0; index -= 1) {
    const lead = leads[index]
    if (lead && lead.at < cutoff) {
      leads.splice(index, 1)
      leadsRemoved += 1
    }
  }
  let cookieIds = 0
  for (const scan of scans) {
    if (scan.at < cutoff && scan.visitor) {
      scan.visitor = ""
      cookieIds += 1
    }
  }
  return { personal: personalRemoved, leads: leadsRemoved, cookieIds, consent: consentRemoved }
}

export function deleteAnalyticsPerson(input: { email?: string; phone?: string; visitorId?: string; personKey?: string }): number {
  const email = input.email?.trim().toLowerCase() ?? ""
  const phone = input.phone?.replace(/\D/g, "") ?? ""
  const keys = new Set<string>()
  const explicit = input.personKey?.trim() || input.visitorId?.trim() || ""
  if (explicit) keys.add(explicit)
  for (const row of personalRecords()) {
    const emailHit = Boolean(email && row.emailHash === emailHash(email))
    const phoneHit = Boolean(phone && row.phoneHash === phoneHash(phone))
    const keyHit = Boolean(row.personKey && keys.has(row.personKey))
    if ((emailHit || phoneHit || keyHit) && row.personKey) keys.add(row.personKey)
  }
  const removed = deletePersonalRows(input)
  for (let index = leads.length - 1; index >= 0; index -= 1) {
    const lead = leads[index]
    if (!lead) continue
    const leadPhone = lead.phone.replace(/\D/g, "")
    if (
      (email && lead.email.toLowerCase() === email) ||
      (phone && leadPhone && leadPhone === phone) ||
      (lead.personKey && keys.has(lead.personKey))
    ) {
      leads.splice(index, 1)
    }
  }
  for (const scan of scans) {
    if (scan.visitor && keys.has(scan.visitor)) scan.visitor = ""
  }
  return removed
}

export function leadsFor(campaignId: string): LeadRecord[] {
  return leads.filter((row) => row.campaignId === campaignId)
}

export function saveMailedAddresses(campaignId: string, streets: string[]): void {
  mailed.set(campaignId, streets.map((line) => line.trim()).filter(Boolean))
}

export function mailedAddresses(campaignId: string): string[] {
  return mailed.get(campaignId) ?? []
}

export function rememberMatch(campaignId: string, sentence: string): void {
  lastMatch.set(campaignId, sentence)
}

export function matchSentence(campaignId: string): string | null {
  return lastMatch.get(campaignId) ?? null
}

export function saveCheckIn(campaignId: string, jobs: number, revenueCents: number): CheckIn {
  const row = { campaignId, jobs: Math.max(0, Math.floor(jobs)), revenueCents: Math.max(0, Math.floor(revenueCents)) }
  checks.set(campaignId, row)
  return row
}

export function checkInFor(campaignId: string): CheckIn | null {
  return checks.get(campaignId) ?? null
}

function normalizeParts(parts: PageParts): PageParts {
  const bookingUrl = cleanWebsite(parts.bookingUrl)
  return {
    call: parts.call === true,
    form: parts.form === true,
    booking: parts.booking === true && Boolean(bookingUrl),
    bookingUrl,
  }
}

/** Classifies a booking link. The landing page links out and does not embed it. */
export function bookingPresentation(url: string): "calendly" | "button" {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host === "calendly.com" || host.endsWith(".calendly.com")) return "calendly"
  } catch {
    return "button"
  }
  return "button"
}

function cleanWebsite(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  if (!/^https:\/\/[^\s]+$/i.test(trimmed)) return null
  return trimmed
}

function mintCode(): string {
  const bytes = randomBytes(8)
  let out = ""
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length]
  return out
}
