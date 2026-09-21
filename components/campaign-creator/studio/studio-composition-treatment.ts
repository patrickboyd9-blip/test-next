import {
  normalizeLayoutVariant,
  type ImageryRole,
  type LayoutVariant,
  type LeadJob,
} from "@/lib/campaign-creator/types"

import { studioCompositionStructure } from "./studio-composition-structure"

/**
 * Renderer-owned composition treatment. Derived at preview time from existing
 * CreativeSpec semantic jobs. Not a CreativeSpec field and not persisted.
 */
export type PhotoWeight = "none" | "subordinate" | "balanced" | "dominant"
export type CropPreset = "tight" | "default" | "open"
export type TypeEmphasis = "aggressive" | "default" | "quiet"
export type CtaWeight = "strong" | "default" | "quiet"
export type PaletteMode = "field" | "ink"
export type TypeVoice = "offer" | "urgency" | "trust" | "problem" | "default"
export type PaletteSlot = "primary" | "secondary" | "accent"
export type InkSlot = PaletteSlot | "on-field"
export type TypeWeight = "medium" | "bold" | "extrabold"
export type TypeRhythm = "immediate" | "compressed" | "composed" | "tense" | "default"
export type HeroColorRole = "emphasis" | "ink"
export type CtaColorRole = "emphasis-fill" | "ink-line" | "ink-quiet"
export type CtaMark = "reverse-slug" | "hierarchy-line" | "quiet-line"
export type PrintMarkArrangement =
  | "flowing-type"
  | "supporting-stack"
  | "inscription"
  | "sole-type"

export interface StudioPrintMarkExecution {
  ctaMark: CtaMark
  arrangement: PrintMarkArrangement
}

export interface StudioTypeExecution {
  scale: number
  weight: TypeWeight
  rhythm: TypeRhythm
  heroColor: HeroColorRole
  ctaColor: CtaColorRole
}

export interface StudioCompositionTreatment {
  photoWeight: PhotoWeight
  cropPreset: CropPreset
  typeEmphasis: TypeEmphasis
  ctaWeight: CtaWeight
  paletteMode: PaletteMode
  typeVoice: TypeVoice
  fieldSlot: PaletteSlot
  inkSlot: InkSlot
  emphasisSlot: PaletteSlot
}

export interface StudioPaletteExecution {
  field: string
  ink: string
  emphasis: string
}

const DEFAULT_PALETTE = ["#1e3a5f", "#4a90a4", "#f5f5f0"] as const

const DEFAULT_TREATMENT: StudioCompositionTreatment = {
  photoWeight: "balanced",
  cropPreset: "default",
  typeEmphasis: "default",
  ctaWeight: "default",
  paletteMode: "ink",
  typeVoice: "default",
  fieldSlot: "accent",
  inkSlot: "primary",
  emphasisSlot: "secondary",
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

/**
 * Assigns the CreativeSpec palette into field / ink / emphasis roles.
 * Does not invent campaign-independent brand colors.
 */
export function resolveStudioPalette(
  palette: readonly string[] | undefined,
  treatment: StudioCompositionTreatment
): StudioPaletteExecution {
  const slots = paletteSlots(palette)
  const field = slots[treatment.fieldSlot]
  const ink =
    treatment.inkSlot === "on-field" ? contrastInk(field) : slots[treatment.inkSlot]
  const emphasis = slots[treatment.emphasisSlot]
  return { field, ink, emphasis }
}

/**
 * Renderer-owned type voice for a leadJob treatment.
 * Same type system, four different executions — not a font framework.
 */
export function studioTypeExecution(
  treatment: StudioCompositionTreatment
): StudioTypeExecution {
  const ctaColor: CtaColorRole =
    treatment.ctaWeight === "strong"
      ? "emphasis-fill"
      : treatment.ctaWeight === "quiet"
        ? "ink-quiet"
        : "ink-line"

  switch (treatment.typeVoice) {
    case "offer":
      return {
        scale: 1.1,
        weight: "bold",
        rhythm: "immediate",
        heroColor: "emphasis",
        ctaColor,
      }
    case "urgency":
      return {
        scale: 1,
        weight: "extrabold",
        rhythm: "compressed",
        heroColor: "ink",
        ctaColor,
      }
    case "trust":
      return {
        scale: 0.9,
        weight: "medium",
        rhythm: "composed",
        heroColor: "ink",
        ctaColor,
      }
    case "problem":
      return {
        scale: 1.16,
        weight: "bold",
        rhythm: "tense",
        heroColor: "emphasis",
        ctaColor,
      }
    default:
      return {
        scale: 1,
        weight: "bold",
        rhythm: "default",
        heroColor: "ink",
        ctaColor,
      }
  }
}

/**
 * Renderer-owned print-mark execution for CTA / QR / contact.
 * Uses existing treatment knobs and layout family — not CreativeSpec fields.
 */
export function studioPrintMarks(
  treatment: StudioCompositionTreatment,
  layout?: LayoutVariant
): StudioPrintMarkExecution {
  const type = studioTypeExecution(treatment)
  const ctaMark: CtaMark =
    type.ctaColor === "emphasis-fill" || treatment.ctaWeight === "strong"
      ? "reverse-slug"
      : type.ctaColor === "ink-quiet" || treatment.ctaWeight === "quiet"
        ? "quiet-line"
        : "hierarchy-line"

  return {
    ctaMark,
    arrangement: arrangementFromLayout(layout),
  }
}

function arrangementFromLayout(layout?: LayoutVariant): PrintMarkArrangement {
  const structure = studioCompositionStructure(layout)
  if (structure.imageIsGround) return "inscription"
  if (structure.hasOrganizingBand) return "supporting-stack"
  if (!structure.hasImageRegion) return "sole-type"
  return "flowing-type"
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
        typeVoice: "offer",
        fieldSlot: "primary",
        inkSlot: "on-field",
        emphasisSlot: "secondary",
      }
    case "urgency":
      return {
        photoWeight: "subordinate",
        cropPreset: "tight",
        typeEmphasis: "aggressive",
        ctaWeight: "strong",
        paletteMode: "field",
        typeVoice: "urgency",
        fieldSlot: "secondary",
        inkSlot: "on-field",
        emphasisSlot: "primary",
      }
    case "trust":
      return {
        photoWeight: "dominant",
        cropPreset: "open",
        typeEmphasis: "quiet",
        ctaWeight: "quiet",
        paletteMode: "ink",
        typeVoice: "trust",
        fieldSlot: "accent",
        inkSlot: "primary",
        emphasisSlot: "secondary",
      }
    case "problem":
      return {
        photoWeight: "dominant",
        cropPreset: "tight",
        typeEmphasis: "aggressive",
        ctaWeight: "default",
        paletteMode: "field",
        typeVoice: "problem",
        fieldSlot: "primary",
        inkSlot: "on-field",
        emphasisSlot: "accent",
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

function paletteSlots(palette: readonly string[] | undefined): Record<PaletteSlot, string> {
  return {
    primary: palette?.[0] || DEFAULT_PALETTE[0],
    secondary: palette?.[1] || DEFAULT_PALETTE[1],
    accent: palette?.[2] || DEFAULT_PALETTE[2],
  }
}

function contrastInk(background: string): string {
  const hex = background.replace("#", "")
  if (hex.length !== 6) return "#1a1a1a"
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luma = (r * 299 + g * 587 + b * 114) / 1000
  return luma > 160 ? "#1a1a1a" : "#f7f7f4"
}
