/**
 * What the card is allowed to say.
 * A free offer is the word FREE. A $0 figure is never painted.
 * When that lockup is the offer, the headline has to be the problem or the benefit.
 */

const STOP = new Set(["a", "an", "the", "one", "your", "our", "and", "for", "to", "of", "is", "it", "on", "in", "up", "with"])

const PROBLEM_BY_VERTICAL: Record<string, string> = {
  roofing: "See the roof before it leaks.",
  plumbing: "The drain should run clear.",
  hvac: "Cool the house before the heat hits.",
  real_estate: "Sell the house as it stands.",
  solar: "See what the roof could save.",
  dental: "A visit before it hurts.",
  pest_control: "The ants do not leave on their own.",
  landscaping: "The yard, handled once.",
  general_local_service: "One job. One way to start.",
  medicare_insurance: "A local person explains the choice.",
  general: "One job. One way to start.",
}

export function isFreeOffer(offer: string): boolean {
  return containsZeroDollar(offer) || /\bfree\b/i.test(offer)
}

export function containsZeroDollar(text: string): boolean {
  return /\$\s*0(?:\.00)?\b/.test(text)
}

export function headlineRepeatsOffer(headline: string, offer: string): boolean {
  if (containsZeroDollar(headline)) return true
  if (isFreeOffer(offer) && /\bfree\b/i.test(headline)) return true
  const headlineWords = new Set(contentWords(headline))
  const offerWords = contentWords(offer).filter((word) => word !== "free" && !/^\$?0+$/.test(word))
  const shared = offerWords.filter((word) => headlineWords.has(word))
  if (isFreeOffer(offer)) return shared.length >= 1
  if (shared.length >= 2) return true
  const headlineContent = contentWords(headline)
  return headlineContent.length > 0 && shared.length === headlineContent.length
}

export function resolveFrontCopy(input: {
  headline: string
  offer: string
  moment?: string
  vertical?: string
}): { headline: string; numeral: string; rest: string } {
  const lockup = heroLockup(input.offer)
  const source = input.headline.replace(/\s+/g, " ").trim()
  if (!headlineRepeatsOffer(source, input.offer)) {
    return { headline: scrubZero(source) || "One clear next step", ...lockup }
  }
  const salvaged = salvageProblem(source)
  if (salvaged && !headlineRepeatsOffer(salvaged, input.offer)) {
    return { headline: salvaged, ...lockup }
  }
  const fromMoment = momentHeadline(input.moment ?? "", input.offer)
  if (fromMoment) return { headline: fromMoment, ...lockup }
  const fallback = PROBLEM_BY_VERTICAL[input.vertical ?? ""] ?? PROBLEM_BY_VERTICAL.general
  return { headline: fallback, ...lockup }
}

/** A free offer, a dollar figure, or a percent. "Storm inspection" is a phrase, not a figure. */
export function offerIsFigure(offer: string): boolean {
  const cleaned = offer.replace(/\s+/g, " ").trim()
  if (!cleaned) return false
  if (isFreeOffer(cleaned)) return true
  return /^\$?\d[\d,]*(?:\.\d+)?%?(?:\s|$)/.test(cleaned)
}

export function heroLockup(offer: string): { numeral: string; rest: string } {
  const cleaned = offer.replace(/\s+/g, " ").trim()
  if (isFreeOffer(cleaned)) {
    const rest = cleaned
      .replace(/\$\s*0(?:\.00)?/gi, " ")
      .replace(/\bfree\b/gi, " ")
      .replace(/\s+/g, " ")
      .replace(/^[,.\-–—:\s]+|[,.\-–—:\s]+$/g, "")
      .trim()
    return { numeral: "FREE", rest }
  }
  const priced = cleaned.match(/^(\$?\d[\d,]*(?:\.\d+)?%?)\s+(.*)$/)
  if (priced && /^\$?\d/.test(priced[1] ?? "")) {
    return { numeral: priced[1] ?? cleaned, rest: (priced[2] ?? "").trim() }
  }
  return { numeral: cleaned, rest: "" }
}

function salvageProblem(headline: string): string | null {
  const pieces = headline.split(/(?<=[?.!])\s+/).map((piece) => piece.trim()).filter(Boolean)
  const kept = pieces.filter((piece) => !/\bfree\b/i.test(piece) && !containsZeroDollar(piece))
  if (kept.length === 0) return null
  const line = kept.join(" ").replace(/\s+/g, " ").trim()
  if (contentWords(line).length < 2 && !line.endsWith("?")) return null
  return line
}

function momentHeadline(moment: string, offer: string): string | null {
  const text = moment.replace(/\s+/g, " ").trim()
  if (!text) return null
  let line = text
  const notHad = text.match(/have not had (?:a |an |any )?(.+?)\.?$/i)
  if (notHad?.[1]) line = `No ${notHad[1].replace(/\.$/, "")}.`
  const want = text.match(/who want (.+?)\.?$/i)
  if (want?.[1]) line = `${want[1].charAt(0).toUpperCase()}${want[1].slice(1).replace(/\.$/, "")}.`
  if (line.length > 52) return null
  if (headlineRepeatsOffer(line, offer) || containsZeroDollar(line)) return null
  if (contentWords(line).length < 3) return null
  return line
}

function scrubZero(text: string): string {
  return text.replace(/\$\s*0(?:\.00)?/gi, "free").replace(/\s+/g, " ").trim()
}

function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9$%\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP.has(word))
}
