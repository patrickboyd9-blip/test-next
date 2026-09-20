import type { ImageryKey, ImageryRole, LeadJob } from "@/lib/campaign-creator/types"

const GENERIC_LOCAL_PATH = "/creative-studio/imagery/stock_generic_local.jpg"

export type StudioCopyHierarchy = "layout-default" | "offer-hero" | "message-hero"

export interface StudioImagery {
  src: string | null
  showMonogram: boolean
}

/**
 * leadJob drives copy hierarchy in PostcardPreview.
 * Undefined preserves each layout's current default.
 */
export function studioCopyHierarchy(
  leadJob: LeadJob | undefined
): StudioCopyHierarchy {
  if (!leadJob) return "layout-default"
  if (leadJob === "offer") return "offer-hero"
  return "message-hero"
}

/**
 * Renderer-owned lookup. CreativeSpec keeps the role/key; paths do not belong on the spec.
 *
 * imageryRole, when present, is the semantic instruction. ImageryKey is only the
 * fallback for older specs that have no role.
 *
 * The Studio library currently has one curated photograph (generic local/neighborhood).
 * There is no consequence or crew asset. Do not invent one or reuse the neighborhood
 * photo as if it depicted damage or a work crew.
 */
export function resolveStudioImagery(
  key: ImageryKey | undefined,
  role?: ImageryRole
): StudioImagery {
  if (role === "none") return { src: null, showMonogram: false }
  if (role === "logo") return { src: null, showMonogram: true }
  if (role === "neighborhood") {
    return { src: GENERIC_LOCAL_PATH, showMonogram: false }
  }
  if (role === "consequence") {
    // No consequence photograph is available. Render without an image rather than
    // pretending the neighborhood stock photo is damage/problem imagery.
    return { src: null, showMonogram: false }
  }
  if (role === "crew") {
    // No crew/team photograph is available. Do not fabricate one.
    return { src: null, showMonogram: false }
  }

  switch (key) {
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
