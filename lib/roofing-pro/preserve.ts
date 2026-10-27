import type { CreativeSpec } from "@/lib/campaign-creator/types"

import { isRoofingProTemplate } from "./ids"

/** A refinement keeps the roofing layout unless it names a different pro template. */
export function keepRoofingTemplate(current: CreativeSpec, next: CreativeSpec): CreativeSpec {
  const kept = current.layoutHints?.templateId
  if (!isRoofingProTemplate(kept)) return next
  if (isRoofingProTemplate(next.layoutHints?.templateId)) return next
  return {
    ...next,
    layoutHints: {
      ...next.layoutHints,
      templateId: kept,
      verticalPalette: next.layoutHints?.verticalPalette ?? current.layoutHints?.verticalPalette ?? "roofing",
    },
  }
}
