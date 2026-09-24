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

/** Reading-path hero cap in PostcardPreview typeScale. Object display must exceed this. */
export const TYPE_ONLY_READING_HERO_MAX_PX = 34

export const TYPE_ONLY_FIGURE_CLAMP = {
  compact: "clamp(28px, 16cqw, 44px)",
  default: "clamp(56px, 22cqw, 96px)",
} as const

export type TypeOnlyRealization = {
  mode: "reading" | "object"
  figureSource: "headline" | null
  typeMeasure: "column" | "figure"
  marksRegion: "type" | "field"
  figureClamp: string | null
}

/**
 * type_only realization of an already-derived object. Not a CreativeSpec field.
 * Figure text is always the headline — never offer, never parsed copy.
 */
export function typeOnlyRealization(
  derivation: StudioCompositionDerivation,
  compact = false
): TypeOnlyRealization {
  if (derivation.layoutVariant === "type_only" && derivation.typePresence === "object") {
    return {
      mode: "object",
      figureSource: "headline",
      typeMeasure: "figure",
      marksRegion: "field",
      figureClamp: compact
        ? TYPE_ONLY_FIGURE_CLAMP.compact
        : TYPE_ONLY_FIGURE_CLAMP.default,
    }
  }

  return {
    mode: "reading",
    figureSource: null,
    typeMeasure: "column",
    marksRegion: "type",
    figureClamp: null,
  }
}

export function typeOnlyFigureText(spec: { headline?: string }): string {
  return spec.headline?.trim() ?? ""
}
