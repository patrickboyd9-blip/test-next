/**
 * Hand-built roofing postcards.
 * The layout is fixed. The campaign only fills the slots.
 * These are original compositions. They borrow principles from the
 * owner's favorite mailers (one hero, one offer, one response) and
 * they do not copy a brand, a photo, or a specimen.
 */

export const ROOFING_PRO_TEMPLATE_IDS = [
  "roof_full_bleed",
  "roof_split",
  "roof_before_after",
  "roof_coupon",
  "roof_trust",
  "roof_storm",
  "roof_neighborhood",
  "roof_seasonal",
  "roof_minimal",
  "roof_premium",
  "roof_fade_offer",
] as const

export type RoofingProTemplateId = (typeof ROOFING_PRO_TEMPLATE_IDS)[number]

/**
 * Before-and-after needs a true matching pair of photographs (same house,
 * same angle). The image pipeline cannot make one yet, so the layout is
 * hidden from the chooser and from automatic assignment until it can.
 */
export const BEFORE_AFTER_ENABLED = false

const SOFT_FADE_FIRST: readonly RoofingProTemplateId[] = ["roof_full_bleed", "roof_fade_offer"]

/** The templates offered to customers today. Soft-fade layouts lead the list; bordered ones follow. */
export const ROOFING_PRO_AVAILABLE_IDS: readonly RoofingProTemplateId[] = [
  ...SOFT_FADE_FIRST,
  ...ROOFING_PRO_TEMPLATE_IDS.filter((id) => !SOFT_FADE_FIRST.includes(id)),
].filter((id) => BEFORE_AFTER_ENABLED || id !== "roof_before_after")

export function isRoofingProTemplate(value: string | undefined): value is RoofingProTemplateId {
  return Boolean(value && (ROOFING_PRO_TEMPLATE_IDS as readonly string[]).includes(value))
}

export interface RoofingProMeta {
  id: RoofingProTemplateId
  /** Plain name for the Studio chooser. */
  name: string
  /** One sentence for a non-designer. Not printed. */
  summary: string
  pairing: "trade" | "signal" | "letter"
  photoSlots: 1 | 2
  /** The offer is the largest line. Every other template keeps the headline larger. */
  offerLed: boolean
}

export const ROOFING_PRO_META: Record<RoofingProTemplateId, RoofingProMeta> = {
  roof_fade_offer: {
    id: "roof_fade_offer",
    name: "Photo fade, offer first",
    summary: "One roof photograph that fades into navy, with a bright offer bar above the headline.",
    pairing: "trade",
    photoSlots: 1,
    offerLed: false,
  },
  roof_full_bleed: {
    id: "roof_full_bleed",
    name: "Full-bleed roof",
    summary: "One roof photograph, a dark gradient, then the headline and a smaller offer.",
    pairing: "trade",
    photoSlots: 1,
    offerLed: false,
  },
  roof_split: {
    id: "roof_split",
    name: "Split photo",
    summary: "The roof fills one half. The words sit on quiet paper on the other half.",
    pairing: "trade",
    photoSlots: 1,
    offerLed: false,
  },
  roof_coupon: {
    id: "roof_coupon",
    name: "Offer coupon",
    summary: "One roof photograph and one full-width offer band. The offer is the big line.",
    pairing: "signal",
    photoSlots: 1,
    offerLed: true,
  },
  roof_before_after: {
    id: "roof_before_after",
    name: "Before and after",
    summary: "Two large roof photographs, then one benefit line and one offer.",
    pairing: "trade",
    photoSlots: 2,
    offerLed: false,
  },
  roof_trust: {
    id: "roof_trust",
    name: "Recommendation",
    summary: "A tall photograph and a short recommendation. No invented review count.",
    pairing: "letter",
    photoSlots: 1,
    offerLed: false,
  },
  roof_storm: {
    id: "roof_storm",
    name: "Storm note",
    summary: "A plain storm line beside a roof. No fake deadline and no official-notice look.",
    pairing: "trade",
    photoSlots: 1,
    offerLed: false,
  },
  roof_neighborhood: {
    id: "roof_neighborhood",
    name: "Your street",
    summary: "A wide street of roofs, then a local line. No invented neighbor count.",
    pairing: "trade",
    photoSlots: 1,
    offerLed: false,
  },
  roof_seasonal: {
    id: "roof_seasonal",
    name: "This season",
    summary: "Three colors, a roof, and one offer block. The back can hold up to four short lines from the body.",
    pairing: "signal",
    photoSlots: 1,
    offerLed: false,
  },
  roof_minimal: {
    id: "roof_minimal",
    name: "Type first",
    summary: "A large headline on open paper, with a full-height roof as the accent.",
    pairing: "trade",
    photoSlots: 1,
    offerLed: false,
  },
  roof_premium: {
    id: "roof_premium",
    name: "Quiet luxury",
    summary: "A wide roof across the top and a quiet paper field for a short headline.",
    pairing: "letter",
    photoSlots: 1,
    offerLed: false,
  },
}
