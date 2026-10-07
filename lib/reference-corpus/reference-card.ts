/**
 * Prompt-safe Reference Card.
 *
 * A card is a curated reading of one modern-mail-research example.
 * It is not the raw markdown, not a CreativeSpec, and not customer art.
 * Specimen photographs, logos, and trademarks stay out of this object.
 *
 * Research lives in patrickboyd9-blip/modern-mail-research (read-only).
 * `mmrId` is the citation back to that repo. This module does not fetch it.
 */

export const REFERENCE_CARD_FORMATS = ["postcard"] as const
export type ReferenceCardFormat = (typeof REFERENCE_CARD_FORMATS)[number]

export const REFERENCE_CARD_CONFIDENCE = ["high", "medium", "low"] as const
export type ReferenceCardConfidence = (typeof REFERENCE_CARD_CONFIDENCE)[number]

/**
 * Closed verticals in the curated pack.
 * Adjacent exterior trades are included only when the research record
 * had observed composition notes the named trades lacked.
 */
export const REFERENCE_CARD_VERTICALS = [
  "hvac",
  "plumbing",
  "electrical",
  "roofing",
  "pest",
  "landscaping",
  "exterior_cleaning",
  "foundation",
  "chimney",
  "dental",
  "med_spa",
  "chiropractic",
  "physical_therapy",
  "restaurant",
  "pizza_qsr",
  "fitness",
  "jewelry",
  "remodeling",
] as const
export type ReferenceCardVertical = (typeof REFERENCE_CARD_VERTICALS)[number]

export const REFERENCE_CARD_PACK_GROUPS = [
  "home_services",
  "local_healthcare",
  "hospitality",
  "craft_exemplar",
] as const
export type ReferenceCardPackGroup = (typeof REFERENCE_CARD_PACK_GROUPS)[number]

export interface ReferenceCard {
  /** Research id, e.g. MMR-001. Citation only — not a slogan. */
  mmrId: string
  vertical: ReferenceCardVertical
  format: ReferenceCardFormat
  /** Observed trim when the record states it. Null when the record says unknown. */
  dimensions: string | null
  /** Three to seven generalized principles. No brand names, no measured results. */
  principles: readonly string[]
  compositionNotes: string
  imageryNotes: string
  ctaNotes: string
  whyItWorks: string
  /**
   * Locator for a research-only photograph, if one already exists with
   * research-only rights. Never a customer-art source. The curated pack
   * ships none: the research repo has no assets directory.
   */
  researchOnlyPhotoPointer?: string
  confidence: ReferenceCardConfidence
  /**
   * Which approved mix this card fills.
   * Craft exemplars keep their own vertical so a jewelry brief can match
   * them, and other briefs can still use them as a quality bar.
   */
  packGroup: ReferenceCardPackGroup
}

const MMR_ID = /^MMR-\d+$/

export function assertReferenceCard(card: ReferenceCard): void {
  if (!MMR_ID.test(card.mmrId)) {
    throw new Error(`Reference card has an invalid mmrId: ${card.mmrId}`)
  }
  if (!(REFERENCE_CARD_VERTICALS as readonly string[]).includes(card.vertical)) {
    throw new Error(`Reference card ${card.mmrId} has an invalid vertical.`)
  }
  if (card.format !== "postcard") {
    throw new Error(`Reference card ${card.mmrId} must be a postcard.`)
  }
  if (card.dimensions !== null && !card.dimensions.trim()) {
    throw new Error(`Reference card ${card.mmrId} has an empty dimensions string.`)
  }
  if (card.principles.length < 3 || card.principles.length > 7) {
    throw new Error(
      `Reference card ${card.mmrId} must have 3–7 principles (has ${card.principles.length}).`
    )
  }
  for (const principle of card.principles) {
    if (!principle.trim()) {
      throw new Error(`Reference card ${card.mmrId} has an empty principle.`)
    }
  }
  for (const field of [
    card.compositionNotes,
    card.imageryNotes,
    card.ctaNotes,
    card.whyItWorks,
  ]) {
    if (!field.trim()) {
      throw new Error(`Reference card ${card.mmrId} is missing a required note.`)
    }
  }
  if (!(REFERENCE_CARD_CONFIDENCE as readonly string[]).includes(card.confidence)) {
    throw new Error(`Reference card ${card.mmrId} has an invalid confidence.`)
  }
  if (!(REFERENCE_CARD_PACK_GROUPS as readonly string[]).includes(card.packGroup)) {
    throw new Error(`Reference card ${card.mmrId} has an invalid pack group.`)
  }
  if (card.researchOnlyPhotoPointer?.trim()) {
    throw new Error(
      `Reference card ${card.mmrId} must not carry a photo pointer. No research-only asset is cleared for this pack.`
    )
  }
}
