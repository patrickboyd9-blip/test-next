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

function copyWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
}
