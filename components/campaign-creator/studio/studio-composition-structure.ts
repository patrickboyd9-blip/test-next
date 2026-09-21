import {
  normalizeLayoutVariant,
  type LayoutVariant,
} from "@/lib/campaign-creator/types"

/**
 * Renderer-owned region graph for a layoutVariant.
 * Describes what regions exist and how they relate — not CSS, not CreativeSpec.
 * leadJob and imageryRole must not be inputs; they cannot change the family.
 */
export interface StudioCompositionStructure {
  layoutVariant: LayoutVariant
  regions: readonly string[]
  imageRelation: "supporting" | "peer" | "secondary" | "ground" | "none"
  typeRelation: "dominant" | "peer" | "supporting" | "inscription" | "sole"
  hasOrganizingBand: boolean
  hasImageRegion: boolean
  imageIsGround: boolean
}

const STRUCTURES: Record<LayoutVariant, StudioCompositionStructure> = {
  type_primary_split: {
    layoutVariant: "type_primary_split",
    regions: ["type", "supporting-image"],
    imageRelation: "supporting",
    typeRelation: "dominant",
    hasOrganizingBand: false,
    hasImageRegion: true,
    imageIsGround: false,
  },
  peer_split: {
    layoutVariant: "peer_split",
    regions: ["peer-image", "peer-type"],
    imageRelation: "peer",
    typeRelation: "peer",
    hasOrganizingBand: false,
    hasImageRegion: true,
    imageIsGround: false,
  },
  banded_split: {
    layoutVariant: "banded_split",
    regions: ["band", "supporting", "image"],
    imageRelation: "secondary",
    typeRelation: "supporting",
    hasOrganizingBand: true,
    hasImageRegion: true,
    imageIsGround: false,
  },
  image_grounded: {
    layoutVariant: "image_grounded",
    regions: ["image-ground", "inscription"],
    imageRelation: "ground",
    typeRelation: "inscription",
    hasOrganizingBand: false,
    hasImageRegion: true,
    imageIsGround: true,
  },
  type_only: {
    layoutVariant: "type_only",
    regions: ["type", "field"],
    imageRelation: "none",
    typeRelation: "sole",
    hasOrganizingBand: false,
    hasImageRegion: false,
    imageIsGround: false,
  },
}

export function studioCompositionStructure(
  layoutVariant?: string
): StudioCompositionStructure {
  const layout = normalizeLayoutVariant(layoutVariant) ?? "peer_split"
  return STRUCTURES[layout]
}
