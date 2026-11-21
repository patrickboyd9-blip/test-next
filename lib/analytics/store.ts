import { randomBytes } from "node:crypto"

import type { DeviceKind } from "./read"

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"

export type QrDestination = "hosted" | "website"

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
}

export interface CheckIn {
  campaignId: string
  jobs: number
  revenueCents: number
}

interface Tap {
  at: string
  campaignId: string
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
}

export function ensureCampaignQr(input: {
  campaignId: string
  ownerId: string
  destination: QrDestination
  website?: string | null
  phone?: string
  headline?: string
  offer?: string
}): CampaignQr {
  const existing = [...qrs.values()].find((row) => row.campaignId === input.campaignId && row.recipientId == null)
  const website = cleanWebsite(input.website)
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
  }
  qrs.set(next.code, next)
  return next
}

export function findQr(code: string): CampaignQr | null {
  return qrs.get(code) ?? null
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

export function logScan(input: Omit<ScanLog, "at" | "campaignId" | "recipientId"> & { at?: string }): ScanLog | null {
  const qr = qrs.get(input.code)
  if (!qr) return null
  const scan: ScanLog = {
    at: input.at ?? new Date().toISOString(),
    code: qr.code,
    campaignId: qr.campaignId,
    recipientId: qr.recipientId,
    device: input.device,
    place: input.place,
    visitor: input.visitor,
    repeat: input.repeat,
  }
  scans.push(scan)
  return scan
}

export function scansFor(campaignId: string): ScanLog[] {
  return scans.filter((row) => row.campaignId === campaignId)
}

export function allScans(): readonly ScanLog[] {
  return scans
}

export function logTap(code: string, at = new Date().toISOString()): boolean {
  const qr = qrs.get(code)
  if (!qr || !qr.phone) return false
  taps.push({ at, campaignId: qr.campaignId })
  return true
}

export function tapsFor(campaignId: string): number {
  return taps.filter((row) => row.campaignId === campaignId).length
}

export function activityFor(campaignIds: readonly string[]): { scans: ScanLog[]; taps: number; leads: number } {
  const ids = new Set(campaignIds)
  return {
    scans: scans.filter((row) => ids.has(row.campaignId)),
    taps: taps.filter((row) => ids.has(row.campaignId)).length,
    leads: leads.filter((row) => ids.has(row.campaignId)).length,
  }
}

export function saveLead(input: Omit<LeadRecord, "id" | "at"> & { at?: string }): LeadRecord | null {
  const qr = [...qrs.values()].find((row) => row.campaignId === input.campaignId)
  if (!qr) return null
  const name = input.name.trim()
  if (name.length < 2) return null
  const lead: LeadRecord = {
    id: mintCode(),
    at: input.at ?? new Date().toISOString(),
    campaignId: input.campaignId,
    name,
    phone: input.phone.trim(),
    email: input.email.trim(),
    message: input.message.trim().slice(0, 1000),
  }
  leads.push(lead)
  return lead
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
