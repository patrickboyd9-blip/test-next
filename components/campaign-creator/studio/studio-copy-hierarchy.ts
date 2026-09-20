import type { LeadJob } from "@/lib/campaign-creator/types"

export type StudioCopyHierarchy = "layout-default" | "offer-hero" | "message-hero"

/**
 * leadJob drives copy hierarchy in PostcardPreview.
 * Undefined preserves each layout's current default.
 */
export function studioCopyHierarchy(
  leadJob: LeadJob | undefined
): StudioCopyHierarchy {
  if (!leadJob) return "layout-default"
  if (leadJob === "offer") return "offer-hero"
  return "message-hero"
}
