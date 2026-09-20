import type { ImageryKey, ImageryRole } from "./types"

const GENERIC_LOCAL_PATH = "/creative-studio/imagery/stock_generic_local.jpg"

/**
 * Preview-facing result of asset resolution. Not a CreativeSpec field.
 * Renderer owns crop, scale, and placement.
 */
export interface ResolvedImage {
  src: string | null
  showMonogram: boolean
}

/**
 * Maps imageryRole to a real available asset. Paths do not belong on CreativeSpec.
 *
 * imageryRole, when present, is the semantic instruction. ImageryKey is only the
 * legacy fallback for older specs that have no role.
 *
 * The library currently has one curated photograph (generic local/neighborhood).
 * There is no consequence or crew asset. Do not invent one or reuse the neighborhood
 * photo as if it depicted damage or a work crew.
 */
export function resolveCreativeImage(
  imagery: ImageryKey | undefined,
  imageryRole?: ImageryRole
): ResolvedImage {
  if (imageryRole === "none") return { src: null, showMonogram: false }
  if (imageryRole === "logo") return { src: null, showMonogram: true }
  if (imageryRole === "neighborhood") {
    return { src: GENERIC_LOCAL_PATH, showMonogram: false }
  }
  if (imageryRole === "consequence") {
    // No consequence photograph is available. Render without an image rather than
    // pretending the neighborhood stock photo is damage/problem imagery.
    return { src: null, showMonogram: false }
  }
  if (imageryRole === "crew") {
    // No crew/team photograph is available. Do not fabricate one.
    return { src: null, showMonogram: false }
  }

  switch (imagery) {
    case "stock_generic_local":
    case "stock_hvac":
    case "stock_restaurant":
      return { src: GENERIC_LOCAL_PATH, showMonogram: false }
    case "logo_primary":
      return { src: null, showMonogram: true }
    case "none":
    default:
      return { src: null, showMonogram: false }
  }
}
