import {
  BETA_IMAGERY_LIBRARY,
  type CuratedImageryAsset,
} from "./beta-imagery-library"
import type { ImageryKey, ImageryRole } from "./types"

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
  role: ImageryRole
): CuratedImageryAsset | undefined {
  return BETA_IMAGERY_LIBRARY.find(
    (asset) => asset.eligibleRole === role && Boolean(asset.previewSrc)
  )
}

function fromLibrary(role: ImageryRole): ResolvedImage {
  const src = availableAssetForRole(role)?.previewSrc ?? null
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
 */
export function resolveCreativeImage(
  imagery: ImageryKey | undefined,
  imageryRole?: ImageryRole
): ResolvedImage {
  if (imageryRole === "none") return EMPTY_IMAGE
  if (imageryRole === "logo") return MONOGRAM_IMAGE
  if (imageryRole) return fromLibrary(imageryRole)

  switch (imagery) {
    case "stock_generic_local":
    case "stock_hvac":
    case "stock_restaurant":
      return fromLibrary("neighborhood")
    case "logo_primary":
      return MONOGRAM_IMAGE
    case "none":
    default:
      return EMPTY_IMAGE
  }
}
