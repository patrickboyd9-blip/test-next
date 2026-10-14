import {
  BETA_IMAGERY_LIBRARY,
  type CuratedImageryAsset,
} from "./beta-imagery-library"
import type { GeneratedAsset } from "./image-generation"
import { matchPhotoTags, photoExpectationForBrief } from "./photo-relevance"
import type { CampaignBrief, ImageryKey, ImageryRole } from "./types"

/**
 * Preview-facing result of asset resolution. Not a CreativeSpec field.
 * Renderer owns crop, scale, and placement.
 */
export interface ResolvedImage {
  src: string | null
  showMonogram: boolean
}

const EMPTY_IMAGE: ResolvedImage = { src: null, showMonogram: false }
const MONOGRAM_IMAGE: ResolvedImage = { src: null, showMonogram: true }

function availableAssetForRole(
  role: ImageryRole,
  campaign?: CampaignBrief
): CuratedImageryAsset | undefined {
  const eligible = BETA_IMAGERY_LIBRARY.filter(
    (asset) => asset.eligibleRole === role && Boolean(asset.previewSrc)
  )
  if (!campaign) return eligible[0]
  const expectation = photoExpectationForBrief(campaign)
  const matched = eligible.find(
    (asset) =>
      matchPhotoTags({ tags: asset.tags, describedSubject: asset.tags?.join(" ") }, expectation) ===
      "match"
  )
  if (matched) return matched
  const neutral = eligible.find(
    (asset) =>
      matchPhotoTags({ tags: asset.tags, describedSubject: asset.tags?.join(" ") }, expectation) ===
      "unknown"
  )
  return neutral
}

function fromLibrary(role: ImageryRole, campaign?: CampaignBrief): ResolvedImage {
  const src = availableAssetForRole(role, campaign)?.previewSrc ?? null
  return { src, showMonogram: false }
}

/**
 * Maps imageryRole to an eligible curated asset. Paths do not belong on CreativeSpec.
 *
 * imageryRole, when present, is the semantic instruction. ImageryKey is only the
 * legacy fallback for older specs that have no role.
 *
 * Cluster is not consulted. Layout and leadJob are not consulted.
 * Missing roles resolve empty rather than substituting another role's photo.
 *
 * generated is an optional render-path input. It is not a CreativeSpec field.
 * none and logo still win over a generated photograph.
 */
export interface ResolveCreativeImageOptions {
  /**
   * The beta shelf is a labeled stand-in. Studio denies it while a
   * campaign photograph should still succeed.
   */
  libraryFallback?: boolean
  /** When set, a stand-in from another industry is not used. */
  campaign?: CampaignBrief
}

export function resolveCreativeImage(
  imagery: ImageryKey | undefined,
  imageryRole?: ImageryRole,
  generated?: GeneratedAsset | null,
  options?: ResolveCreativeImageOptions
): ResolvedImage {
  const allowLibrary = options?.libraryFallback !== false
  if (imageryRole === "none") return EMPTY_IMAGE
  if (imageryRole === "logo") return MONOGRAM_IMAGE
  if (imageryRole && generated?.src) {
    return { src: generated.src, showMonogram: false }
  }
  if (imageryRole) {
    return allowLibrary ? fromLibrary(imageryRole, options?.campaign) : EMPTY_IMAGE
  }

  if (!allowLibrary && imagery && imagery !== "none" && imagery !== "logo_primary") {
    return EMPTY_IMAGE
  }

  switch (imagery) {
    case "stock_generic_local":
    case "stock_hvac":
    case "stock_restaurant":
      return fromLibrary("neighborhood", options?.campaign)
    case "logo_primary":
      return MONOGRAM_IMAGE
    case "none":
    default:
      return EMPTY_IMAGE
  }
}
