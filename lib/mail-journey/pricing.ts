/**
 * A customer total exists only when an approved schedule is supplied.
 * This module has no retail rate of its own.
 */
export interface ApprovedPriceSchedule {
  id: string
  status: "approved"
  currency: "usd"
  perPieceCents: number
  termsVersion: string
  effectiveUntil: string
}

export interface CustomerQuote {
  scheduleId: string
  currency: "usd"
  perPieceCents: number
  pieceCount: number
  totalCents: number
  termsVersion: string
  expiresAt: string
}

export type QuoteResult = { ok: true; quote: CustomerQuote } | { ok: false; code: "unconfigured" | "expired" | "count"; message: string }

export const PRICE_UNCONFIGURED_MESSAGE =
  "Checkout is blocked because no approved price is configured. Nothing is charged and nothing is mailed."

export function readApprovedSchedule(env: NodeJS.ProcessEnv = process.env): ApprovedPriceSchedule | null {
  const raw = env.MAIL_APPROVED_PRICE_JSON
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ApprovedPriceSchedule>
    if (parsed.status !== "approved") return null
    if (parsed.currency !== "usd") return null
    if (typeof parsed.id !== "string" || parsed.id.trim() === "") return null
    if (!Number.isInteger(parsed.perPieceCents) || (parsed.perPieceCents ?? 0) <= 0) return null
    if (typeof parsed.termsVersion !== "string" || parsed.termsVersion.trim() === "") return null
    if (typeof parsed.effectiveUntil !== "string" || Number.isNaN(Date.parse(parsed.effectiveUntil))) return null
    return {
      id: parsed.id,
      status: "approved",
      currency: "usd",
      perPieceCents: parsed.perPieceCents as number,
      termsVersion: parsed.termsVersion,
      effectiveUntil: parsed.effectiveUntil,
    }
  } catch {
    return null
  }
}

export function buildQuote(
  schedule: ApprovedPriceSchedule | null,
  pieceCount: number,
  nowIso: string
): QuoteResult {
  if (!schedule) return { ok: false, code: "unconfigured", message: PRICE_UNCONFIGURED_MESSAGE }
  if (pieceCount <= 0) {
    return { ok: false, code: "count", message: "Accept at least one address before a total can be shown." }
  }
  const now = Date.parse(nowIso)
  const until = Date.parse(schedule.effectiveUntil)
  if (Number.isNaN(now) || Number.isNaN(until) || until <= now) {
    return {
      ok: false,
      code: "expired",
      message: "The approved price expired. Checkout stays closed until a new price is approved.",
    }
  }
  return {
    ok: true,
    quote: {
      scheduleId: schedule.id,
      currency: schedule.currency,
      perPieceCents: schedule.perPieceCents,
      pieceCount,
      totalCents: schedule.perPieceCents * pieceCount,
      termsVersion: schedule.termsVersion,
      expiresAt: schedule.effectiveUntil,
    },
  }
}
