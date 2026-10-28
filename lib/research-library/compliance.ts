/**
 * Advertising-compliance rewrites for printed copy (Reg Z trigger terms, FTC "free"
 * guide, warranty wording, and owner-banned claims). Every customer-facing line
 * passes through `compliantLine`; headlines also go through `headlineCompliant`.
 */

const BID_PRICED = /\b(?:roof\w*|shingles?|siding|windows?|re-?roof)\b/i
const FULL_APR = /\bAPR\b[^.]*\b(?:term|months?)\b[^.]*\b(?:down|payment)\b/i

/** Reg Z trigger terms: a monthly payment, a term, or a down payment, without a full APR disclosure. */
export function hasTriggerTerm(text: string): boolean {
  if (FULL_APR.test(text)) return false
  return (
    /\$\s?\d[\d,]*(?:\.\d+)?\s*(?:\/\s*mo\b|a month|per month|monthly)/i.test(text) ||
    /\b\d+\s*(?:-|\s)?months?\b|\bno payments?\b|\bno interest for\b|\b\d+\s*(?:-|\s)?(?:year|yr)s?\s+(?:term|financing|loan)\b/i.test(text) ||
    /\b(?:\$\s?\d[\d,]*|no|zero|\d+%)\s*down\b|\bdown payment\b/i.test(text)
  )
}

/** A rate that does not say APR ("0% financing", "0% interest"). */
function bareRate(text: string): boolean {
  return /\b\d+(?:\.\d+)?%\s*(?:financing|interest|rate)\b/i.test(text) && !/\bAPR\b/i.test(text)
}

function isFinancingLine(text: string): boolean {
  return /\bfinanc\w*|\bpayments?\b|\bmonthly\b|\binterest\b|\bAPR\b|\bdown\b/i.test(text)
}

export function compliantLine(input: string | undefined | null, context = ""): string {
  if (!input) return input ?? ""
  let line = input
  const job = `${line} ${context}`
  // Financing: one allowed line unless the full disclosure is printed.
  if (isFinancingLine(line) && (hasTriggerTerm(line) || bareRate(line))) {
    const rate = line.match(/\b(\d+(?:\.\d+)?)%\s*(?:APR\b)?/i)
    const keepsApr = rate && /\bAPR\b/i.test(line) && !hasTriggerTerm(line)
    const sentence = keepsApr ? `${rate![1]}% APR financing available` : "Financing available"
    line = line
      .split(/(?<=[.!?])\s+/)
      .map((part) => (isFinancingLine(part) && (hasTriggerTerm(part) || bareRate(part)) ? `${sentence}.` : part))
      .join(" ")
      .replace(/\.\.+/g, ".")
    if (!/[.!?]$/.test(input.trim())) line = line.replace(/\.$/, "")
  }
  // FTC free guide: no "free X with purchase" on bid-priced jobs.
  if (BID_PRICED.test(job)) {
    line = line.replace(/\bfree\s+([a-z][a-z -]{1,30}?)\s+with\s+(?:any\s+|every\s+|your\s+|a\s+)?(?:purchase|install\w*|replacement|new [a-z]+)\b/gi, (_m, item: string) => `${item.trim()} included`)
    line = line.replace(/\*+(?=\s|$)/g, "")
  }
  // Warranty and guarantee wording.
  line = line.replace(/\bfixed right or it'?s free\b/gi, "fixed right, or we come back at no charge")
  line = line.replace(/\bor it'?s free\b/gi, "or we come back at no charge")
  line = line.replace(/\blifetime (warranty|guarantee)\b(?!\s+(?:on|for|covering)\b)/gi, "limited lifetime $1 on materials for as long as you own the home")
  line = line.replace(/\b(?:100% )?(?:money[- ]back|satisfaction) guarantee[d]?\b/gi, "full-price refund guarantee")
  // Owner-banned claims.
  line = line
    .replace(/\byou have hail damage!?/gi, "Did it hit your roof?")
    .replace(/\bfree insurance replacement\b/gi, "insurance claim help")
    .replace(/\b(?:no[- ]cost|free) solar\b/gi, "solar")
    .replace(/\s*,?\s*(?:plus |and |with )?(?:the )?(?:\d+% )?federal (?:solar )?tax credits?\b[^.]*\.?/gi, "")
    .replace(/\b(?:cut|slash)\w* (?:your )?(?:\w+ )?bills? in half\b/gi, "lower your energy bills")
  // Water heater line.
  if (/\bwater heater\b/i.test(line) && /\bold\b|\bage\b|\byears?\b/i.test(line) && /\?/.test(line)) {
    line = "Is your water heater more than 10 years old?"
  }
  return line.replace(/\s{2,}/g, " ").trim()
}

/** Headlines carry one service and never financing, terms, or banned claims. */
export function headlineCompliant(headline: string, offer = ""): boolean {
  if (/\bfinanc\w*|\bAPR\b|\bmonthly\b|\bpayments?\b|\b\d+%\s*(?:interest|financing)\b/i.test(headline)) return false
  if (hasTriggerTerm(headline)) return false
  if (/\bfree\b[^.]*\bwith\b[^.]*\bpurchase\b/i.test(headline)) return false
  if (/\bor it'?s free\b|\bmoney[- ]back\b/i.test(headline)) return false
  if (/\blifetime\b/i.test(headline) && !/\blifetime\b\s+(?:\w+\s+)?(?:on|for|covering)\b/i.test(headline)) return false
  const services = ["roof", "gutter", "siding", "window", "solar", "hvac|furnace|air condition|\\bac\\b", "water heater", "plumb|drain|pipe"]
    .filter((s) => new RegExp(s, "i").test(headline))
  if (services.length > 1 && !services.every((s) => new RegExp(s, "i").test(offer))) return false
  return true
}

const SKIP = new Set(["phone", "website", "qrDestination", "visualDirection", "imagePrompt", "layoutHints", "addressSide"])

/** Run every printed string field of a direction's spec through `compliantLine`. */
export function compliantSpec<T extends Record<string, unknown>>(spec: T, context = ""): T {
  const next: Record<string, unknown> = { ...spec }
  for (const [key, value] of Object.entries(spec)) {
    if (SKIP.has(key)) continue
    if (typeof value === "string") next[key] = compliantLine(value, context)
    else if (Array.isArray(value) && value.every((v) => typeof v === "string")) next[key] = value.map((v) => compliantLine(v as string, context))
  }
  return next as T
}
