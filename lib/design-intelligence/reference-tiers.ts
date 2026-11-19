/**
 * Three-tier retrieval for physical references.
 * The corpus tag is the only source: patrick_favorite, national_brand, or local.
 * The lesson is the structure. The name, the logo, the photographs, and the
 * wording stay with the mailer.
 */

import { leaksReferenceIdentity } from "./patrick-gold"

export const BRAND_TIER_VALUES = ["patrick_favorite", "national_brand", "local"] as const
export type BrandTierValue = (typeof BRAND_TIER_VALUES)[number]

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

export function normalizeBrandTier(value: string | null | undefined): BrandTierValue | undefined {
  if (typeof value !== "string") return undefined
  const tag = value.trim().toLowerCase()
  if (tag === "patrick_favorite" || tag === "national_brand" || tag === "local") return tag
  return undefined
}

export function brandTierFromProvenance(raw: unknown): BrandTierValue | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const record = raw as Record<string, unknown>
  const direct = record.brand_tier ?? record.brandTier
  if (typeof direct === "string") return normalizeBrandTier(direct)
  return undefined
}

export function isNationalBrand(input: { id: string; brandTier?: string | null }): boolean {
  return normalizeBrandTier(input.brandTier) === "national_brand"
}

export function referenceTier(input: { id: string; brandTier?: string | null }): ReferenceTier {
  const tag = normalizeBrandTier(input.brandTier)
  if (tag === "patrick_favorite") return 1
  if (tag === "national_brand") return 2
  return 3
}

export function leaksProtectedReference(text: string): boolean {
  if (leaksReferenceIdentity(text)) return true
  const haystack = text.toLowerCase()
  return BRAND_NAMES.some((name) => haystack.includes(name))
}

export const NATIONAL_BRAND_GUARD =
  "Inspiration only. Do not copy the brand name, the logo, the photographs, or the wording."
