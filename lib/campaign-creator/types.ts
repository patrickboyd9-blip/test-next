import type {
  MailPieceCatalogId,
  MailPieceCatalogVersion,
} from "@/lib/mail-catalog/types"

export type CampaignStatus =
  | "draft"
  | "strategy_confirmed"
  | "generating_creative"
  | "creative_ready"
  | "creative_approved"
  | "audience_confirmed"
  | "quantity_confirmed"
  | "launched"

export type ConversationRole = "customer" | "assistant" | "system"

export interface ConversationMessage {
  id: string
  role: ConversationRole
  content: string
  createdAt: string
}

export type PrimarySuccessMetricType =
  | "appointment"
  | "phone_call"
  | "qr_scan"
  | "coupon_redemption"
  | "website_visit"
  | "purchase"
  | "form_submission"
  | "event_registration"
  | "physical_visit"
  | "delivery"
  | "donation"
  | "other"

export interface PrimarySuccessMetric {
  type: PrimarySuccessMetricType
  description?: string
}

export interface AudienceDefinition {
  description: string
  quantity?: number
}

export interface BusinessInfo {
  name?: string
  website?: string
  phone?: string
  address?: string
  socialHandle?: string
}

/**
 * Represents a creative asset the customer wants included, by description only.
 * `fileUrl`/`fileId` can be added here once upload/storage exists — callers
 * already treat this as a list of asset records, not a list of strings.
 */
export interface BrandAsset {
  id: string
  type: "logo" | "photo" | "graphic" | "coupon" | "other"
  description: string
}

export interface CampaignBrief {
  goal?: string
  desiredRecipientAction?: string
  primarySuccessMetric?: PrimarySuccessMetric
  supportingMetrics?: string[]
  audience?: AudienceDefinition
  businessInfo?: BusinessInfo
  brandAssets?: BrandAsset[]
  emotionalTone?: string
  offer?: string
  qrDestination?: string
  phone?: string
  website?: string
  otherRequirements?: string
}

export type MailFormat = "postcard_4x6"

export const LAYOUT_VARIANTS = [
  "type_primary_split",
  "peer_split",
  "banded_split",
  "image_grounded",
  "type_only",
] as const
export type LayoutVariant = (typeof LAYOUT_VARIANTS)[number]

/** Read-side aliases for persisted CreativeSpecs that still use the former tokens. */
export const LEGACY_LAYOUT_VARIANTS = {
  offer_hero: "type_primary_split",
  trust_first: "peer_split",
  urgency_banner: "banded_split",
  photo_led: "image_grounded",
  minimal_cta: "type_only",
} as const satisfies Record<string, LayoutVariant>

export function normalizeLayoutVariant(
  value: string | undefined
): LayoutVariant | undefined {
  if (!value) return undefined
  if ((LAYOUT_VARIANTS as readonly string[]).includes(value)) {
    return value as LayoutVariant
  }
  if (value in LEGACY_LAYOUT_VARIANTS) {
    return LEGACY_LAYOUT_VARIANTS[value as keyof typeof LEGACY_LAYOUT_VARIANTS]
  }
  return undefined
}

export type ImageryKey =
  | "stock_hvac"
  | "stock_restaurant"
  | "stock_generic_local"
  | "logo_primary"
  | "none"

export const LEAD_JOBS = ["offer", "problem", "trust", "urgency"] as const
export type LeadJob = (typeof LEAD_JOBS)[number]

export const IMAGERY_ROLES = [
  "consequence",
  "neighborhood",
  "crew",
  "logo",
  "none",
] as const
export type ImageryRole = (typeof IMAGERY_ROLES)[number]

export const GENERATED_SPEC_TOOL_REQUIRED = [
  "layoutVariant",
  "headline",
  "body",
  "callToAction",
  "visualDirection",
  "tone",
  "palette",
  "imagery",
  "leadJob",
  "imageryRole",
] as const

export type BackLayout = "standard_address"

/** Positional / emphasis hints for template rendering — not customer-visible. */
export interface LayoutHints {
  headlineScale?: number
  phonePosition?: "default" | "bottom-right"
  qrProminence?: "default" | "large"
}

export interface SpecDiffChange {
  field: string
  before: string
  after: string
  label: string
}

export interface SpecDiff {
  /** Spec keys whose values changed (for highlight + AI). */
  changedRegions: string[]
  /** Human-readable before/after pairs for studio copy and v0.4.0 AI. */
  changes: SpecDiffChange[]
}

/**
 * Structured creative content rendered into mail-piece previews.
 * Fields expand as the template system is built — keep serializable.
 */
export interface CreativeSpec {
  format?: MailFormat
  layoutVariant?: LayoutVariant
  headline?: string
  subheadline?: string
  body?: string
  callToAction?: string
  offer?: string
  phone?: string
  website?: string
  qrDestination?: string
  visualDirection?: string
  tone?: string
  palette?: string[]
  imagery?: ImageryKey
  /** Primary creative job this piece leads with. Not an offer and not a campaign fact. */
  leadJob?: LeadJob
  /** Job the image should perform. Not a file, URL, crop, or photograph. */
  imageryRole?: ImageryRole
  backLayout?: BackLayout
  layoutHints?: LayoutHints
}

/** A distinct creative direction presented to the customer for selection. */
export interface CreativeDirection {
  id: string
  name: string
  rationale: string
  /** One-line strategic difference for non-lead concepts (compare view). */
  oneLineDifference?: string
  /** Customer-language Primary Success Metric line. */
  designedToDrive: string
  tags: string[]
  spec: CreativeSpec
  /** True for the lead concept Modern Mail recommends first. */
  recommended: boolean
  createdAt: string
}

export type CreativeRevisionType = "refinement" | "restore" | "conflict"

/** A single refinement iteration on a selected direction. */
export interface CreativeRevision {
  id: string
  directionId: string
  /** Sequential per direction; null for conflict entries (no version bump). */
  version: number | null
  spec: CreativeSpec
  customerPrompt: string
  studioResponse: string
  type: CreativeRevisionType
  specDiff?: SpecDiff
  createdAt: string
}

/** Editorial recommendation metadata for a direction — separate from the direction itself. */
export interface CreativeRecommendation {
  directionId: string
  headline: string
  rationale: string
}

/** Creative state carried on the campaign through generation, selection, and approval. */
export interface CampaignCreative {
  directions: CreativeDirection[]
  recommendation?: CreativeRecommendation
  recommendedDirectionId?: string
  selectedDirectionId?: string
  revisions: CreativeRevision[]
  approvedRevisionId?: string
  /** Spec snapshot frozen at approval — source of truth for print/mail handoff. */
  approvedSpec?: CreativeSpec
  /** Current rendered spec for the selected direction. */
  activeSpec?: CreativeSpec
  activeRevisionId?: string
}

export type AddressFaceAuthorship = "customer" | "fulfillment"

/**
 * Campaign-specific physical mail-piece decision.
 * Catalog versions remain the source of physical/production constraints.
 */
export interface MailPieceSpec {
  recommendedCatalogId: MailPieceCatalogId
  recommendedCatalogVersion: MailPieceCatalogVersion
  selectedCatalogId: MailPieceCatalogId
  selectedCatalogVersion: MailPieceCatalogVersion
  customerOverride: boolean
  decidedAt: string
  /** Campaign owner at confirmation — existing ownerId, not a new user model. */
  decidedBy: string
  /**
   * Who authors the address/mailing face. Write-once at Confirm strategy.
   * Beta default is platform-selected `"fulfillment"`. Not copied onto MailPiece.
   */
  addressFaceAuthorship: AddressFaceAuthorship
}

/**
 * Immutable vendor-neutral approved artifact.
 * Binds MailPieceSpec's selected catalog version to an approved CreativeSpec snapshot.
 * Not a physical spec, canvas, PDF, ProductionDocument, or vendor job.
 */
export interface MailPiece {
  id: string
  version: number
  approvedAt: string
  directionId: string
  revisionId: string
  catalogId: MailPieceCatalogId
  catalogVersion: MailPieceCatalogVersion
  spec: CreativeSpec
}

/**
 * Closed physical-face authorship for one ProductionDocument.
 * Not a generic pages array. Not MailPieceSpec.addressFaceAuthorship.
 */
export interface ProductionDocumentFaces {
  front: AddressFaceAuthorship
  back: AddressFaceAuthorship
}

/**
 * Vendor-neutral manufacturable interpretation of one immutable MailPiece.
 * Derived at production, not at approval. Not a PDF, canvas, or vendor job.
 */
export interface ProductionDocument {
  id: string
  mailPieceId: string
  mailPieceVersion: number
  catalogId: MailPieceCatalogId
  catalogVersion: MailPieceCatalogVersion
  faces: ProductionDocumentFaces
  derivedAt: string
}

export interface Campaign {
  id: string
  ownerId: string
  status: CampaignStatus
  brief: CampaignBrief
  creative: CampaignCreative
  transcript: ConversationMessage[]
  /** Set at Confirm strategy. Absent on campaigns confirmed before this field existed. */
  mailPieceSpec?: MailPieceSpec
  /**
   * Current approved MailPiece. At most one. Cleared on unapprove.
   * Absent on campaigns approved before this field existed.
   */
  mailPiece?: MailPiece
  /** Immutable approval history. Retained when the current MailPiece is cleared. */
  mailPieceVersions?: MailPiece[]
  /** Internal signal only — never surfaced to the customer as a score. */
  readyForBriefReview: boolean
  createdAt: string
  updatedAt: string
}

export function createEmptyCampaignCreative(): CampaignCreative {
  return {
    directions: [],
    revisions: [],
  }
}
