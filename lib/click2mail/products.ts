import { Click2MailError } from "./errors"
import type { Click2MailProductOptions } from "./config"

/**
 * Mailed postcard sizes we submit.
 * Document class strings are the product names from Click2Mail's API
 * (their Java sample for 5×8, and the product list for 6×9).
 */
export const POSTCARD_SIZES = ["5x8", "6x9"] as const
export type PostcardSize = (typeof POSTCARD_SIZES)[number]

/**
 * Click2Mail's published postcard job sends a single space for envelope.
 * Postcards are not inserted into an envelope. An empty string is still a
 * value, and a letter envelope bills the job as a letter.
 */
export const POSTCARD_NO_ENVELOPE = " "

export const POSTCARD_LAYOUT = "Double Sided Postcard"
export const POSTCARD_MAIL_CLASS = "First Class"
export const POSTCARD_PAPER_TYPE = "White Matte with Gloss UV Finish"
export const POSTCARD_PRINT_OPTION = "Printing both sides"
export const POSTCARD_COLOR = "Full Color"
export const POSTCARD_PRODUCTION_TIME = "Next Day"

/** Exact `documentClass` strings. Do not substitute a letter class. */
export const POSTCARD_DOCUMENT_CLASS: Record<PostcardSize, string> = {
  "5x8": "Postcard 5 x 8",
  "6x9": "Postcard 6 x 9",
}

/** Layouts from the letter product example and the letter-only option list. */
const LETTER_LAYOUTS = new Set([
  "Address on Separate Page",
  "Address on First Page",
  "Picture and Address First Page",
  "Address Back Page",
])

/** Envelopes from Click2Mail's letter and flat products. */
const LETTER_ENVELOPES = new Set([
  "#10 Double Window",
  "Best Fit",
  "#10 Open Window Envelope",
  "6 x 9.5 Double Window",
  "6 x 9.5 Open Window",
  "Flat Envelope",
])

/** Bond papers from the letter product. Postcards use card stock. */
const LETTER_PAPERS = new Set([
  "White 24#",
  "Off-White 28#",
  "Canary 24#",
  "White 28#",
  "White 28# Matte",
])

export function isPostcardSize(value: string): value is PostcardSize {
  return (POSTCARD_SIZES as readonly string[]).includes(value)
}

/** The job body Click2Mail's postcard sample uses, for one size. */
export function postcardJobProduct(size: PostcardSize): Click2MailProductOptions {
  return {
    documentFormat: "PDF",
    documentClass: POSTCARD_DOCUMENT_CLASS[size],
    layout: POSTCARD_LAYOUT,
    productionTime: POSTCARD_PRODUCTION_TIME,
    envelope: POSTCARD_NO_ENVELOPE,
    color: POSTCARD_COLOR,
    paperType: POSTCARD_PAPER_TYPE,
    printOption: POSTCARD_PRINT_OPTION,
    mailClass: POSTCARD_MAIL_CLASS,
    addressMappingId: "1",
    billingType: "User Credit",
  }
}

/**
 * Build the product for a postcard job.
 * Size chooses the document class. Account overrides may change paper, color,
 * print option, mail class, and production time. They cannot turn the job
 * into a letter: that check happens in `assertPostcardJobProduct`.
 */
export function resolvePostcardProduct(
  size: PostcardSize,
  configured: Click2MailProductOptions,
  overrides?: Partial<Click2MailProductOptions>
): Click2MailProductOptions {
  const spec = postcardJobProduct(size)
  const configuredClass = configured.documentClass.trim()
  const documentClass =
    size === "5x8" && configuredClass.startsWith("Postcard ")
      ? configured.documentClass
      : spec.documentClass
  const configuredLayout = configured.layout.trim()
  const layout =
    LETTER_LAYOUTS.has(configuredLayout) || !/postcard/i.test(configuredLayout)
      ? spec.layout
      : configured.layout
  const configuredEnvelope = configured.envelope.trim()
  const envelope =
    !configuredEnvelope || LETTER_ENVELOPES.has(configuredEnvelope) ? spec.envelope : configured.envelope
  const configuredPaper = configured.paperType.trim()
  const paperType = !configuredPaper || LETTER_PAPERS.has(configuredPaper) ? spec.paperType : configured.paperType

  return {
    ...spec,
    documentFormat: configured.documentFormat || spec.documentFormat,
    documentClass,
    layout,
    productionTime: configured.productionTime || spec.productionTime,
    envelope,
    color: configured.color || spec.color,
    paperType,
    printOption: configured.printOption || spec.printOption,
    mailClass: configured.mailClass || spec.mailClass,
    addressMappingId: configured.addressMappingId || spec.addressMappingId,
    billingType: configured.billingType || spec.billingType,
    ...omitUndefined(overrides),
  }
}

export function assertPostcardJobProduct(product: Click2MailProductOptions): void {
  const documentClass = product.documentClass.trim()
  if (!documentClass.startsWith("Postcard ")) {
    throw new Click2MailError(
      `This piece has to mail as a postcard. "${documentClass}" is not a postcard product.`
    )
  }
  const layout = product.layout.trim()
  if (LETTER_LAYOUTS.has(layout) || !/postcard/i.test(layout)) {
    throw new Click2MailError(
      `This piece has to use a postcard layout. "${layout}" is a letter layout.`
    )
  }
  const envelope = product.envelope.trim()
  if (LETTER_ENVELOPES.has(envelope)) {
    throw new Click2MailError(
      `Postcards are not mailed in an envelope. "${envelope}" would bill this as a letter.`
    )
  }
  const paperType = product.paperType.trim()
  if (LETTER_PAPERS.has(paperType)) {
    throw new Click2MailError(
      `"${paperType}" is letter paper. A postcard needs card stock.`
    )
  }
  if (!product.mailClass.trim()) {
    throw new Click2MailError("Choose a mail class. Postcards mail First Class.")
  }
}

function omitUndefined(
  overrides?: Partial<Click2MailProductOptions>
): Partial<Click2MailProductOptions> {
  if (!overrides) return {}
  const next: Partial<Click2MailProductOptions> = {}
  for (const key of Object.keys(overrides) as (keyof Click2MailProductOptions)[]) {
    const value = overrides[key]
    if (value !== undefined) next[key] = value
  }
  return next
}
