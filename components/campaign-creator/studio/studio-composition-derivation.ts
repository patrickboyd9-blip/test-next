import {
  type ImagePresence,
  type LayoutVariant,
  type TypeRole,
} from "@/lib/campaign-creator/types"

import { studioCompositionStructure } from "./studio-composition-structure"

/**
 * Renderer-owned relationship derivation from family + optional semantic jobs.
 * Ephemeral. Not persisted. Not CreativeSpec fields.
 *
 * Does not read leadJob, imageryRole, copy, visualDirection, name, rationale,
 * or layoutHints. Does not rewrite layoutVariant.
 */
export type DerivedTypePresence = "reading" | "object"
export type DerivedImagePlate = "none" | "family" | "small"
export type DerivedVoid = "leftover" | "shaped"

export interface StudioCompositionDerivation {
  layoutVariant: LayoutVariant
  typePresence: DerivedTypePresence
  imagePlate: DerivedImagePlate
  voidShape: DerivedVoid
}

export function studioCompositionDerivation(input: {
  layoutVariant?: string
  typeRole?: TypeRole
  imagePresence?: ImagePresence
}): StudioCompositionDerivation {
  const structure = studioCompositionStructure(input.layoutVariant)
  const layout = structure.layoutVariant

  const typePresence: DerivedTypePresence =
    input.typeRole === "subject" && layout !== "image_grounded"
      ? "object"
      : "reading"

  const accentRealized =
    input.imagePresence === "accent" && layout === "type_primary_split"

  let imagePlate: DerivedImagePlate = "none"
  if (structure.hasImageRegion) {
    imagePlate = accentRealized ? "small" : "family"
  }

  const voidShape: DerivedVoid =
    typePresence === "object" || imagePlate === "small" ? "shaped" : "leftover"

  return {
    layoutVariant: layout,
    typePresence,
    imagePlate,
    voidShape,
  }
}
