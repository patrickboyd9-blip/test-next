import type {
  MailPieceCatalogId,
  MailPieceCatalogVersion,
} from "@/lib/mail-catalog/types"

export type FormatRecommendationSource = "catalog_default" | "playbook"

export interface MailPieceFormatRecommendation {
  catalogId: MailPieceCatalogId
  catalogVersion: MailPieceCatalogVersion
  rationale: string
  source: FormatRecommendationSource
}

export interface CampaignStrategy {
  audience: string
  offer: string
  formatRecommendation: MailPieceFormatRecommendation
  cadence: string
  messaging: string[]
  callToAction: string
  successMetrics: string[]
  assumptions: string[]
}
