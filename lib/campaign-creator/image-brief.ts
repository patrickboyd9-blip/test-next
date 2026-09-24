import {
  LEAD_JOBS,
  normalizeLayoutVariant,
  type CreativeSpec,
  type ImageryRole,
  type LeadJob,
} from "./types"

/**
 * Ephemeral execution request for a conceived photograph.
 * Derived from CreativeSpec. Not a CreativeSpec field. Not persisted.
 * The Creative Engine remains the sole author of imagery intent.
 */
export const IMAGE_BRIEF_OCCUPANCIES = [
  "field",
  "supporting",
  "witness",
] as const
export type ImageBriefOccupancy = (typeof IMAGE_BRIEF_OCCUPANCIES)[number]

export type ImageBriefRole = Exclude<ImageryRole, "none" | "logo">

const IMAGE_BRIEF_ROLES = [
  "consequence",
  "neighborhood",
  "crew",
] as const satisfies readonly ImageBriefRole[]

/**
 * Honesty bounds from existing Creative Intelligence imagery rules.
 * Not research dump. Not a taxonomy. Not role-assigned photographs.
 */
export const IMAGE_BRIEF_DO_NOT_INVENT = [
  "invented crew or personnel",
  "invented property damage",
  "invented recipient-specific property or conditions",
  "generic or interchangeable stock presented as proof of a specific customer situation",
] as const

export interface ImageBrief {
  imageryRole: ImageBriefRole
  visualDirection: string
  occupancy: ImageBriefOccupancy
  leadJob: LeadJob
  tone?: string
  doNotInvent: readonly string[]
}

function isImageBriefRole(
  value: ImageryRole | undefined
): value is ImageBriefRole {
  return (
    value !== undefined &&
    (IMAGE_BRIEF_ROLES as readonly string[]).includes(value)
  )
}

function isImageBriefLeadJob(value: string | undefined): value is LeadJob {
  return value !== undefined && (LEAD_JOBS as readonly string[]).includes(value)
}

function occupancyFromSpec(spec: CreativeSpec): ImageBriefOccupancy | null {
  const layout = normalizeLayoutVariant(spec.layoutVariant)

  if (layout === "type_only") return null
  if (layout === "image_grounded") return "field"
  if (spec.imagePresence === "accent") return "witness"
  if (
    layout === "type_primary_split" ||
    layout === "peer_split" ||
    layout === "banded_split"
  ) {
    return "supporting"
  }

  return null
}

/**
 * Translates an already-conceived CreativeSpec into an executable image brief.
 * Returns null when the spec has no honest photographic job.
 */
export function toImageBrief(spec: CreativeSpec): ImageBrief | null {
  if (!isImageBriefRole(spec.imageryRole)) return null
  if (!isImageBriefLeadJob(spec.leadJob)) return null

  const visualDirection = spec.visualDirection
  if (!visualDirection?.trim()) return null

  const occupancy = occupancyFromSpec(spec)
  if (!occupancy) return null

  const brief: ImageBrief = {
    imageryRole: spec.imageryRole,
    visualDirection,
    occupancy,
    leadJob: spec.leadJob,
    doNotInvent: IMAGE_BRIEF_DO_NOT_INVENT,
  }

  if (spec.tone?.trim()) {
    brief.tone = spec.tone
  }

  return brief
}
