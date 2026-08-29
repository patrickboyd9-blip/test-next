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

export type LayoutVariant =
  | "offer_hero"
  | "trust_first"
  | "urgency_banner"
  | "photo_led"
  | "minimal_cta"

export type ImageryKey =
  | "stock_hvac"
  | "stock_restaurant"
  | "stock_generic_local"
  | "logo_primary"
  | "none"

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
  /** Current rendered spec for the selected direction. */
  activeSpec?: CreativeSpec
  activeRevisionId?: string
}

export interface Campaign {
  id: string
  ownerId: string
  status: CampaignStatus
  brief: CampaignBrief
  creative: CampaignCreative
  transcript: ConversationMessage[]
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
