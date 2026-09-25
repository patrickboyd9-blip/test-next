/**
 * Raw reference evidence. Not CreativeSpec, not Creative Intelligence,
 * not a Gallery item, and not a campaign record.
 *
 * Acquisition source is metadata. It does not change the item shape.
 * Grok research lives in patrickboyd9-blip/modern-mail-research.
 * This type is an application-side intake handle, not a copy of that repo.
 */

export const REFERENCE_SOURCE_CLASSES = [
  "grok_research",
  "physical_mailer",
] as const
export type ReferenceSourceClass = (typeof REFERENCE_SOURCE_CLASSES)[number]

export const REFERENCE_MEDIA_ROLES = ["front", "back", "detail"] as const
export type ReferenceMediaRole = (typeof REFERENCE_MEDIA_ROLES)[number]

/**
 * One photograph or visual attached to a corpus item.
 * src is a locator only — not a renderer path and not a CreativeSpec field.
 */
export interface ReferenceMedia {
  id: string
  role: ReferenceMediaRole
  src: string
}

/**
 * Minimal acquisition provenance. Optional fields may be filled by either
 * source class. Source class must not require a different provenance shape.
 */
export interface ReferenceProvenance {
  acquiredBy?: string
  note?: string
  locator?: string
  researchId?: string
  recordPath?: string
}

export interface ReferenceMediaSet {
  front?: ReferenceMedia
  back?: ReferenceMedia
  details?: readonly ReferenceMedia[]
}

/**
 * One persisted Reference Corpus item.
 * Grok-researched mailers and physical mailers share this representation.
 */
export interface ReferenceCorpusItem {
  id: string
  sourceClass: ReferenceSourceClass
  label: string
  addedAt: string
  media: ReferenceMediaSet
  provenance: ReferenceProvenance
}

export function hasReferenceMedia(media: ReferenceMediaSet | undefined): boolean {
  return Boolean(
    media?.front?.src?.trim() ||
      media?.back?.src?.trim() ||
      media?.details?.some((item) => item.src?.trim())
  )
}

export function hasResearchPointer(
  provenance: ReferenceProvenance | undefined
): boolean {
  return Boolean(
    provenance?.locator?.trim() ||
      provenance?.researchId?.trim() ||
      provenance?.recordPath?.trim()
  )
}

/** Evidence is media, a research pointer, or both. */
export function hasEvidenceLocator(item: ReferenceCorpusItem): boolean {
  return hasReferenceMedia(item.media) || hasResearchPointer(item.provenance)
}
