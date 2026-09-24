import { getActiveSpec } from "./creative-state"
import { toImageBrief } from "./image-brief"
import type { GeneratedAsset, ImageGenerationAdapter } from "./image-generation"
import type { Campaign } from "./types"

/**
 * Ephemeral lead-image execution. Reads a persisted direction's spec,
 * translates it, and optionally calls the supplied adapter.
 * Does not persist. Does not mutate Campaign.
 */
export async function generateLeadDirectionImage(
  campaign: Campaign,
  directionId: string,
  createAdapter: () => ImageGenerationAdapter
): Promise<{ directionId: string; generated: GeneratedAsset | null }> {
  const direction = campaign.creative.directions.find(
    (item) => item.id === directionId
  )
  if (!direction) {
    throw new Error("Selected direction not found")
  }

  const spec =
    getActiveSpec(campaign.creative, directionId) ?? direction.spec
  const brief = toImageBrief(spec)
  if (!brief) {
    return { directionId, generated: null }
  }

  const generated = await createAdapter().generate(brief)
  return { directionId, generated }
}
