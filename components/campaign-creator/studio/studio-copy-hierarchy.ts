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
