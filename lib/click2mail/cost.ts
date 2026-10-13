import type { PostcardSize } from "./products"

/**
 * Postcard postage Click2Mail confirmed for the API.
 * Standard First Class 5×8 is $0.495 per address.
 * A nonstandard address is $0.82 plus production.
 * Production is not included in either figure.
 *
 * Change the rates here. Do not paste the amounts into screens or call sites.
 */
export const POSTCARD_5X8_STANDARD_FIRST_CLASS_POSTAGE_DOLLARS = 0.495
export const POSTCARD_NONSTANDARD_FIRST_CLASS_POSTAGE_DOLLARS = 0.82

export interface PostcardPostageRates {
  standardFirstClassDollars: number
  nonstandardFirstClassDollars: number
}

export const POSTCARD_5X8_POSTAGE: PostcardPostageRates = {
  standardFirstClassDollars: POSTCARD_5X8_STANDARD_FIRST_CLASS_POSTAGE_DOLLARS,
  nonstandardFirstClassDollars: POSTCARD_NONSTANDARD_FIRST_CLASS_POSTAGE_DOLLARS,
}

const ENV_STANDARD = "C2M_POSTAGE_5X8_STANDARD"
const ENV_NONSTANDARD = "C2M_POSTAGE_NONSTANDARD"

export function loadPostcardPostage(env: NodeJS.ProcessEnv = process.env): PostcardPostageRates {
  return {
    standardFirstClassDollars: readDollars(
      env[ENV_STANDARD],
      POSTCARD_5X8_STANDARD_FIRST_CLASS_POSTAGE_DOLLARS
    ),
    nonstandardFirstClassDollars: readDollars(
      env[ENV_NONSTANDARD],
      POSTCARD_NONSTANDARD_FIRST_CLASS_POSTAGE_DOLLARS
    ),
  }
}

export function standardPostageDollars(pieceCount: number, rates: PostcardPostageRates = POSTCARD_5X8_POSTAGE): number {
  return roundMilli(pieceCount * rates.standardFirstClassDollars)
}

export interface PostageEstimate {
  /** Dollar figure for standard addresses, or an empty-state prompt. */
  amountLabel: string
  /** What the figure includes, and what a nonstandard address costs. */
  detail: string
}

/**
 * Estimate for the print & mail screen.
 * Every address is priced as standard until Click2Mail standardizes the list.
 * The detail still names the nonstandard rate so that price is not a surprise.
 */
export function postageEstimate(
  pieceCount: number,
  rates: PostcardPostageRates = POSTCARD_5X8_POSTAGE,
  size: PostcardSize = "5x8"
): PostageEstimate {
  if (size !== "5x8") {
    return {
      amountLabel: "—",
      detail: `Click2Mail prices ${size === "6x9" ? "6×9" : size} postage on the job. The confirmed First Class figure of ${formatDollars(rates.standardFirstClassDollars)} is for a standard 5×8 address only.`,
    }
  }
  if (pieceCount <= 0) {
    return {
      amountLabel: "—",
      detail: "Add addresses to estimate postage.",
    }
  }
  const postage = standardPostageDollars(pieceCount, rates)
  const addresses = pieceCount === 1 ? "standard address" : "standard addresses"
  const detail = `Estimated First Class postage for ${pieceCount} ${addresses} on a 5×8 postcard. Production is additional. A nonstandard address is ${formatDollars(rates.nonstandardFirstClassDollars)} plus production.`
  return {
    amountLabel: formatDollars(postage),
    detail,
  }
}

export function postageEstimateLabel(
  pieceCount: number,
  rates: PostcardPostageRates = POSTCARD_5X8_POSTAGE,
  size: PostcardSize = "5x8"
): string {
  const estimate = postageEstimate(pieceCount, rates, size)
  if (pieceCount <= 0) return estimate.detail
  return `${estimate.amountLabel} — ${estimate.detail}`
}

export function formatDollars(amount: number): string {
  const milli = Math.round(amount * 1000)
  const sign = milli < 0 ? "-" : ""
  const abs = Math.abs(milli)
  const dollars = Math.floor(abs / 1000)
  const fraction = abs % 1000
  if (fraction % 10 === 0) {
    return `${sign}$${dollars}.${String(Math.floor(fraction / 10)).padStart(2, "0")}`
  }
  return `${sign}$${dollars}.${String(fraction).padStart(3, "0")}`
}

function roundMilli(amount: number): number {
  return Math.round(amount * 1000) / 1000
}

function readDollars(value: string | undefined, fallback: number): number {
  const trimmed = value?.trim()
  if (!trimmed) return fallback
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}
