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
}): RecipientCode {
  const code = input.code ?? mintCode()
  const record: RecipientCode = {
    code,
    campaignId: input.campaignId,
    recipientId: input.recipientId,
    destination: input.destination,
    controlGroup: input.controlGroup === true,
    trackingPhone: input.trackingPhone ?? null,
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
  entry: { calls?: number; bookings?: number; revenue?: number; piecesMailed?: number }
): void {
  manual.set(campaignId, { ...manual.get(campaignId), ...entry })
}

export function resultsFor(campaignId: string): ResultsLedger {
  const rows = scans.filter((scan) => scan.campaignId === campaignId)
  const unique = new Set(rows.map((scan) => scan.recipientId))
  const noted = manual.get(campaignId)
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

/** Test helper. */
export function resetTracking(): void {
  codes.clear()
  scans.length = 0
  manual.clear()
}
