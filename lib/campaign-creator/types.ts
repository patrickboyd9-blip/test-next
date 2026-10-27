import type { PaymentClearance } from "@/lib/fulfillment/payment-clearance"
import type { MailOrderRecord } from "@/lib/click2mail/order-record"
import type {
  MailPieceCatalogId,
  MailPieceCatalogVersion,
} from "@/lib/mail-catalog/types"
import type { DesignRationale } from "@/lib/design-intelligence/rationale"
import type { EddmAudience } from "@/lib/eddm/routes"
import type { PostcardTemplateId, VerticalPaletteId } from "@/lib/postcard-layouts/ids"

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

export type AudienceDelivery = "named_list" | "eddm"

export interface AudienceDefinition {
  description: string
  quantity?: number
  /** Omitted on older campaigns. Those stay a named mailing list. */
  delivery?: AudienceDelivery
  eddm?: EddmAudience
}

export interface BusinessInfo {
  name?: string
  website?: string
  phone?: string
  /** Single line, used when a Studio proof prints a return address. */
  address?: string
  street?: string
  city?: string
  state?: string
  postalCode?: string
  socialHandle?: string
  /**
   * USPS Customer Registration ID for this business. Full Service Every Door
   * needs it. Saved here so the customer enters it once.
   */
  uspsCrid?: string
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
  /** Set when the customer has already uploaded a photograph. */
  fileUrl?: string
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
  /**
   * One primary emotion for this campaign. Empty means the art director recommends one.
   * Ids live in lib/design-intelligence/persuasion-emotions.ts.
   */
  primaryEmotion?: string
  /**
   * Schwartz awareness. Omitted means a cold list, which leads with the problem.
   */
  audienceAwareness?: "cold" | "problem_aware" | "solution_aware" | "product_aware" | "past_customer"
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

export const TYPE_ROLES = ["copy", "subject"] as const
export type TypeRole = (typeof TYPE_ROLES)[number]

export const IMAGE_PRESENCES = ["field", "accent"] as const
export type ImagePresence = (typeof IMAGE_PRESENCES)[number]

export const GENERATED_SPEC_TOOL_REQUIRED = [
  "layoutVariant",
  "headline",
  "body",
  "visualDirection",
  "tone",
  "palette",
  "imagery",
  "leadJob",
  "imageryRole",
] as const

export type BackLayout = "standard_address" | "eddm_postal_customer"

export type HeadlinePosition = "beside_photo" | "over_quiet_area" | "on_color_field" | "in_band"
export type ResearchPhotoCrop = "tight" | "open" | "space_for_type"
export type OfferBadge = "none" | "inline" | "band"
export type ColorBlock = "none" | "field" | "band"

/**
 * Positional / emphasis hints for template rendering — not customer-visible.
 * Research layout parameters ride here so the postcard painter can execute them.
 */
export interface LayoutHints {
  headlineScale?: number
  phonePosition?: "default" | "bottom-right"
  qrProminence?: "default" | "large"
  headlinePosition?: HeadlinePosition
  photoCrop?: ResearchPhotoCrop
  offerBadge?: OfferBadge
  colorBlock?: ColorBlock
  /** Original composition painted for this direction. */
  templateId?: PostcardTemplateId
  /** Palette family. The painter checks contrast. */
  verticalPalette?: VerticalPaletteId
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
  /**
   * Job of the type. Omit unless a word or quantity is the visual subject.
   * Omitted means copy. Not a typography-size instruction.
   */
  typeRole?: TypeRole
  /**
   * How the image occupies the family. Omit unless the image is a witness
   * to a type-led piece. Omitted means the family's default. type_only
   * cannot use this field.
   */
  imagePresence?: ImagePresence
  backLayout?: BackLayout
  layoutHints?: LayoutHints
  /**
   * Art-director decision for this card. The painter follows it.
   * The critic score is not stored here.
   */
  designRationale?: DesignRationale
  /**
   * Structure this card was rebuilt from. The id is the source mailer.
   * The tone is the tag that matched. The source art is not on the card.
   */
  blueprint?: {
    sourceId: string
    tone: string
    offerType?: string
    copyPattern?: string
  }
}

export type PhotoToTypeBalance = "photo_led" | "balanced" | "type_led"

/** Concrete composition taken from research notes. Not printed on the mail piece. */
export interface ResearchLayoutParameters {
  headlineScale: number
  headlinePosition: HeadlinePosition
  /** Target share of the front. The layout family paints the real rectangle. */
  photoShare: number
  photoCrop: ResearchPhotoCrop
  offerBadge: OfferBadge
  colorBlock: ColorBlock
}

/** One researched mailer cited on a direction. Customer-facing, short. */
export interface ResearchSource {
  mmrId: string
  title: string
  whyItWorks: string
}

/**
 * Internal craft score. Persisted with the campaign. Never rendered in Studio
 * and never printed. Absent on campaigns saved before this existed.
 */
export interface ResearchQuality {
  /** 0–10, from the postcard rubric plus how closely the layout matches the research. */
  score: number
  rubricPassed: number
  rubricTotal: number
  hierarchy: number
  legibility: number
  offerClarity: number
  photoRelevance: number
  craftResemblance: number
  attempts: number
  notes: string[]
}

/** Which research informed this direction, and why the layout looks this way. */
export interface DirectionResearch {
  sources: ResearchSource[]
  /** One or two friendly sentences. No scores and no QA labels. */
  layoutSummary: string
  parameters: ResearchLayoutParameters
  quality?: ResearchQuality
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
  /**
   * Research citations and the layout reason. Optional so older campaigns load.
   * `quality` on this object is internal and must not be shown.
   */
  research?: DirectionResearch
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

export type DesignSource = "studio" | "upload"

export type DesignFaceName = "front" | "back"

export interface UploadedDesignFile {
  fileName: string
  mediaType: "application/pdf" | "image/png" | "image/jpeg"
  byteLength: number
  /** Storage key, such as `front.png`. Not a public URL. */
  key: string
}

export interface UploadedDesignIssue {
  severity: "error" | "warning"
  code: string
  face: DesignFaceName
  message: string
}

/**
 * Optional feedback on an uploaded design.
 * Declining it does not block approval, and suggestions never edit the file.
 */
export interface UploadedDesignReview {
  declined?: boolean
  /** Three to five suggestions. No scores or grades. */
  suggestions?: string[]
  reviewedAt?: string
}

/** Customer artwork uploaded instead of a Studio direction. */
export interface UploadedDesign {
  front?: UploadedDesignFile
  back?: UploadedDesignFile
  issues: UploadedDesignIssue[]
  checkedAt?: string
  /** Set when the customer approves the proof. */
  approvedAt?: string
  /** Storage key of the print-ready PDF built at approval. */
  printFileKey?: string
  review?: UploadedDesignReview
}

/**
 * How the campaign started.
 * "ai" is the strategy conversation, then three directions.
 * "upload" skips that conversation and Studio.
 * "template" skips that conversation and opens a catalog mailer in Studio.
 * Absent means the campaign predates the start grid and is treated as AI.
 */
export type CampaignEntry = "ai" | "upload" | "template"

export interface Campaign {
  id: string
  ownerId: string
  /** Name the customer gave this campaign. Required on the upload path. */
  name?: string
  /**
   * How the campaign started.
   * "ai" continues through strategy into generated directions.
   * "upload" skips that conversation and Studio.
   * "template" skips that conversation and opens the mailer in Studio.
   * Absent on older campaigns: treat as AI.
   */
  entry?: CampaignEntry
  status: CampaignStatus
  brief: CampaignBrief
  creative: CampaignCreative
  transcript: ConversationMessage[]
  /**
   * How the postcard is designed.
   * "studio" is AI or a template. "upload" is the customer's own art.
   * Absent after strategy means the campaign predates the start grid;
   * the creative step treats that as AI.
   */
  designSource?: DesignSource
  /** Present when designSource is "upload". */
  uploadedDesign?: UploadedDesign
  /** Set at Confirm strategy. Absent on campaigns confirmed before this field existed. */
  mailPieceSpec?: MailPieceSpec
  /**
   * Current approved MailPiece. At most one. Cleared on unapprove.
   * Absent on campaigns approved before this field existed.
   */
  mailPiece?: MailPiece
  /** Immutable approval history. Retained when the current MailPiece is cleared. */
  mailPieceVersions?: MailPiece[]
  /**
   * Latest Click2Mail test (or guarded production) order.
   * Does not change campaign status. Absent until a print test is sent.
   */
  mailOrder?: MailOrderRecord
  mailOrderHistory?: MailOrderRecord[]
  /**
   * Customer payment for this mailing. Absent means unpaid.
   * Click2Mail is not called until status is paid. Checkout on another
   * branch is what writes this.
   */
  payment?: PaymentClearance
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
