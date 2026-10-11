import { buildPostcard5x8PrintSpec, type PostcardGeometry } from "./postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "./postcard-6x9-print-spec"

export const DESIGN_TEMPLATE_SIZES = ["5x8", "6x9"] as const
export type DesignTemplateSize = (typeof DESIGN_TEMPLATE_SIZES)[number]

export interface DesignTemplate {
  size: DesignTemplateSize
  /** Customer-facing name, such as "5×8 postcard". */
  displayName: string
  /** File-name token, such as "5x8". */
  fileToken: string
  /** Frame size in Figma, where 1 px = 1 pt. */
  figmaFrame: { widthPx: number; heightPx: number }
  geometry: PostcardGeometry
}

export function isDesignTemplateSize(value: string | null): value is DesignTemplateSize {
  return value === "5x8" || value === "6x9"
}

export function designTemplate(size: DesignTemplateSize): DesignTemplate {
  const geometry = size === "5x8" ? buildPostcard5x8PrintSpec() : buildPostcard6x9PrintSpec()
  return {
    size,
    displayName: size === "5x8" ? "5×8 postcard" : "6×9 postcard",
    fileToken: size,
    figmaFrame: {
      widthPx: geometry.pdfPagePoints.widthPoints,
      heightPx: geometry.pdfPagePoints.heightPoints,
    },
    geometry,
  }
}

export function formatInches(value: number): string {
  const rounded = Math.round(value * 1000) / 1000
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) return String(Math.round(rounded))
  return rounded.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")
}
