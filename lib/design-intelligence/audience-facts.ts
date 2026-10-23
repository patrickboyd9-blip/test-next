/**
 * Audience claims on a card have to be facts the client entered.
 * A model rationale that invents an age, an income, or a count is dropped.
 */

const AUDIENCE_FACT = /\b(?:years?\s+old|year-olds?|over\s+\d+|under\s+\d+|aged?\s+\d+|\bincome\b|household income|homeowners?\s+over)\b/i

export function scrubUnstatedAudience(text: string, facts: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean)
  return sentences.filter((sentence) => audienceSentenceIsAllowed(sentence, facts)).join(" ")
}

export function scrubUnstatedName(name: string, facts: string, fallback: string): string {
  if (/\bage\b/i.test(name) && !/\bage\b/i.test(facts)) return fallback
  if (/\bincome\b/i.test(name) && !/\bincome\b/i.test(facts)) return fallback
  const numbers = name.match(/\b\d+\b/g) ?? []
  if (numbers.some((number) => !facts.includes(number))) return fallback
  return name
}

export function statedNameFallback(offer?: string, goal?: string): string {
  const source = (offer || goal || "This direction").replace(/[.$!]/g, "").trim()
  const words = source.split(/\s+/).filter(Boolean).slice(0, 4)
  return words.join(" ") || "This direction"
}

function audienceSentenceIsAllowed(sentence: string, facts: string): boolean {
  const numbers = sentence.match(/\b\d[\d,]*\b/g) ?? []
  if (numbers.some((number) => !facts.includes(number.replace(/,/g, "")) && !facts.includes(number))) return false
  if (AUDIENCE_FACT.test(sentence) && !AUDIENCE_FACT.test(facts)) return false
  if (/\bage\b/i.test(sentence) && !/\bage\b/i.test(facts)) return false
  return true
}
