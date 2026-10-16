import type { FontPairingId, PostcardSizeId, PostcardTemplateId } from "./ids"
import type { InchRect } from "./typefit"

export interface DesignRegion {
  id: string
  kind: "photo" | "shape" | "text" | "lockup"
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
  offer_starburst: { id: "offer_starburst", pairing: "signal", photoSlots: 1, label: "Half photograph with an offer seal" },
  color_block: { id: "color_block", pairing: "signal", photoSlots: 0, label: "Type on a bold color field" },
  before_after: { id: "before_after", pairing: "trade", photoSlots: 2, label: "Before and after photographs" },
  trust_proof: { id: "trust_proof", pairing: "trade", photoSlots: 1, label: "Proof, badge, and a photograph" },
  deadline_coupon: { id: "deadline_coupon", pairing: "signal", photoSlots: 1, label: "Offer panel with a perforated edge" },
  medicare_calm: { id: "medicare_calm", pairing: "letter", photoSlots: 1, label: "Calm paper with room for a disclaimer" },
  neighbor_letter: { id: "neighbor_letter", pairing: "letter", photoSlots: 1, label: "A short letter from the business" },
  portrait_aside: { id: "portrait_aside", pairing: "letter", photoSlots: 1, label: "Portrait beside a quiet column" },
  service_band: { id: "service_band", pairing: "trade", photoSlots: 1, label: "Photograph, offer band, and type" },
}

const TEMPLATES_FOR: Record<string, readonly PostcardTemplateId[]> = {
  roofing: ["hero_scrim", "before_after", "offer_starburst", "trust_proof"],
  plumbing: ["offer_starburst", "deadline_coupon", "hero_scrim", "neighbor_letter"],
  hvac: ["service_band", "deadline_coupon", "hero_scrim", "color_block"],
  medicare: ["medicare_calm", "portrait_aside", "neighbor_letter"],
  real_estate: ["hero_scrim", "portrait_aside", "before_after", "neighbor_letter"],
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
        { id: "scrim", kind: "shape", role: "scrim", x: 0, y: 1.7, w: 8, h: 3.3, bleed: true },
        { id: "offer", kind: "text", role: "offer", x: 0.4, y: 1.85, w: 7.2, h: 0.68 },
        { id: "headline", kind: "text", role: "headline", x: 0.4, y: 2.58, w: 7.2, h: 0.95 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.4, y: 3.6, w: 7.2, h: 1.12 },
      ]
    case "offer_starburst":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 4.2, h: 5, bleed: true },
        { id: "panel", kind: "shape", role: "field", x: 4.2, y: 0, w: 3.8, h: 5, bleed: true },
        { id: "seal", kind: "shape", role: "starburst", x: 4.48, y: 0.32, w: 3.05, h: 1.78 },
        { id: "offer", kind: "text", role: "offer", x: 4.78, y: 0.72, w: 2.45, h: 1.0, align: "center" },
        { id: "headline", kind: "text", role: "headline", x: 4.5, y: 2.22, w: 3.1, h: 1.05 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 4.5, y: 3.45, w: 3.1, h: 1.25 },
      ]
    case "color_block":
      return [
        { id: "field", kind: "shape", role: "field", x: 0, y: 0, w: 8, h: 5, bleed: true },
        { id: "offer", kind: "text", role: "offer", x: 0.45, y: 0.4, w: 7.1, h: 1.1 },
        { id: "headline", kind: "text", role: "headline", x: 0.45, y: 1.65, w: 7.1, h: 1.05 },
        { id: "body", kind: "text", role: "body", x: 0.45, y: 2.8, w: 7.1, h: 0.55 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.45, y: 3.5, w: 7.1, h: 1.2 },
      ]
    case "before_after":
      return [
        { id: "before", kind: "photo", role: "photo", x: 0, y: 0, w: 3.94, h: 3.05, bleed: true },
        { id: "after", kind: "photo", role: "photo-b", x: 4.06, y: 0, w: 3.94, h: 3.05, bleed: true },
        { id: "before-chip", kind: "shape", role: "chip", x: 0.3, y: 2.55, w: 1.15, h: 0.36 },
        { id: "before-label", kind: "text", role: "label", x: 0.3, y: 2.55, w: 1.15, h: 0.36, align: "center" },
        { id: "after-chip", kind: "shape", role: "chip", x: 4.36, y: 2.55, w: 1.05, h: 0.36 },
        { id: "after-label", kind: "text", role: "label", x: 4.36, y: 2.55, w: 1.05, h: 0.36, align: "center" },
        { id: "band", kind: "shape", role: "band", x: 0, y: 3.05, w: 8, h: 1.95, bleed: true },
        { id: "offer", kind: "text", role: "offer", x: 0.4, y: 3.18, w: 4.2, h: 0.48 },
        { id: "headline", kind: "text", role: "headline", x: 0.4, y: 3.68, w: 4.2, h: 0.9 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 4.8, y: 3.22, w: 2.85, h: 1.48 },
      ]
    case "trust_proof":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 4.55, y: 0, w: 3.45, h: 5, bleed: true },
        { id: "panel", kind: "shape", role: "paper", x: 0, y: 0, w: 4.55, h: 5, bleed: true },
        { id: "badge", kind: "shape", role: "badge", x: 0.4, y: 0.35, w: 0.9, h: 0.9 },
        { id: "badge-label", kind: "text", role: "label", x: 0.4, y: 0.56, w: 0.9, h: 0.46, align: "center" },
        { id: "proof", kind: "text", role: "proof", x: 1.45, y: 0.48, w: 2.8, h: 0.64 },
        { id: "offer", kind: "text", role: "offer", x: 0.4, y: 1.4, w: 3.9, h: 0.62 },
        { id: "headline", kind: "text", role: "headline", x: 0.4, y: 2.08, w: 3.9, h: 0.78 },
        { id: "body", kind: "text", role: "body", x: 0.4, y: 2.9, w: 3.9, h: 0.42 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.4, y: 3.42, w: 3.9, h: 1.28 },
      ]
    case "deadline_coupon":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 5.15, h: 2.15, bleed: true },
        { id: "paper", kind: "shape", role: "paper", x: 0, y: 2.15, w: 5.2, h: 2.85, bleed: true },
        { id: "headline", kind: "text", role: "headline", x: 0.35, y: 2.32, w: 4.65, h: 0.9 },
        { id: "body", kind: "text", role: "body", x: 0.35, y: 3.25, w: 4.65, h: 0.4 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.35, y: 3.7, w: 4.65, h: 1.02 },
        { id: "coupon", kind: "shape", role: "coupon", x: 5.4, y: 0.35, w: 2.25, h: 4.3 },
        { id: "eyebrow", kind: "text", role: "eyebrow", x: 5.58, y: 0.55, w: 1.9, h: 0.4, align: "center" },
        { id: "offer", kind: "text", role: "offer", x: 5.58, y: 1.35, w: 1.9, h: 1.7, align: "center" },
      ]
    case "medicare_calm":
      return [
        { id: "paper", kind: "shape", role: "paper", x: 0, y: 0, w: 8, h: 5, bleed: true },
        { id: "photo", kind: "photo", role: "photo", x: 5.4, y: 0.4, w: 2.2, h: 2.5 },
        { id: "eyebrow", kind: "text", role: "eyebrow", x: 0.45, y: 0.38, w: 4.7, h: 0.3 },
        { id: "offer", kind: "text", role: "offer", x: 0.45, y: 0.74, w: 4.7, h: 0.72 },
        { id: "headline", kind: "text", role: "headline", x: 0.45, y: 1.52, w: 4.7, h: 0.78 },
        { id: "body", kind: "text", role: "body", x: 0.45, y: 2.36, w: 4.7, h: 0.78 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.45, y: 3.35, w: 7.1, h: 1.3 },
      ]
    case "neighbor_letter":
      return [
        { id: "paper", kind: "shape", role: "paper", x: 0, y: 0, w: 8, h: 5, bleed: true },
        { id: "photo", kind: "photo", role: "photo", x: 5.3, y: 0.4, w: 2.3, h: 1.7 },
        { id: "eyebrow", kind: "text", role: "eyebrow", x: 0.45, y: 0.38, w: 4.6, h: 0.28 },
        { id: "rule", kind: "shape", role: "rule", x: 0.45, y: 0.72, w: 2.2, h: 0.025 },
        { id: "offer", kind: "text", role: "offer", x: 0.45, y: 0.84, w: 4.6, h: 0.7 },
        { id: "headline", kind: "text", role: "headline", x: 0.45, y: 1.6, w: 7.1, h: 0.7 },
        { id: "body", kind: "text", role: "body", x: 0.45, y: 2.36, w: 7.1, h: 0.75 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.45, y: 3.28, w: 7.1, h: 1.35 },
      ]
    case "portrait_aside":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 3.35, h: 5, bleed: true },
        { id: "paper", kind: "shape", role: "paper", x: 3.35, y: 0, w: 4.65, h: 5, bleed: true },
        { id: "eyebrow", kind: "text", role: "eyebrow", x: 3.7, y: 0.42, w: 3.9, h: 0.32 },
        { id: "headline", kind: "text", role: "headline", x: 3.7, y: 0.88, w: 3.9, h: 1.1 },
        { id: "offer", kind: "text", role: "offer", x: 3.7, y: 2.1, w: 3.9, h: 0.55 },
        { id: "body", kind: "text", role: "body", x: 3.7, y: 2.75, w: 3.9, h: 0.5 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 3.7, y: 3.45, w: 3.9, h: 1.25 },
      ]
    case "service_band":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 8, h: 2.15, bleed: true },
        { id: "band", kind: "shape", role: "band", x: 0, y: 2.15, w: 8, h: 0.72, bleed: true },
        { id: "offer", kind: "text", role: "offer", x: 0.45, y: 2.22, w: 7.1, h: 0.58 },
        { id: "paper", kind: "shape", role: "paper", x: 0, y: 2.87, w: 8, h: 2.13, bleed: true },
        { id: "headline", kind: "text", role: "headline", x: 0.45, y: 3.0, w: 7.1, h: 0.5 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.45, y: 3.55, w: 7.1, h: 1.15 },
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
