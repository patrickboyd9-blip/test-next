import type { GeneratedAsset } from "./image-generation"
import {
  fingerprintForSpec,
  imageBriefContextFor,
  lookupStudioImage,
  type StudioImageRecord,
} from "./studio-image-fingerprint"
import type { StudioImageMiss } from "./studio-image-cache"
import type { CampaignBrief, CreativeSpec } from "./types"

export const STUDIO_PHOTO_NOTE = {
  making: "Making the photograph for this piece.",
  not_configured:
    "Stand-in photo. Image generation isn't available, so this is a placeholder.",
  failed:
    "Stand-in photo. Image generation didn't succeed, so this is a placeholder.",
} as const

export interface StudioImageState {
  records: readonly StudioImageRecord[]
  misses: readonly StudioImageMiss[]
  phase: "loading" | "ready"
  requestFailed?: boolean
}

export interface StudioPhotoPresentation {
  generatedAsset: GeneratedAsset | null
  /** Second photograph for a before/after composition. Null on every other card. */
  alternateAsset: GeneratedAsset | null
  allowLibraryFallback: boolean
  note: string | null
}

export function presentStudioPhoto(
  state: StudioImageState,
  directionId: string,
  spec: CreativeSpec,
  campaign?: CampaignBrief
): StudioPhotoPresentation {
  const generatedAsset = lookupStudioImage(
    state.records,
    directionId,
    spec,
    campaign
  )
  const alternateAsset =
    (spec.layoutHints?.templateId === "before_after" || spec.layoutHints?.templateId === "roof_before_after")
      ? lookupStudioImage(state.records, directionId, spec, campaign, "after")
      : null
  if (generatedAsset) {
    return { generatedAsset, alternateAsset, allowLibraryFallback: false, note: null }
  }

  const fingerprint = fingerprintForSpec(
    spec,
    imageBriefContextFor(directionId, campaign)
  )
  if (!fingerprint) {
    return { generatedAsset: null, alternateAsset, allowLibraryFallback: false, note: null }
  }

  const miss = state.misses.find(
    (item) => item.directionId === directionId && item.fingerprint === fingerprint
  )
  if (miss?.fallback === "withheld") {
    return { generatedAsset: null, alternateAsset, allowLibraryFallback: true, note: null }
  }
  if (miss) {
    return {
      generatedAsset: null,
      alternateAsset,
      allowLibraryFallback: true,
      note: STUDIO_PHOTO_NOTE[miss.fallback],
    }
  }

  if (state.requestFailed) {
    return {
      generatedAsset: null,
      alternateAsset,
      allowLibraryFallback: true,
      note: STUDIO_PHOTO_NOTE.failed,
    }
  }

  if (state.phase === "loading") {
    return {
      generatedAsset: null,
      alternateAsset,
      allowLibraryFallback: false,
      note: STUDIO_PHOTO_NOTE.making,
    }
  }

  return { generatedAsset: null, alternateAsset, allowLibraryFallback: false, note: null }
}
