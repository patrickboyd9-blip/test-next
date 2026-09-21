import {
  normalizeLayoutVariant,
  type ImageryRole,
  type LayoutVariant,
  type LeadJob,
} from "@/lib/campaign-creator/types"

/**
 * Renderer-owned composition treatment. Derived at preview time from existing
 * CreativeSpec semantic jobs. Not a CreativeSpec field and not persisted.
 */
export type PhotoWeight = "none" | "subordinate" | "balanced" | "dominant"
export type CropPreset = "tight" | "default" | "open"
export type TypeEmphasis = "aggressive" | "default" | "quiet"
export type CtaWeight = "strong" | "default" | "quiet"
export type PaletteMode = "field" | "ink"

export interface StudioCompositionTreatment {
  photoWeight: PhotoWeight
  cropPreset: CropPreset
  typeEmphasis: TypeEmphasis
  ctaWeight: CtaWeight
  paletteMode: PaletteMode
}

const DEFAULT_TREATMENT: StudioCompositionTreatment = {
  photoWeight: "balanced",
  cropPreset: "default",
  typeEmphasis: "default",
  ctaWeight: "default",
  paletteMode: "ink",
}

/**
 * Maps existing CreativeSpec jobs to how PostcardPreview should execute them.
 * CreativeSpec says what; this answers how — without adding spec fields.
 */
export function studioCompositionTreatment(input: {
  leadJob?: LeadJob
  imageryRole?: ImageryRole
  layoutVariant?: LayoutVariant
}): StudioCompositionTreatment {
  const layout = normalizeLayoutVariant(input.layoutVariant) ?? input.layoutVariant
  const fromJob = treatmentFromLeadJob(input.leadJob)
  const cropPreset = cropFromImageryRole(input.imageryRole, fromJob.cropPreset)
  const photoWeight = constrainPhotoWeight(layout, fromJob.photoWeight)

  return {
    ...fromJob,
    cropPreset,
    photoWeight,
  }
}

function treatmentFromLeadJob(
  leadJob: LeadJob | undefined
): StudioCompositionTreatment {
  switch (leadJob) {
    case "offer":
      return {
        photoWeight: "subordinate",
        cropPreset: "tight",
        typeEmphasis: "aggressive",
        ctaWeight: "strong",
        paletteMode: "field",
      }
    case "urgency":
      return {
        photoWeight: "subordinate",
        cropPreset: "tight",
        typeEmphasis: "aggressive",
        ctaWeight: "strong",
        paletteMode: "field",
      }
    case "trust":
      return {
        photoWeight: "dominant",
        cropPreset: "open",
        typeEmphasis: "quiet",
        ctaWeight: "quiet",
        paletteMode: "ink",
      }
    case "problem":
      return {
        photoWeight: "dominant",
        cropPreset: "tight",
        typeEmphasis: "aggressive",
        ctaWeight: "default",
        paletteMode: "field",
      }
    default:
      return { ...DEFAULT_TREATMENT }
  }
}

function cropFromImageryRole(
  role: ImageryRole | undefined,
  fallback: CropPreset
): CropPreset {
  switch (role) {
    case "neighborhood":
    case "consequence":
      return "tight"
    case "crew":
      return "open"
    case "logo":
    case "none":
      return "default"
    default:
      return fallback
  }
}

function constrainPhotoWeight(
  layout: LayoutVariant | undefined,
  weight: PhotoWeight
): PhotoWeight {
  if (layout === "type_only" || weight === "none") return "none"
  if (layout === "type_primary_split") {
    return weight === "dominant" ? "subordinate" : weight
  }
  if (layout === "peer_split") return "balanced"
  if (layout === "banded_split") {
    return weight === "dominant" ? "balanced" : weight
  }
  if (layout === "image_grounded" && weight === "none") return "balanced"
  return weight
}
