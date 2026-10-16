/**
 * Original postcard compositions owned by Modern Mail.
 * They use general direct-mail patterns: one offer, a quiet place for type,
 * and the phone, website, and QR together. They are not reproductions of
 * any reference mailer, specimen, or third-party template.
 */

export const POSTCARD_TEMPLATE_IDS = [
  "hero_scrim",
  "offer_starburst",
  "color_block",
  "before_after",
  "trust_proof",
  "deadline_coupon",
  "medicare_calm",
  "neighbor_letter",
  "portrait_aside",
  "service_band",
] as const

export type PostcardTemplateId = (typeof POSTCARD_TEMPLATE_IDS)[number]

export const POSTCARD_SIZES = ["5x8", "6x9"] as const
export type PostcardSizeId = (typeof POSTCARD_SIZES)[number]

export const FONT_PAIRINGS = ["trade", "signal", "letter"] as const
export type FontPairingId = (typeof FONT_PAIRINGS)[number]

export const VERTICAL_PALETTE_IDS = [
  "roofing",
  "plumbing",
  "hvac",
  "medicare",
  "real_estate",
  "general",
] as const
export type VerticalPaletteId = (typeof VERTICAL_PALETTE_IDS)[number]

export function isPostcardTemplate(value: string | undefined): value is PostcardTemplateId {
  return Boolean(value && (POSTCARD_TEMPLATE_IDS as readonly string[]).includes(value))
}

export function isVerticalPalette(value: string | undefined): value is VerticalPaletteId {
  return Boolean(value && (VERTICAL_PALETTE_IDS as readonly string[]).includes(value))
}
