import { RESEARCH_TASTE_PACK } from "@/lib/reference-corpus/taste-pack"
import type { ReferenceCard } from "@/lib/reference-corpus/reference-card"

/** Customer trades for the next gallery. Research names are mapped, not copied. */
export const GALLERY_VERTICALS = [
  "roofing",
  "hvac",
  "restaurant",
  "dental",
  "real_estate",
  "landscaping",
  "auto_repair",
  "cleaning",
] as const

export type GalleryVertical = (typeof GALLERY_VERTICALS)[number]

const RESEARCH_FOR: Record<GalleryVertical, readonly string[]> = {
  roofing: ["roofing"],
  hvac: ["hvac"],
  restaurant: ["restaurant", "pizza_qsr"],
  dental: ["dental"],
  real_estate: [],
  landscaping: ["landscaping"],
  auto_repair: [],
  cleaning: ["exterior_cleaning"],
}

export const FAVORITE_SOURCE_IDS = ["PM-066", "PM-067", "PM-068", "PM-069", "PM-070"] as const
export const ITEMS_PER_VERTICAL = 18
export const IMAGES_PER_ITEM = 1
export const CENTS_PER_IMAGE = 15
export const SPEND_CAP_CENTS = 700

export interface GalleryExpansionSlot {
  id: string
  vertical: GalleryVertical
  sourceId: string | null
  /** Lower sorts first. Favorites PM-066 through PM-070 are 0 through 4. */
  tier: number
  approach: string
  images: 1
}

export interface GalleryExpansionPlan {
  items: GalleryExpansionSlot[]
  images: number
  estimatedCents: number
  capCents: number
  status: "stopped"
  reason: string
}

export function sourceTier(id: string): number {
  const index = FAVORITE_SOURCE_IDS.indexOf(id as (typeof FAVORITE_SOURCE_IDS)[number])
  return index === -1 ? FAVORITE_SOURCE_IDS.length : index
}

export function planGalleryExpansion(
  cards: readonly ReferenceCard[] = RESEARCH_TASTE_PACK
): GalleryExpansionPlan {
  const items: GalleryExpansionSlot[] = []
  for (const vertical of GALLERY_VERTICALS) {
    const sources = cards
      .filter((card) => RESEARCH_FOR[vertical].includes(card.vertical))
      .slice()
      .sort((a, b) => sourceTier(a.mmrId) - sourceTier(b.mmrId) || a.mmrId.localeCompare(b.mmrId))
    for (let index = 0; index < ITEMS_PER_VERTICAL; index += 1) {
      const source = sources[index % Math.max(sources.length, 1)]
      const usable = sources.length > 0 ? source : undefined
      items.push({
        id: `${vertical}-${String(index + 1).padStart(2, "0")}`,
        vertical,
        sourceId: usable?.mmrId ?? null,
        tier: usable ? sourceTier(usable.mmrId) : sourceTier("none"),
        approach: usable ? scrub(usable.principles[0] ?? usable.compositionNotes) : "No reviewed card for this trade. One original picture is still required. Do not borrow another trade's photograph.",
        images: IMAGES_PER_ITEM,
      })
    }
  }
  const images = items.reduce((sum, item) => sum + item.images, 0)
  const estimatedCents = images * CENTS_PER_IMAGE
  return {
    items,
    images,
    estimatedCents,
    capCents: SPEND_CAP_CENTS,
    status: "stopped",
    reason: `${images} original pictures at ${CENTS_PER_IMAGE} cents each is ${estimatedCents} cents. The cap is ${SPEND_CAP_CENTS} cents, so no pictures were made.`,
  }
}

/** Documents that favorites exist and sort before ordinary research ids. */
export function favoriteIdsInOrder(): readonly string[] {
  return [...FAVORITE_SOURCE_IDS].sort((a, b) => sourceTier(a) - sourceTier(b))
}

function scrub(value: string): string {
  return value
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "")
    .replace(/\S+@\S+/g, "")
    .replace(/\s+/g, " ")
    .trim()
}
