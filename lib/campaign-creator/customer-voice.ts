/**
 * Offer and body speak to the person reading the card.
 * A plain offer ("Free roof inspection") is fine.
 * "They" that means the reader becomes "you". "They" that means a
 * problem, a leak, or another thing stays.
 */

const CUSTOMER_VERB =
  "book|booking|call|calling|schedule|scheduling|reserve|reserving|visit|visiting|request|requesting|sign|signing|order|ordering|scan|scanning|reply|replying|hire|hiring|contact|contacting|reach|reaching"

const READER_POSSESSION =
  "home|house|roof|roofs|property|family|appointment|visit|neighborhood|street|yard|lawn|kitchen|bathroom|driveway|gutters?|inspection|neighbors"

export interface CustomerVoiceCopy {
  offer?: string
  body?: string
  subheadline?: string
}

export function repairCustomerVoice(value: string | undefined): string {
  const text = collapse(value)
  if (!text) return ""

  let next = text
  next = next.replace(
    new RegExp(`\\b(if|when|once|unless)\\s+(they)\\b(?=\\s+(?:${CUSTOMER_VERB})\\b)`, "gi"),
    (_match, conj: string, they: string) => `${conj} ${toYou(they)}`
  )
  next = next.replace(
    new RegExp(`\\b(they)\\b(?=\\s+(?:${CUSTOMER_VERB})\\b)`, "gi"),
    (they: string) => toYou(they)
  )
  next = next.replace(
    new RegExp(`\\b(their)\\s+(${READER_POSSESSION})\\b`, "gi"),
    (_match, their: string, noun: string) => `${toYour(their)} ${noun}`
  )
  next = next.replace(
    /\b(help|give|tell|show|invite|for)\s+(them)\b/gi,
    (_match, verb: string, them: string) => `${verb} ${toYou(them)}`
  )
  return collapse(next)
}

export function repairSpecCustomerVoice<T extends CustomerVoiceCopy>(spec: T): T {
  const offer = voicedField(spec.offer)
  const body = voicedField(spec.body)
  const subheadline = voicedField(spec.subheadline)
  if (offer === spec.offer && body === spec.body && subheadline === spec.subheadline) return spec
  return { ...spec, offer, body, subheadline }
}

function voicedField(value: string | undefined): string | undefined {
  if (!value?.trim()) return value
  const next = repairCustomerVoice(value)
  return next === collapse(value) ? value : next
}

function toYou(word: string): string {
  return word[0] === "T" ? "You" : "you"
}

function toYour(word: string): string {
  return word[0] === "T" ? "Your" : "your"
}

function collapse(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}
