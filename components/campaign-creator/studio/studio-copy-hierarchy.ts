import type { LeadJob } from "@/lib/campaign-creator/types"

export type StudioCopyHierarchy = "layout-default" | "offer-hero" | "message-hero"

/**
 * leadJob drives copy hierarchy in PostcardPreview.
 * Undefined is layout-default, which does not make the offer the hero.
 * Offer leads only when leadJob is offer — never because of a layoutVariant.
 */
export function studioCopyHierarchy(
  leadJob: LeadJob | undefined
): StudioCopyHierarchy {
  if (!leadJob) return "layout-default"
  if (leadJob === "offer") return "offer-hero"
  return "message-hero"
}

export function copyOfferLeads(hierarchy: StudioCopyHierarchy): boolean {
  return hierarchy === "offer-hero"
}

/**
 * The follow-on line restates the lead when the two phrases share a word prefix.
 * "Free roofing inspection" and "Free Roofing Inspection. No Catch." are one line.
 * A genuinely different headline stays.
 */
export function copyRestatesLead(lead: string, follow: string): boolean {
  const leadWords = copyWords(lead)
  const followWords = copyWords(follow)
  if (leadWords.length < 2 || followWords.length < 2) return false
  const [shorter, longer] =
    leadWords.length <= followWords.length
      ? [leadWords, followWords]
      : [followWords, leadWords]
  return shorter.every((word, index) => longer[index] === word)
}

const LEADING_DETERMINER = new Set(["your", "our", "a", "an", "the", "this", "my"])

/**
 * The headline repeats the offer even when a determiner sits in front.
 * "Your Free Roof Inspection" restates "Free roof inspection".
 */
export function headlineRestatesOffer(offer: string, headline: string): boolean {
  if (copyRestatesLead(offer, headline)) return true
  const offerWords = copyWords(offer)
  const headWords = stripDeterminers(copyWords(headline))
  if (offerWords.length < 2 || headWords.length < 2) return false
  if (offerWords.join(" ") === headWords.join(" ")) return true
  const offerPhrase = offerWords.join(" ")
  const headPhrase = headWords.join(" ")
  return headPhrase.includes(offerPhrase) && headWords.length <= offerWords.length + 2
}

function stripDeterminers(words: string[]): string[] {
  const next = [...words]
  while (next.length > 2 && LEADING_DETERMINER.has(next[0] ?? "")) next.shift()
  return next
}

function copyWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
}
