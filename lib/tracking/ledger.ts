/**
 * Results a person can read. Counts come only from recorded scans and
 * numbers someone typed. Nothing here is estimated.
 */

export interface RecipientCode {
  code: string
  campaignId: string
  recipientId: string
  destination: string
  /** Reserved for a later holdout test. Unused by the redirect. */
  controlGroup: boolean
  /** Design-only. No phone provider is called. */
  trackingPhone: string | null
  /** Account that issued the code. Empty on older rows. */
  ownerId?: string
}

export interface ScanEvent {
  at: string
  campaignId: string
  recipientId: string
  code: string
}

export interface ResultsLedger {
  campaignId: string
  piecesMailed: number | null
  scans: number | null
  uniqueScanners: number | null
  scanRate: number | null
  calls: number | null
  bookings: number | null
  revenue: number | null
}

const codes = new Map<string, RecipientCode>()
const scans: ScanEvent[] = []
const manual = new Map<string, { calls?: number; bookings?: number; revenue?: number; piecesMailed?: number }>()

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"

function seedFor(campaignId: string, index: number): number {
  let hash = index + 1
  for (const char of campaignId) hash = (hash * 33 + char.charCodeAt(0)) % 1_000_000_000
  return hash / 1_000_000_000 || 0.1
}

function freshCode(seed: number): string {
  let n = seed
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = mintCode(n)
    if (!codes.has(code)) return code
    n = (n + 0.17) % 1 || 0.13
  }
  return mintCode()
}

export function mintCode(seed = Math.random()): string {
  let value = Math.floor(seed * 1_000_000_000)
  let out = ""
  for (let i = 0; i < 7; i += 1) {
    out += ALPHABET[value % ALPHABET.length]
    value = Math.floor(value / ALPHABET.length)
  }
  return out
}

export function issueRecipientCode(input: {
  campaignId: string
  recipientId: string
  destination: string
  controlGroup?: boolean
  trackingPhone?: string | null
  code?: string
  ownerId?: string
}): RecipientCode {
  const code = input.code ?? mintCode()
  const record: RecipientCode = {
    code,
    campaignId: input.campaignId,
    recipientId: input.recipientId,
    destination: input.destination,
    controlGroup: input.controlGroup === true,
    trackingPhone: input.trackingPhone ?? null,
    ownerId: input.ownerId,
  }
  codes.set(code, record)
  return record
}

export function findCode(code: string): RecipientCode | null {
  return codes.get(code) ?? null
}

export function recordScan(code: string, at = new Date().toISOString()): { destination: string; scan: ScanEvent } | null {
  const record = codes.get(code)
  if (!record || record.controlGroup) return null
  const scan: ScanEvent = { at, campaignId: record.campaignId, recipientId: record.recipientId, code }
  scans.push(scan)
  return { destination: record.destination, scan }
}

export function noteResults(
  campaignId: string,
  entry: { calls?: number; bookings?: number; revenue?: number; piecesMailed?: number; ownerId?: string }
): void {
  const key = entry.ownerId ? `${entry.ownerId}:${campaignId}` : campaignId
  const rest = {
    calls: entry.calls,
    bookings: entry.bookings,
    revenue: entry.revenue,
    piecesMailed: entry.piecesMailed,
  }
  manual.set(key, { ...manual.get(key), ...rest })
}

function scanVisible(scan: ScanEvent, ownerId?: string): boolean {
  if (scan.campaignId === "") return false
  const record = codes.get(scan.code)
  if (!record || record.campaignId !== scan.campaignId) return false
  if (ownerId && record.ownerId && record.ownerId !== ownerId) return false
  return true
}

export function resultsFor(campaignId: string, ownerId?: string): ResultsLedger {
  const rows = scans.filter((scan) => scan.campaignId === campaignId && scanVisible(scan, ownerId))
  const unique = new Set(rows.map((scan) => scan.recipientId))
  const noted = manual.get(ownerId ? `${ownerId}:${campaignId}` : campaignId) ?? (ownerId ? undefined : manual.get(campaignId))
  const pieces = noted?.piecesMailed
  const scanCount = rows.length
  return {
    campaignId,
    piecesMailed: pieces ?? null,
    scans: scanCount === 0 && pieces == null ? null : scanCount,
    uniqueScanners: scanCount === 0 && pieces == null ? null : unique.size,
    scanRate: pieces && pieces > 0 ? unique.size / pieces : null,
    calls: noted?.calls ?? null,
    bookings: noted?.bookings ?? null,
    revenue: noted?.revenue ?? null,
  }
}

export function redirectUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/r/${code}`
}

export function codesForCampaign(campaignId: string, ownerId?: string): readonly RecipientCode[] {
  return [...codes.values()].filter((record) => record.campaignId === campaignId && (!ownerId || !record.ownerId || record.ownerId === ownerId))
}

/** One redirect per recipient. A holdout is stored and is not scannable. No call is placed. */
export function assignRecipientCodes(input: {
  campaignId: string
  origin: string
  destination: string
  recipients: { id: string; controlGroup?: boolean }[]
  trackingPhone?: string | null
  ownerId?: string
}): { recipientId: string; url: string; controlGroup: boolean }[] {
  return input.recipients.map((recipient, index) => {
    const record = issueRecipientCode({
      campaignId: input.campaignId,
      recipientId: recipient.id,
      destination: input.destination,
      controlGroup: recipient.controlGroup,
      trackingPhone: input.trackingPhone,
      ownerId: input.ownerId,
      code: freshCode(seedFor(input.campaignId, index)),
    })
    return {
      recipientId: recipient.id,
      url: redirectUrl(input.origin, record.code),
      controlGroup: record.controlGroup,
    }
  })
}

/** Test helper. */
export function resetTracking(): void {
  codes.clear()
  scans.length = 0
  manual.clear()
}
