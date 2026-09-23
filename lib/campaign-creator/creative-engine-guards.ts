import type {
  GenerateDirectionsResult,
  RefineDirectionInput,
  RefineDirectionResult,
} from "./creative-engine"
import { metricUsesPhone, metricUsesQr } from "./creative-state"
import {
  buildPreservationNote,
  buildSpecDiff,
  buildSuccessStudioResponse,
  cloneSpec,
} from "./spec-diff"
import {
  conflictCopyAmbiguous,
  conflictCopyGeneric,
  conflictCopyOffer,
  conflictCopyPhone,
  conflictCopyQr,
  conflictCopyUnrecognized,
  RECOMMENDATION_HEADLINE,
} from "./studio-copy"
import {
  IMAGE_PRESENCES,
  IMAGERY_ROLES,
  LAYOUT_VARIANTS,
  LEAD_JOBS,
  TYPE_ROLES,
  normalizeLayoutVariant,
  type CampaignBrief,
  type CreativeDirection,
  type CreativeSpec,
  type ImagePresence,
  type ImageryKey,
  type ImageryRole,
  type LayoutVariant,
  type LeadJob,
  type TypeRole,
} from "./types"

const IMAGERY_KEYS: readonly ImageryKey[] = [
  "stock_hvac",
  "stock_restaurant",
  "stock_generic_local",
  "logo_primary",
  "none",
]

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const BANNED_PHRASING: RegExp[] = [
  /\bas an ai\b/i,
  /\blanguage model\b/i,
  /\bclaude\b/i,
  /\banthropic\b/i,
  /\bi(?:'ve| have) generated\b/i,
  /\bgenerated for you\b/i,
  /\btool call\b/i,
  /\bfunction call\b/i,
  /\bschema\b/i,
  /\btokens?\b/i,
  /\bthe prompt\b/i,
  /\byour prompt\b/i,
  /\bAI\b/,
]

export class CreativeGenerationInvalidError extends Error {
  constructor(public readonly reasons: string[]) {
    super(`Creative generation result is invalid: ${reasons.join("; ")}`)
    this.name = "CreativeGenerationInvalidError"
  }
}

export function containsBannedPhrasing(text: string): boolean {
  return BANNED_PHRASING.some((pattern) => pattern.test(text))
}

/**
 * Rejects unsupported causal performance claims in CreativeDirection.rationale.
 * Strategic framing language is allowed.
 */
const UNSUPPORTED_PERFORMANCE_CLAIMS: RegExp[] = [
  /\bguaranteed?\s+(conversion|conversions|bookings?|results?|lift|roi|response)\b/i,
  /\bguaranteed?\s+to\s+(convert|book|outperform|increase|lift)\b/i,
  /\b(will|won't|would)\s+(outperform|convert|book)\b/i,
  /\b(will|won't|would)\s+convert\s+better\b/i,
  /\b(outperform|outperforms|outperformed|outperforming)\b/i,
  /\bconvert(?:s|ed|ing)?\s+better\b/i,
  /\bbetter\s+conversion\b/i,
  /\b(higher|greater|better)\s+(response|conversion|roi|lift)\b/i,
  /\b\d+(?:\.\d+)?\s*%\s*(lift|increase|higher|more|roi|response|conversion|bookings?)\b/i,
  /\b(?:lift|increase)\s+of\s+\d+/i,
  /\b\d+(?:\.\d+)?x\s+(more|better|higher|lift|response|conversion|bookings?)\b/i,
  /\b(?:roi|return on investment)\b/i,
  /\bwill\s+drive\s+(?:more\s+)?(?:bookings?|conversions?|sales|calls|results)\b/i,
  /\bwill\s+(?:generate|produce|deliver)\s+(?:more\s+)?(?:bookings?|conversions?|sales|roi|lift)\b/i,
]

export function rationaleHasUnsupportedPerformanceClaim(text: string): boolean {
  return UNSUPPORTED_PERFORMANCE_CLAIMS.some((pattern) => pattern.test(text))
}

export function sanitizeStudioResponse(text: string, fallback: string): string {
  const trimmed = text.trim()
  if (!trimmed || containsBannedPhrasing(trimmed)) return fallback
  return trimmed
}

export function detectAmbiguousPrompt(prompt: string): boolean {
  const normalized = prompt.trim().toLowerCase()
  if (!normalized) return false
  const isVague =
    /\b(make it better|better\b|improve(?: it)?)\b/.test(normalized) &&
    !/\b(headline|color|warmer|bigger|qr|phone|offer|border|logo)\b/.test(normalized)
  return isVague
}

/** Intent-level conflicts that must not wait on the model. */
export function detectPromptConflict(
  brief: CampaignBrief,
  prompt: string
): RequiredElementConflict | "ambiguous" | null {
  if (detectAmbiguousPrompt(prompt)) return "ambiguous"

  const normalized = prompt.trim().toLowerCase()
  if (
    /\b(remove|delete|hide)\b.*\b(qr|code)\b/.test(normalized) &&
    metricUsesQr(brief)
  ) {
    return "qr"
  }
  if (
    /\b(remove|delete|hide)\b.*\b(phone|number)\b/.test(normalized) &&
    metricUsesPhone(brief)
  ) {
    return "phone"
  }
  if (
    /\b(remove|delete|hide)\b.*\b(offer|discount)\b/.test(normalized) &&
    Boolean(brief.offer)
  ) {
    return "offer"
  }
  return null
}

export function applyFaithfulness(brief: CampaignBrief, spec: CreativeSpec): CreativeSpec {
  const next = cloneSpec(spec)
  const phone = brief.phone ?? brief.businessInfo?.phone
  const website = brief.website ?? brief.businessInfo?.website
  const qr = brief.qrDestination ?? website

  if (brief.offer && !next.offer?.trim()) next.offer = brief.offer
  if (phone && !next.phone?.trim()) next.phone = phone
  if (website && !next.website?.trim()) next.website = website
  if (qr && !next.qrDestination?.trim()) next.qrDestination = qr
  if (brief.emotionalTone && !next.tone) next.tone = brief.emotionalTone

  delete next.format
  delete next.backLayout
  return next
}

/** Drop phone/offer/website the brief never provided. Does not invent replacements. */
export function stripInventedFacts(brief: CampaignBrief, spec: CreativeSpec): CreativeSpec {
  const next = cloneSpec(spec)
  const briefPhone = brief.phone ?? brief.businessInfo?.phone
  const briefWebsite = brief.website ?? brief.businessInfo?.website
  const briefQr = brief.qrDestination ?? briefWebsite

  if (!brief.offer) delete next.offer
  if (!briefPhone) delete next.phone
  if (!briefWebsite) delete next.website
  if (!briefQr) delete next.qrDestination
  return next
}

export type RequiredElementConflict = "qr" | "phone" | "offer"

export function detectRemovedRequired(
  brief: CampaignBrief,
  before: CreativeSpec,
  after: CreativeSpec
): RequiredElementConflict | null {
  if (metricUsesQr(brief) && hadQrPath(before) && !hadQrPath(after)) return "qr"
  if (metricUsesPhone(brief) && hadPhone(before) && !hadPhone(after)) return "phone"
  if (brief.offer && hadOffer(before) && !hadOffer(after)) return "offer"
  return null
}

function hadQrPath(spec: CreativeSpec): boolean {
  return Boolean(
    spec.qrDestination ||
      /\b(qr|scan)\b/i.test(spec.callToAction ?? "") ||
      /\b(qr|scan)\b/i.test(spec.body ?? "")
  )
}

function hadPhone(spec: CreativeSpec): boolean {
  return Boolean(spec.phone?.trim())
}

function hadOffer(spec: CreativeSpec): boolean {
  return Boolean(spec.offer?.trim())
}

export function conflictMessage(
  type: RequiredElementConflict | "ambiguous" | "unrecognized" | "generic",
  brief: CampaignBrief
): string {
  switch (type) {
    case "qr":
      return conflictCopyQr(brief)
    case "phone":
      return conflictCopyPhone()
    case "offer":
      return conflictCopyOffer()
    case "ambiguous":
      return conflictCopyAmbiguous()
    case "unrecognized":
      return conflictCopyUnrecognized()
    case "generic":
      return conflictCopyGeneric(brief)
  }
}

export function currentSpecFromInput(input: RefineDirectionInput): CreativeSpec {
  const latest = input.revisions
    .filter(
      (revision) =>
        revision.directionId === input.direction.id && revision.version !== null
    )
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
  return latest?.spec ?? input.direction.spec
}

export function finalizeRefinement(input: {
  brief: CampaignBrief
  directionId: string
  currentSpec: CreativeSpec
  prompt: string
  proposed: {
    outcome: "success" | "conflict"
    spec?: CreativeSpec
    studioResponse?: string
  }
}): RefineDirectionResult {
  const prompt = input.prompt.trim()
  const currentSpec = cloneSpec(input.currentSpec)

  const promptConflict = detectPromptConflict(input.brief, prompt)
  if (promptConflict) {
    return buildConflictResult(
      input.directionId,
      currentSpec,
      prompt,
      conflictMessage(promptConflict, input.brief)
    )
  }

  if (input.proposed.outcome === "conflict") {
    return buildConflictResult(
      input.directionId,
      currentSpec,
      prompt,
      sanitizeStudioResponse(
        input.proposed.studioResponse ?? "",
        conflictMessage("generic", input.brief)
      )
    )
  }

  if (!input.proposed.spec) {
    return buildConflictResult(
      input.directionId,
      currentSpec,
      prompt,
      conflictMessage("unrecognized", input.brief)
    )
  }

  const spec = preserveCreativeSemantics(
    currentSpec,
    applyFaithfulness(input.brief, input.proposed.spec)
  )
  const removed = detectRemovedRequired(input.brief, currentSpec, spec)
  if (removed) {
    return buildConflictResult(
      input.directionId,
      currentSpec,
      prompt,
      conflictMessage(removed, input.brief)
    )
  }

  const specDiff = buildSpecDiff(currentSpec, spec)
  const preserved: string[] = []
  if (!specDiff.changedRegions.includes("callToAction") && spec.callToAction) {
    preserved.push("QR code")
  }
  if (!specDiff.changedRegions.includes("offer") && spec.offer) {
    preserved.push("offer")
  }
  const fallback = buildSuccessStudioResponse(
    specDiff,
    buildPreservationNote(preserved)
  )

  return {
    spec,
    revision: {
      directionId: input.directionId,
      version: 0,
      spec,
      customerPrompt: prompt,
      studioResponse: sanitizeStudioResponse(
        input.proposed.studioResponse ?? "",
        fallback
      ),
      type: "refinement",
      specDiff,
    },
  }
}

function buildConflictResult(
  directionId: string,
  currentSpec: CreativeSpec,
  prompt: string,
  studioResponse: string
): RefineDirectionResult {
  return {
    spec: currentSpec,
    revision: {
      directionId,
      version: null,
      spec: cloneSpec(currentSpec),
      customerPrompt: prompt,
      studioResponse,
      type: "conflict",
    },
    conflict: { message: studioResponse },
  }
}

export function normalizeGenerationResult(
  brief: CampaignBrief,
  directions: CreativeDirection[],
  options: { stripInventedFacts: boolean }
): GenerateDirectionsResult {
  const now = new Date().toISOString()
  const normalized = directions.map((direction) =>
    normalizeDirection(brief, direction, now, options.stripInventedFacts)
  )

  const reasons = validateGenerationSet(brief, normalized)
  if (reasons.length > 0) {
    throw new CreativeGenerationInvalidError(reasons)
  }

  const lead = normalized.find((direction) => direction.recommended) ?? normalized[0]

  return {
    directions: normalized,
    recommendation: {
      directionId: lead.id,
      headline: RECOMMENDATION_HEADLINE,
      rationale: lead.rationale,
    },
    recommendedDirectionId: lead.id,
  }
}

function normalizeDirection(
  brief: CampaignBrief,
  direction: CreativeDirection,
  createdAt: string,
  shouldStripInvented: boolean
): CreativeDirection {
  let spec = applyFaithfulness(brief, direction.spec)
  if (shouldStripInvented) {
    spec = stripInventedFacts(brief, spec)
  }
  spec = normalizeSpecEnums(spec)

  const designedToDrive =
    direction.designedToDrive.trim() ||
    brief.primarySuccessMetric?.description ||
    brief.desiredRecipientAction ||
    "your campaign goal"

  return {
    ...direction,
    id: crypto.randomUUID(),
    name: direction.name.trim(),
    rationale: sanitizeStudioResponse(
      direction.rationale,
      `A strong direction for ${designedToDrive}.`
    ),
    tags: (direction.tags ?? []).map((tag) => tag.trim()).filter(Boolean).slice(0, 3),
    designedToDrive,
    oneLineDifference: direction.recommended
      ? undefined
      : direction.oneLineDifference?.trim(),
    spec,
    createdAt,
  }
}

function preserveCreativeSemantics(
  current: CreativeSpec,
  proposed: CreativeSpec
): CreativeSpec {
  const next = cloneSpec(proposed)
  if (!isLeadJob(next.leadJob) && isLeadJob(current.leadJob)) {
    next.leadJob = current.leadJob
  }
  if (!isImageryRole(next.imageryRole) && isImageryRole(current.imageryRole)) {
    next.imageryRole = current.imageryRole
  }
  if (!isTypeRole(next.typeRole) && isTypeRole(current.typeRole)) {
    next.typeRole = current.typeRole
  }
  if (!isImagePresence(next.imagePresence) && isImagePresence(current.imagePresence)) {
    next.imagePresence = current.imagePresence
  }
  return next
}

function normalizeSpecEnums(spec: CreativeSpec): CreativeSpec {
  const next = cloneSpec(spec)
  const layoutVariant = normalizeLayoutVariant(next.layoutVariant)
  if (layoutVariant) {
    next.layoutVariant = layoutVariant
  } else {
    delete next.layoutVariant
  }
  if (next.imagery && !isImageryKey(next.imagery)) {
    delete next.imagery
  }
  if (next.leadJob && !isLeadJob(next.leadJob)) {
    delete next.leadJob
  }
  if (next.imageryRole && !isImageryRole(next.imageryRole)) {
    delete next.imageryRole
  }
  if (next.typeRole && !isTypeRole(next.typeRole)) {
    delete next.typeRole
  }
  if (next.imagePresence && !isImagePresence(next.imagePresence)) {
    delete next.imagePresence
  }
  if (next.palette) {
    const colors = next.palette.filter((color) => HEX_COLOR.test(color))
    if (colors.length === 0) {
      delete next.palette
    } else {
      while (colors.length < 3) {
        colors.push(colors[colors.length - 1])
      }
      next.palette = colors.slice(0, 3)
    }
  }
  return next
}

export function validateGenerationSet(
  brief: CampaignBrief,
  directions: CreativeDirection[]
): string[] {
  const reasons: string[] = []

  if (directions.length !== 3) {
    reasons.push(`expected 3 directions, received ${directions.length}`)
  }

  const recommendedCount = directions.filter((direction) => direction.recommended).length
  if (recommendedCount !== 1) {
    reasons.push(`expected exactly one recommended direction, received ${recommendedCount}`)
  }

  const variants = new Set(
    directions.map((direction) => direction.spec.layoutVariant).filter(Boolean)
  )
  if (variants.size < 2) {
    reasons.push("expected at least 2 distinct layout variants")
  }

  const headlines = directions.map((direction) =>
    (direction.spec.headline ?? "").trim().toLowerCase()
  )
  const rationales = directions.map((direction) => direction.rationale.trim().toLowerCase())
  if (new Set(headlines).size < directions.length) {
    reasons.push("headlines are not distinct")
  }
  if (new Set(rationales).size < directions.length) {
    reasons.push("rationales are not distinct")
  }

  for (const [index, direction] of directions.entries()) {
    reasons.push(...validateDirection(brief, direction, index))
  }

  return reasons
}

function validateDirection(
  brief: CampaignBrief,
  direction: CreativeDirection,
  index: number
): string[] {
  const reasons: string[] = []
  const label = `direction ${index + 1}`
  const spec = direction.spec
  const wordCount = (value: string | undefined) =>
    (value ?? "").trim().split(/\s+/).filter(Boolean).length

  if (!direction.name.trim()) reasons.push(`${label} is missing a name`)
  if (wordCount(direction.name) < 2 || wordCount(direction.name) > 4) {
    reasons.push(`${label} name must be 2–4 words`)
  }
  if (!direction.rationale.trim()) {
    reasons.push(`${label} is missing a rationale`)
  } else if (rationaleHasUnsupportedPerformanceClaim(direction.rationale)) {
    reasons.push(
      `${label} rationale makes an unsupported performance claim (conversion, bookings, lift, ROI, or outperformance). Explain the strategic difference only; do not claim measured or predicted results.`
    )
  }
  if ((direction.tags ?? []).length !== 3) {
    reasons.push(`${label} must have exactly 3 tags`)
  }
  if (!direction.recommended && !direction.oneLineDifference?.trim()) {
    reasons.push(`${label} is missing oneLineDifference`)
  }

  if (!spec.headline?.trim()) reasons.push(`${label} is missing a headline`)
  if (!spec.body?.trim()) reasons.push(`${label} is missing body copy`)
  if (!spec.callToAction?.trim()) reasons.push(`${label} is missing a call to action`)
  if (!spec.visualDirection?.trim()) reasons.push(`${label} is missing visualDirection`)
  if (!spec.tone?.trim()) reasons.push(`${label} is missing tone`)
  if (!spec.layoutVariant || !isLayoutVariant(spec.layoutVariant)) {
    reasons.push(`${label} has an invalid layoutVariant`)
  }
  if (!spec.imagery || !isImageryKey(spec.imagery)) {
    reasons.push(`${label} has an invalid imagery key`)
  }
  if (!spec.leadJob || !isLeadJob(spec.leadJob)) {
    reasons.push(
      `${label} is missing a valid leadJob (offer, problem, trust, or urgency)`
    )
  }
  if (!spec.imageryRole || !isImageryRole(spec.imageryRole)) {
    reasons.push(
      `${label} is missing a valid imageryRole (consequence, neighborhood, crew, logo, or none)`
    )
  }
  if (spec.typeRole !== undefined && !isTypeRole(spec.typeRole)) {
    reasons.push(`${label} has an invalid typeRole (copy or subject)`)
  }
  if (spec.imagePresence !== undefined && !isImagePresence(spec.imagePresence)) {
    reasons.push(`${label} has an invalid imagePresence (field or accent)`)
  }
  reasons.push(...validateSemanticJobs(label, spec))
  if (!spec.palette || spec.palette.length !== 3 || spec.palette.some((c) => !HEX_COLOR.test(c))) {
    reasons.push(`${label} palette must be 3 hex colors`)
  }

  if (brief.offer && !spec.offer?.trim()) {
    reasons.push(`${label} is missing the brief offer`)
  }
  const phone = brief.phone ?? brief.businessInfo?.phone
  if (phone && !spec.phone?.trim()) reasons.push(`${label} is missing the brief phone`)
  const website = brief.website ?? brief.businessInfo?.website
  if (website && !spec.website?.trim()) reasons.push(`${label} is missing the brief website`)
  const qr = brief.qrDestination ?? website
  if (qr && !spec.qrDestination?.trim()) {
    reasons.push(`${label} is missing the brief QR destination`)
  }

  return reasons
}

function isLayoutVariant(value: string): value is LayoutVariant {
  return (LAYOUT_VARIANTS as readonly string[]).includes(value)
}

function isImageryKey(value: string): value is ImageryKey {
  return (IMAGERY_KEYS as readonly string[]).includes(value)
}

export function isLeadJob(value: string | undefined): value is LeadJob {
  return Boolean(value && (LEAD_JOBS as readonly string[]).includes(value))
}

export function isImageryRole(value: string | undefined): value is ImageryRole {
  return Boolean(value && (IMAGERY_ROLES as readonly string[]).includes(value))
}

export function isTypeRole(value: string | undefined): value is TypeRole {
  return Boolean(value && (TYPE_ROLES as readonly string[]).includes(value))
}

export function isImagePresence(value: string | undefined): value is ImagePresence {
  return Boolean(value && (IMAGE_PRESENCES as readonly string[]).includes(value))
}

function validateSemanticJobs(label: string, spec: CreativeSpec): string[] {
  const reasons: string[] = []
  const layout = normalizeLayoutVariant(spec.layoutVariant)
  const typeRole = isTypeRole(spec.typeRole) ? spec.typeRole : undefined
  const imagePresence = isImagePresence(spec.imagePresence)
    ? spec.imagePresence
    : undefined

  if (!layout || (!typeRole && !imagePresence)) return reasons

  if (layout === "type_only" && imagePresence) {
    reasons.push(`${label} type_only cannot include imagePresence`)
  }
  if (layout === "image_grounded" && imagePresence === "accent") {
    reasons.push(`${label} image_grounded cannot use imagePresence accent`)
  }
  if (layout === "peer_split" && imagePresence === "accent") {
    reasons.push(`${label} peer_split cannot use imagePresence accent`)
  }
  if (layout === "image_grounded" && typeRole === "subject") {
    reasons.push(`${label} image_grounded cannot use typeRole subject`)
  }

  return reasons
}
