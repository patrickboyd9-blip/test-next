/**
 * Three-tier retrieval for physical references.
 * Tier 1 is Patrick's gold mailers. Tier 2 is a recognizable national brand.
 * Tier 3 is everything else. The lesson is the structure. The name, the logo,
 * the photographs, and the wording stay with the mailer.
 */

import { leaksReferenceIdentity } from "./patrick-gold"

export const PATRICK_FAVORITE_TIER_IDS = ["PM-066", "PM-067", "PM-068", "PM-069", "PM-070"] as const

/** Used only when a piece has no brand_tier tag yet. */
export const NATIONAL_BRAND_FALLBACK_IDS = [
  "PM-065",
  "PM-072",
  "PM-073",
  "PM-074",
  "PM-076",
  "PM-077",
] as const

const FAVORITES = new Set<string>(PATRICK_FAVORITE_TIER_IDS)
const FALLBACK = new Set<string>(NATIONAL_BRAND_FALLBACK_IDS)

const BRAND_NAMES = [
  "dr. squatch",
  "dr squatch",
  "generac",
  "closet world",
  "pair eyewear",
  "wesley financial",
  "leaffilter",
  "leaf filter",
  "wayfair",
  "3 day blinds",
  "3-day blinds",
]

export type ReferenceTier = 1 | 2 | 3

export function normalizeBrandTier(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined
  const tag = value.trim().toLowerCase().replace(/[_\s]+/g, "-")
  return tag.length > 0 ? tag : undefined
}

export function brandTierFromProvenance(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const record = raw as Record<string, unknown>
  const direct = record.brand_tier ?? record.brandTier
  if (typeof direct === "string") return normalizeBrandTier(direct)
  return undefined
}

export function isNationalBrand(input: { id: string; brandTier?: string | null }): boolean {
  const tag = normalizeBrandTier(input.brandTier)
  if (tag === "national-brand") return true
  if (tag) return false
  return FALLBACK.has(input.id)
}

export function referenceTier(input: { id: string; brandTier?: string | null }): ReferenceTier {
  if (FAVORITES.has(input.id)) return 1
  if (isNationalBrand(input)) return 2
  return 3
}

export function leaksProtectedReference(text: string): boolean {
  if (leaksReferenceIdentity(text)) return true
  const haystack = text.toLowerCase()
  return BRAND_NAMES.some((name) => haystack.includes(name))
}

export const NATIONAL_BRAND_GUARD =
  "Inspiration only. Do not copy the brand name, the logo, the photographs, or the wording."
