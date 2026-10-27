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
  /**
   * Industry and subject labels used to keep a stand-in off the wrong campaign.
   * A construction label must not satisfy a Medicare brief.
   */
  tags?: readonly string[]
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
 * Beta library. First matching previewSrc per role is the Studio default.
 * Cluster is eligibility metadata only — not a creative decision.
 */
export const BETA_IMAGERY_LIBRARY: readonly CuratedImageryAsset[] = [
  {
    id: "neighborhood-generic-local",
    eligibleRole: "neighborhood",
    cluster: "generic",
    sourceClass: "curated",
    commercialPrintOk: true,
    tags: ["neighborhood", "generic"],
    previewSrc: "/creative-studio/imagery/stock_generic_local.jpg",
  },
  {
    id: "crew-trades-handshake",
    eligibleRole: "crew",
    cluster: "home-services",
    sourceClass: "curated",
    commercialPrintOk: true,
    tags: ["home-services", "construction", "crew"],
    attribution:
      "Pexels — Kindel Media — https://www.pexels.com/photo/female-engineers-doing-a-handshake-8486896/",
    previewSrc: "/creative-studio/imagery/crew_trades_handshake.jpg",
  },
  {
    id: "crew-professional-handshake",
    eligibleRole: "crew",
    cluster: "generic",
    sourceClass: "curated",
    commercialPrintOk: true,
    tags: ["office", "generic"],
    attribution:
      "Pexels — Sora Shimazaki — https://www.pexels.com/photo/group-of-diverse-business-partners-shaking-hands-in-office-5668828/",
    previewSrc: "/creative-studio/imagery/crew_professional_handshake.jpg",
  },
  {
    id: "consequence-ruined-kitchen",
    eligibleRole: "consequence",
    cluster: "home-services",
    sourceClass: "curated",
    commercialPrintOk: true,
    tags: ["home-services", "construction"],
    attribution:
      "Pexels — Ömer Furkan Yakar — https://www.pexels.com/photo/abandoned-ruined-kitchen-17139803/",
    previewSrc: "/creative-studio/imagery/consequence_ruined_kitchen.jpg",
  },
  {
    id: "consequence-destroyed-interior",
    eligibleRole: "consequence",
    cluster: "home-services",
    sourceClass: "curated",
    commercialPrintOk: true,
    tags: ["home-services", "construction"],
    attribution:
      "Pexels — Tom Fisk — https://www.pexels.com/photo/destroyed-house-interior-16863840/",
    previewSrc: "/creative-studio/imagery/consequence_destroyed_interior.jpg",
  },
  {
    id: "medicare-couple-walk",
    eligibleRole: "neighborhood",
    cluster: "generic",
    sourceClass: "curated",
    commercialPrintOk: false,
    tags: ["medicare", "older couple", "walking"],
    attribution: "Studio stand-in for a Medicare campaign. Not a customer's agent and not evidence.",
    previewSrc: "/creative-studio/imagery/medicare-couple-walk.jpg",
  },
  {
    id: "medicare-couple-table",
    eligibleRole: "crew",
    cluster: "generic",
    sourceClass: "curated",
    commercialPrintOk: false,
    tags: ["medicare", "older couple"],
    attribution: "Studio stand-in for a Medicare campaign. Not a customer's agent and not evidence.",
    previewSrc: "/creative-studio/imagery/medicare-couple-table.jpg",
  },
  {
    id: "medicare-couple-garden",
    eligibleRole: "consequence",
    cluster: "generic",
    sourceClass: "curated",
    commercialPrintOk: false,
    tags: ["medicare", "older couple", "garden"],
    attribution: "Studio stand-in for a Medicare campaign. Not a customer's agent and not evidence.",
    previewSrc: "/creative-studio/imagery/medicare-couple-garden.jpg",
  },
  {
    id: "neighborhood-hvac-condenser",
    eligibleRole: "neighborhood",
    cluster: "home-services",
    sourceClass: "curated",
    commercialPrintOk: true,
    tags: ["hvac", "condenser", "furnace"],
    attribution: "Original studio drawing of an outdoor condenser. Not a customer's house.",
    previewSrc: "/creative-studio/imagery/hvac-stand-in.svg",
  },
  {
    id: "crew-hvac-condenser",
    eligibleRole: "crew",
    cluster: "home-services",
    sourceClass: "curated",
    commercialPrintOk: true,
    tags: ["hvac", "condenser", "furnace"],
    attribution: "Original studio drawing of an outdoor condenser. Not a customer's house.",
    previewSrc: "/creative-studio/imagery/hvac-stand-in.svg",
  },
  {
    id: "consequence-hvac-condenser",
    eligibleRole: "consequence",
    cluster: "home-services",
    sourceClass: "curated",
    commercialPrintOk: true,
    tags: ["hvac", "condenser", "furnace"],
    attribution: "Original studio drawing of an outdoor condenser. Not a customer's house.",
    previewSrc: "/creative-studio/imagery/hvac-stand-in.svg",
  },
]
