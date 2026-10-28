/**
 * Slot limits for the roofing pro templates.
 * The model is asked to stay inside these counts.
 * The painter still shortens on a word boundary and then shrinks the type.
 * It does not clip a word in half, and it does not invent a fact.
 */

export const ROOFING_COPY_LIMITS = {
  headline: 40,
  offer: 32,
  offerLed: 22,
  body: 100,
  business: 28,
  url: 34,
  license: 28,
} as const

const REAL_DATE =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:,\s*\d{4})?\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/i

/**
 * Collapses whitespace. It never drops words: the fitter shrinks or wraps
 * long copy instead, so an offer, a name, or a sentence is never cut short.
 * `max` is kept for callers and documents the target length only.
 */
export function limitChars(value: string, max: number): string {
  void max
  return value.replace(/\s+/g, " ").trim()
}

/** A date line only when the customer already wrote an expiry. */
export function statedExpiryLine(text: string): string | null {
  const match = text.match(REAL_DATE)
  if (!match || match.index === undefined) return null
  const window = text.slice(Math.max(0, match.index - 28), match.index + match[0].length + 12)
  if (!/\b(?:through|until|expires|expiry|valid)\b/i.test(window)) return null
  return window.replace(/\s+/g, " ").trim()
}

/**
 * The license slot prints a number the business supplied, or the word
 * Licensed when that word is already in the copy. It never mints a number.
 */
export function statedLicense(explicit: string | undefined, blob: string): string {
  const given = explicit?.replace(/\s+/g, " ").trim()
  if (given) return limitChars(given, ROOFING_COPY_LIMITS.license)
  const numbered = blob.match(/\blicen[sc]e\s*(?:no\.?|number|#)?\s*[:#]?\s*[A-Z0-9][A-Z0-9-]{2,}/i)
  if (numbered) return limitChars(numbered[0].replace(/\s+/g, " ").trim(), ROOFING_COPY_LIMITS.license)
  if (/\blicensed\b/i.test(blob)) return "Licensed"
  return ""
}

export function roofingCopyRules(): string {
  return `When the business is roofing, a fixed pro template sets the layout. Write the words into the slots. Do not invent a new arrangement.
- headline: 3 to 6 words and at most ${ROOFING_COPY_LIMITS.headline} characters. It is the largest line, except on an offer coupon, where the offer is larger.
- offer: copy the brief. At most ${ROOFING_COPY_LIMITS.offer} characters. On a coupon, at most ${ROOFING_COPY_LIMITS.offerLed} characters.
- body: at most ${ROOFING_COPY_LIMITS.body} characters.
- Do not invent a license number, a statistic, a neighbor count, a star rating, or a deadline. A date may appear only when the brief already states that date.`
}
