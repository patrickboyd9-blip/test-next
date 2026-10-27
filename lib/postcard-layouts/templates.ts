import type { FontPairingId, PostcardSizeId, PostcardTemplateId } from "./ids"
import { BEFORE_AFTER_ENABLED, ROOFING_PRO_AVAILABLE_IDS, ROOFING_PRO_META } from "@/lib/roofing-pro/ids"
import type { InchRect } from "./typefit"

export interface DesignRegion {
  id: string
  kind: "photo" | "shape" | "text" | "lockup" | "trust"
  role: string
  /** Inches on an 8×5 trim. Scaled onto 6×9. */
  x: number
  y: number
  w: number
  h: number
  align?: "left" | "center"
  /** Photograph may run to the trim edge and into the bleed. */
  bleed?: boolean
}

export interface TemplateMeta {
  id: PostcardTemplateId
  pairing: FontPairingId
  /** How many customer or generated photographs the front can hold. */
  photoSlots: 0 | 1 | 2
  /** Plain name for tests and the chooser. Not printed. */
  label: string
}

export const TEMPLATE_META: Record<PostcardTemplateId, TemplateMeta> = {
  hero_scrim: { id: "hero_scrim", pairing: "trade", photoSlots: 1, label: "Full-bleed photograph with a gradient scrim" },
  offer_starburst: { id: "offer_starburst", pairing: "signal", photoSlots: 1, label: "Half photograph with an offer tile" },
  color_block: { id: "color_block", pairing: "signal", photoSlots: 0, label: "Type on a bold color field" },
  before_after: { id: "before_after", pairing: "trade", photoSlots: 2, label: "Before and after photographs" },
  trust_proof: { id: "trust_proof", pairing: "trade", photoSlots: 1, label: "Proof beside a photograph" },
  deadline_coupon: { id: "deadline_coupon", pairing: "signal", photoSlots: 1, label: "Offer panel with a perforated edge" },
  medicare_calm: { id: "medicare_calm", pairing: "letter", photoSlots: 1, label: "Calm paper with room for a disclaimer" },
  neighbor_letter: { id: "neighbor_letter", pairing: "letter", photoSlots: 1, label: "A short letter from the business" },
  portrait_aside: { id: "portrait_aside", pairing: "letter", photoSlots: 1, label: "Portrait beside a quiet column" },
  service_band: { id: "service_band", pairing: "trade", photoSlots: 1, label: "Photograph, offer band, and type" },
  storm_alert: { id: "storm_alert", pairing: "signal", photoSlots: 1, label: "Honest area note beside a roof photograph" },
  financing_first: { id: "financing_first", pairing: "signal", photoSlots: 1, label: "Payment offer beside a photograph" },
  local_pride: { id: "local_pride", pairing: "trade", photoSlots: 1, label: "Job photograph with a local headline" },
  commercial_restore: { id: "commercial_restore", pairing: "signal", photoSlots: 1, label: "Quiet commercial restoration" },
  roof_full_bleed: { id: "roof_full_bleed", pairing: "trade", photoSlots: 1, label: ROOFING_PRO_META.roof_full_bleed.name },
  roof_split: { id: "roof_split", pairing: "trade", photoSlots: 1, label: ROOFING_PRO_META.roof_split.name },
  roof_coupon: { id: "roof_coupon", pairing: "signal", photoSlots: 1, label: ROOFING_PRO_META.roof_coupon.name },
  roof_before_after: { id: "roof_before_after", pairing: "trade", photoSlots: 2, label: ROOFING_PRO_META.roof_before_after.name },
  roof_trust: { id: "roof_trust", pairing: "letter", photoSlots: 1, label: ROOFING_PRO_META.roof_trust.name },
  roof_storm: { id: "roof_storm", pairing: "trade", photoSlots: 1, label: ROOFING_PRO_META.roof_storm.name },
  roof_neighborhood: { id: "roof_neighborhood", pairing: "trade", photoSlots: 1, label: ROOFING_PRO_META.roof_neighborhood.name },
  roof_seasonal: { id: "roof_seasonal", pairing: "signal", photoSlots: 1, label: ROOFING_PRO_META.roof_seasonal.name },
  roof_minimal: { id: "roof_minimal", pairing: "trade", photoSlots: 1, label: ROOFING_PRO_META.roof_minimal.name },
  roof_premium: { id: "roof_premium", pairing: "letter", photoSlots: 1, label: ROOFING_PRO_META.roof_premium.name },
}

/**
 * Roofing spends five original compositions. The first three are the default
 * directions. A cue in the copy can pull local pride or commercial restoration
 * forward. Medicare never enters this list.
 */
const TEMPLATES_FOR: Record<string, readonly PostcardTemplateId[]> = {
  roofing: ROOFING_PRO_AVAILABLE_IDS,
  plumbing: ["offer_starburst", "deadline_coupon", "hero_scrim", "neighbor_letter"],
  hvac: ["service_band", "deadline_coupon", "hero_scrim", "color_block"],
  medicare: ["medicare_calm", "portrait_aside", "neighbor_letter"],
  real_estate: BEFORE_AFTER_ENABLED
    ? ["hero_scrim", "portrait_aside", "before_after", "neighbor_letter"]
    : ["hero_scrim", "portrait_aside", "neighbor_letter"],
  general: ["hero_scrim", "color_block", "trust_proof", "service_band", "offer_starburst"],
}

export function templatesForPalette(palette: string): readonly PostcardTemplateId[] {
  return TEMPLATES_FOR[palette] ?? TEMPLATES_FOR.general
}

export function trimInches(size: PostcardSizeId): { w: number; h: number } {
  return size === "6x9" ? { w: 9, h: 6 } : { w: 8, h: 5 }
}

export function scaleRect(rect: InchRect, size: PostcardSizeId): InchRect {
  const trim = trimInches(size)
  return {
    x: rect.x * (trim.w / 8),
    y: rect.y * (trim.h / 5),
    w: rect.w * (trim.w / 8),
    h: rect.h * (trim.h / 5),
  }
}

export function frontRegions(template: PostcardTemplateId): DesignRegion[] {
  switch (template) {
    case "hero_scrim":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 8, h: 5, bleed: true },
        { id: "scrim", kind: "shape", role: "scrim", x: 0, y: 1.45, w: 8, h: 3.55, bleed: true },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0.32, y: 1.62, w: 6.3, h: 0.82 },
        { id: "offer", kind: "text", role: "offer", x: 0.48, y: 1.74, w: 5.98, h: 0.58 },
        { id: "headline", kind: "text", role: "headline", x: 0.38, y: 2.56, w: 7.2, h: 0.72 },
        { id: "trust", kind: "trust", role: "trust", x: 0.38, y: 3.32, w: 5.4, h: 0.28 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.38, y: 3.66, w: 7.24, h: 1.08 },
      ]
    case "offer_starburst":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 4.35, h: 5, bleed: true },
        { id: "panel", kind: "shape", role: "field", x: 4.32, y: 0, w: 3.68, h: 5, bleed: true },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 4.48, y: 0.28, w: 3.32, h: 1.05 },
        { id: "offer", kind: "text", role: "offer", x: 4.58, y: 0.4, w: 3.12, h: 0.72, align: "center" },
        { id: "headline", kind: "text", role: "headline", x: 4.52, y: 1.48, w: 3.22, h: 1.05 },
        { id: "trust", kind: "trust", role: "trust", x: 4.52, y: 2.84, w: 3.22, h: 0.28 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 4.52, y: 3.2, w: 3.22, h: 1.52 },
      ]
    case "color_block":
      return [
        { id: "field", kind: "shape", role: "field", x: 0, y: 0, w: 8, h: 5, bleed: true },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0.35, y: 0.32, w: 6.4, h: 1.15 },
        { id: "offer", kind: "text", role: "offer", x: 0.5, y: 0.46, w: 6.1, h: 0.88 },
        { id: "headline", kind: "text", role: "headline", x: 0.4, y: 1.62, w: 7.15, h: 0.85 },
        { id: "body", kind: "text", role: "body", x: 0.4, y: 2.55, w: 7.15, h: 0.4 },
        { id: "trust", kind: "trust", role: "trust", x: 0.4, y: 3.02, w: 5.2, h: 0.28 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.4, y: 3.38, w: 7.2, h: 1.32 },
      ]
    case "before_after":
      return [
        { id: "before", kind: "photo", role: "photo", x: 0, y: 0, w: 3.94, h: 2.4, bleed: true },
        { id: "after", kind: "photo", role: "photo-b", x: 4.06, y: 0, w: 3.94, h: 2.4, bleed: true },
        { id: "before-chip", kind: "shape", role: "chip", x: 0.28, y: 1.84, w: 1.55, h: 0.44 },
        { id: "before-label", kind: "text", role: "label", x: 0.28, y: 1.84, w: 1.55, h: 0.44, align: "center" },
        { id: "after-chip", kind: "shape", role: "chip", x: 4.28, y: 1.84, w: 1.4, h: 0.44 },
        { id: "after-label", kind: "text", role: "label", x: 4.28, y: 1.84, w: 1.4, h: 0.44, align: "center" },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0.28, y: 2.54, w: 7.44, h: 0.78 },
        { id: "offer", kind: "text", role: "offer", x: 0.42, y: 2.62, w: 7.16, h: 0.62 },
        { id: "headline", kind: "text", role: "headline", x: 0.32, y: 3.4, w: 7.36, h: 0.38 },
        { id: "trust", kind: "trust", role: "trust", x: 0.28, y: 0.28, w: 3.5, h: 0.42 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.32, y: 3.78, w: 7.36, h: 0.96 },
      ]
    case "trust_proof":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 4.55, y: 0, w: 3.45, h: 5, bleed: true },
        { id: "panel", kind: "shape", role: "paper", x: 0, y: 0, w: 4.58, h: 5, bleed: true },
        { id: "trust", kind: "trust", role: "trust", x: 0.35, y: 0.32, w: 3.95, h: 0.3 },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0.35, y: 0.74, w: 3.9, h: 0.82 },
        { id: "offer", kind: "text", role: "offer", x: 0.48, y: 0.86, w: 3.64, h: 0.58 },
        { id: "headline", kind: "text", role: "headline", x: 0.35, y: 1.68, w: 3.9, h: 0.78 },
        { id: "body", kind: "text", role: "body", x: 0.35, y: 2.52, w: 3.9, h: 0.42 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.35, y: 3.28, w: 3.9, h: 1.42 },
      ]
    case "deadline_coupon":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 5.15, h: 2.05, bleed: true },
        { id: "paper", kind: "shape", role: "paper", x: 0, y: 2.02, w: 5.25, h: 2.98, bleed: true },
        { id: "headline", kind: "text", role: "headline", x: 0.32, y: 2.18, w: 4.7, h: 0.72 },
        { id: "trust", kind: "trust", role: "trust", x: 0.32, y: 2.96, w: 4.7, h: 0.26 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.32, y: 3.3, w: 4.7, h: 1.4 },
        { id: "coupon", kind: "shape", role: "coupon", x: 5.4, y: 0.32, w: 2.28, h: 4.36 },
        { id: "eyebrow", kind: "text", role: "eyebrow", x: 5.55, y: 0.5, w: 1.98, h: 0.32, align: "center" },
        { id: "offer", kind: "text", role: "offer", x: 5.55, y: 1.15, w: 1.98, h: 2.15, align: "center" },
      ]
    case "medicare_calm":
      return [
        { id: "paper", kind: "shape", role: "paper", x: 0, y: 0, w: 8, h: 5, bleed: true },
        { id: "photo", kind: "photo", role: "photo", x: 5.45, y: 0.35, w: 2.15, h: 2.2 },
        { id: "eyebrow", kind: "text", role: "eyebrow", x: 0.4, y: 0.32, w: 4.85, h: 0.26 },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0.4, y: 0.66, w: 4.8, h: 0.72 },
        { id: "offer", kind: "text", role: "offer", x: 0.54, y: 0.76, w: 4.52, h: 0.52 },
        { id: "headline", kind: "text", role: "headline", x: 0.4, y: 1.5, w: 4.85, h: 0.68 },
        { id: "body", kind: "text", role: "body", x: 0.4, y: 2.24, w: 4.85, h: 0.62 },
        { id: "trust", kind: "trust", role: "trust", x: 0.4, y: 2.92, w: 4.85, h: 0.26 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.4, y: 3.28, w: 7.2, h: 1.42 },
      ]
    case "neighbor_letter":
      return [
        { id: "paper", kind: "shape", role: "paper", x: 0, y: 0, w: 8, h: 5, bleed: true },
        { id: "photo", kind: "photo", role: "photo", x: 5.35, y: 0.35, w: 2.25, h: 1.55 },
        { id: "eyebrow", kind: "text", role: "eyebrow", x: 0.4, y: 0.32, w: 4.7, h: 0.26 },
        { id: "rule", kind: "shape", role: "rule", x: 0.4, y: 0.62, w: 1.5, h: 0.02 },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0.4, y: 0.74, w: 4.7, h: 0.68 },
        { id: "offer", kind: "text", role: "offer", x: 0.54, y: 0.84, w: 4.42, h: 0.48 },
        { id: "headline", kind: "text", role: "headline", x: 0.4, y: 1.52, w: 7.2, h: 0.62 },
        { id: "body", kind: "text", role: "body", x: 0.4, y: 2.2, w: 7.2, h: 0.58 },
        { id: "trust", kind: "trust", role: "trust", x: 0.4, y: 2.84, w: 5.2, h: 0.26 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.4, y: 3.18, w: 7.2, h: 1.5 },
      ]
    case "portrait_aside":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 3.2, h: 5, bleed: true },
        { id: "paper", kind: "shape", role: "paper", x: 3.18, y: 0, w: 4.82, h: 5, bleed: true },
        { id: "eyebrow", kind: "text", role: "eyebrow", x: 3.48, y: 0.32, w: 4.15, h: 0.26 },
        { id: "headline", kind: "text", role: "headline", x: 3.48, y: 0.64, w: 4.15, h: 0.82 },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 3.48, y: 1.56, w: 4.15, h: 0.68 },
        { id: "offer", kind: "text", role: "offer", x: 3.62, y: 1.66, w: 3.88, h: 0.48 },
        { id: "body", kind: "text", role: "body", x: 3.48, y: 2.34, w: 4.15, h: 0.42 },
        { id: "trust", kind: "trust", role: "trust", x: 3.48, y: 2.82, w: 4.15, h: 0.26 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 3.48, y: 3.16, w: 4.15, h: 1.52 },
      ]
    case "service_band":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 8, h: 1.95, bleed: true },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0, y: 1.95, w: 8, h: 0.82, bleed: true },
        { id: "offer", kind: "text", role: "offer", x: 0.4, y: 2.06, w: 7.2, h: 0.6 },
        { id: "paper", kind: "shape", role: "paper", x: 0, y: 2.77, w: 8, h: 2.23, bleed: true },
        { id: "headline", kind: "text", role: "headline", x: 0.4, y: 2.9, w: 7.2, h: 0.48 },
        { id: "trust", kind: "trust", role: "trust", x: 0.4, y: 3.42, w: 5, h: 0.26 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.4, y: 3.74, w: 7.2, h: 1.0 },
      ]
    case "storm_alert":
      return [
        { id: "panel", kind: "shape", role: "field", x: 0, y: 0, w: 4.72, h: 5, bleed: true },
        { id: "photo", kind: "photo", role: "photo", x: 4.68, y: 0, w: 3.32, h: 5, bleed: true },
        { id: "headline", kind: "text", role: "headline", x: 0.32, y: 0.28, w: 4.08, h: 0.95 },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0.28, y: 1.36, w: 4.16, h: 1.02 },
        { id: "offer", kind: "text", role: "offer", x: 0.4, y: 1.48, w: 3.92, h: 0.78 },
        { id: "trust", kind: "trust", role: "trust", x: 0.32, y: 2.5, w: 4.08, h: 0.28 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.32, y: 2.9, w: 4.08, h: 1.82 },
      ]
    case "financing_first":
      return [
        { id: "paper", kind: "shape", role: "paper", x: 0, y: 0, w: 4.4, h: 5, bleed: true },
        { id: "photo", kind: "photo", role: "photo", x: 4.35, y: 0, w: 3.65, h: 5, bleed: true },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0, y: 0, w: 4.4, h: 2.15, bleed: true },
        { id: "offer", kind: "text", role: "offer", x: 0.32, y: 0.28, w: 3.2, h: 1.58 },
        { id: "headline", kind: "text", role: "headline", x: 0.32, y: 2.32, w: 3.75, h: 0.7 },
        { id: "trust", kind: "trust", role: "trust", x: 0.32, y: 3.1, w: 3.75, h: 0.28 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.32, y: 3.46, w: 3.75, h: 1.26 },
      ]
    case "local_pride":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 8, h: 3.35, bleed: true },
        { id: "bar", kind: "shape", role: "field", x: 0, y: 3.35, w: 8, h: 1.65, bleed: true },
        { id: "trust", kind: "trust", role: "trust", x: 0.32, y: 0.28, w: 4.4, h: 0.28 },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0.32, y: 2.28, w: 5.5, h: 0.9 },
        { id: "offer", kind: "text", role: "offer", x: 0.46, y: 2.4, w: 5.22, h: 0.66 },
        { id: "headline", kind: "text", role: "headline", x: 0.32, y: 3.5, w: 3.5, h: 1.28 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 3.95, y: 3.48, w: 3.72, h: 1.26 },
      ]
    case "commercial_restore":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 3.25, h: 5, bleed: true },
        { id: "paper", kind: "shape", role: "paper", x: 3.2, y: 0, w: 4.8, h: 5, bleed: true },
        { id: "headline", kind: "text", role: "headline", x: 3.5, y: 0.32, w: 4.15, h: 0.85 },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 3.5, y: 1.28, w: 4.15, h: 1.2 },
        { id: "offer", kind: "text", role: "offer", x: 3.64, y: 1.42, w: 3.88, h: 0.92 },
        { id: "trust", kind: "trust", role: "trust", x: 3.5, y: 2.6, w: 4.15, h: 0.28 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 3.5, y: 3.05, w: 4.15, h: 1.65 },
      ]
    default:
      return frontRegions("hero_scrim")
  }
}

export function rectContains(outer: InchRect, inner: InchRect, slack = 0.02): boolean {
  return (
    inner.x >= outer.x - slack &&
    inner.y >= outer.y - slack &&
    inner.x + inner.w <= outer.x + outer.w + slack &&
    inner.y + inner.h <= outer.y + outer.h + slack
  )
}

export function rectsOverlap(a: InchRect, b: InchRect, gap = 0.01): boolean {
  return a.x + a.w > b.x + gap && b.x + b.w > a.x + gap && a.y + a.h > b.y + gap && b.y + b.h > a.y + gap
}

export function clampToSafe(rect: InchRect, size: PostcardSizeId): InchRect {
  const trim = trimInches(size)
  const inset = 0.25
  const x = Math.max(rect.x, inset)
  const y = Math.max(rect.y, inset)
  const right = Math.min(rect.x + rect.w, trim.w - inset)
  const bottom = Math.min(rect.y + rect.h, trim.h - inset)
  return { x, y, w: Math.max(0.2, right - x), h: Math.max(0.2, bottom - y) }
}
