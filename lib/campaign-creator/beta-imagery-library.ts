import type { ImageryRole } from "./types"

export const IMAGERY_SOURCE_CLASSES = ["curated"] as const
export type ImagerySourceClass = (typeof IMAGERY_SOURCE_CLASSES)[number]

export const IMAGERY_CLUSTERS = ["generic", "home-services"] as const
export type ImageryCluster = (typeof IMAGERY_CLUSTERS)[number]

/**
 * Curated beta imagery definition. Not a CreativeSpec field, not a DAM record.
 * previewSrc is present only when a real Studio file exists.
 */
export interface CuratedImageryAsset {
  id: string
  eligibleRole: ImageryRole
  cluster?: ImageryCluster
  sourceClass: ImagerySourceClass
  /**
   * Human/organizational declaration that the Modern Mail team has verified
   * the asset is permitted for commercial marketing/print use under the
   * applicable ownership or license terms. Do not mark true until that
   * verification has occurred. Not an automated license check, not proof of
   * license by itself, not a renderer/selection control, and not a
   * substitute for provenance.
   */
  commercialPrintOk: boolean
  attribution?: string
  previewSrc?: string
}

/**
 * Beta library. Crew and consequence remain undefined until real files exist.
 * Cluster is eligibility metadata only — not a creative decision.
 */
export const BETA_IMAGERY_LIBRARY: readonly CuratedImageryAsset[] = [
  {
    id: "neighborhood-generic-local",
    eligibleRole: "neighborhood",
    cluster: "generic",
    sourceClass: "curated",
    commercialPrintOk: true,
    previewSrc: "/creative-studio/imagery/stock_generic_local.jpg",
  },
]
