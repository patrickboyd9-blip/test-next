import type { RoofingProTemplateId } from "./ids"

/**
 * Regions are inches on a 5×8 trim (8 wide, 5 tall), y down.
 * Text stays inside 0.32–7.68 by 0.32–4.68 so a 6×9 scale
 * (×1.125 wide, ×1.2 tall) remains inside the 0.25 in safe zone.
 * Photographs may bleed. Nothing here is traced from a mailer.
 */

export interface ProRegion {
  id: string
  kind: "photo" | "shape" | "text" | "lockup"
  role: string
  x: number
  y: number
  w: number
  h: number
  align?: "left" | "center"
  bleed?: boolean
  /** scene keeps the roof. person keeps a head in a tall frame. */
  subject?: "scene" | "person"
  fill?: "paper" | "field" | "offer" | "scrim" | "rule"
}

export function proFrontRegions(id: RoofingProTemplateId): ProRegion[] {
  switch (id) {
    case "roof_full_bleed":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 8, h: 5, bleed: true, subject: "scene" },
        { id: "scrim", kind: "shape", role: "solid-scrim", x: 0, y: 2.05, w: 8, h: 2.95, bleed: true, fill: "scrim" },
        { id: "headline", kind: "text", role: "headline", x: 0.38, y: 2.7, w: 7.24, h: 0.56 },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0.38, y: 3.32, w: 4.9, h: 0.42, fill: "offer" },
        { id: "offer", kind: "text", role: "offer", x: 0.5, y: 3.36, w: 4.66, h: 0.34 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.38, y: 3.8, w: 7.24, h: 0.88 },
      ]
    case "roof_split":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 4.55, h: 5, bleed: true, subject: "person" },
        { id: "paper", kind: "shape", role: "paper", x: 4.48, y: 0, w: 3.52, h: 5, bleed: true, fill: "paper" },
        { id: "headline", kind: "text", role: "headline", x: 4.76, y: 0.36, w: 2.88, h: 1.22 },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 4.76, y: 1.68, w: 2.88, h: 0.5, fill: "offer" },
        { id: "offer", kind: "text", role: "offer", x: 4.88, y: 1.76, w: 2.64, h: 0.34 },
        { id: "body", kind: "text", role: "body", x: 4.76, y: 2.28, w: 2.88, h: 0.58 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 4.76, y: 3.0, w: 2.88, h: 1.64 },
      ]
    case "roof_coupon":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 8, h: 2.46, bleed: true, subject: "scene" },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0, y: 2.38, w: 8, h: 1.2, bleed: true, fill: "offer" },
        { id: "offer", kind: "text", role: "offer", x: 0.38, y: 2.52, w: 5.5, h: 0.92 },
        { id: "headline", kind: "text", role: "headline", x: 0.38, y: 3.7, w: 7.24, h: 0.4 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.38, y: 2.5, w: 7.24, h: 2.14 },
      ]
    case "roof_before_after":
      return [
        { id: "before", kind: "photo", role: "photo", x: 0, y: 0, w: 3.92, h: 2.38, bleed: true, subject: "scene" },
        { id: "after", kind: "photo", role: "photo-b", x: 4.08, y: 0, w: 3.92, h: 2.38, bleed: true, subject: "scene" },
        { id: "before-chip", kind: "shape", role: "chip", x: 0.36, y: 1.92, w: 1.2, h: 0.32, fill: "field" },
        { id: "before-label", kind: "text", role: "label", x: 0.36, y: 1.92, w: 1.2, h: 0.32, align: "center" },
        { id: "after-chip", kind: "shape", role: "chip", x: 4.24, y: 1.92, w: 1.05, h: 0.32, fill: "field" },
        { id: "after-label", kind: "text", role: "label", x: 4.24, y: 1.92, w: 1.05, h: 0.32, align: "center" },
        { id: "headline", kind: "text", role: "headline", x: 0.38, y: 2.52, w: 7.24, h: 0.52 },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0.38, y: 3.12, w: 4.5, h: 0.42, fill: "offer" },
        { id: "offer", kind: "text", role: "offer", x: 0.5, y: 3.16, w: 4.26, h: 0.34 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.38, y: 3.62, w: 7.24, h: 1.02 },
      ]
    case "roof_trust":
      return [
        { id: "paper", kind: "shape", role: "paper", x: 0, y: 0, w: 4.7, h: 5, bleed: true, fill: "paper" },
        { id: "photo", kind: "photo", role: "photo", x: 4.62, y: 0, w: 3.38, h: 5, bleed: true, subject: "person" },
        { id: "headline", kind: "text", role: "headline", x: 0.38, y: 0.36, w: 4.02, h: 1.12 },
        { id: "body", kind: "text", role: "body", x: 0.38, y: 1.56, w: 4.02, h: 0.62 },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0.38, y: 2.28, w: 3.9, h: 0.48, fill: "offer" },
        { id: "offer", kind: "text", role: "offer", x: 0.5, y: 2.34, w: 3.66, h: 0.36 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.38, y: 2.9, w: 4.02, h: 1.74 },
      ]
    case "roof_storm":
      return [
        { id: "field", kind: "shape", role: "field", x: 0, y: 0, w: 4.5, h: 5, bleed: true, fill: "field" },
        { id: "photo", kind: "photo", role: "photo", x: 4.42, y: 0, w: 3.58, h: 5, bleed: true, subject: "scene" },
        { id: "headline", kind: "text", role: "headline", x: 0.36, y: 0.36, w: 3.88, h: 1.16 },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0.36, y: 1.62, w: 3.84, h: 0.58, fill: "offer" },
        { id: "offer", kind: "text", role: "offer", x: 0.48, y: 1.7, w: 3.6, h: 0.42 },
        { id: "body", kind: "text", role: "body", x: 0.36, y: 2.3, w: 3.88, h: 0.52 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.36, y: 2.92, w: 3.88, h: 1.72 },
      ]
    case "roof_neighborhood":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 8, h: 2.32, bleed: true, subject: "scene" },
        { id: "paper", kind: "shape", role: "paper", x: 0, y: 2.26, w: 8, h: 2.74, bleed: true, fill: "paper" },
        { id: "headline", kind: "text", role: "headline", x: 0.4, y: 2.46, w: 7.2, h: 0.58 },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0.4, y: 3.12, w: 4.7, h: 0.42, fill: "offer" },
        { id: "offer", kind: "text", role: "offer", x: 0.52, y: 3.16, w: 4.46, h: 0.34 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.4, y: 3.62, w: 7.2, h: 1.02 },
      ]
    case "roof_seasonal":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 4.42, h: 5, bleed: true, subject: "scene" },
        { id: "field", kind: "shape", role: "field", x: 4.34, y: 0, w: 3.66, h: 5, bleed: true, fill: "field" },
        { id: "headline", kind: "text", role: "headline", x: 4.6, y: 0.36, w: 3.04, h: 1.12 },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 4.6, y: 1.58, w: 3.04, h: 0.66, fill: "offer" },
        { id: "offer", kind: "text", role: "offer", x: 4.72, y: 1.68, w: 2.8, h: 0.46 },
        { id: "body", kind: "text", role: "body", x: 4.6, y: 2.34, w: 3.04, h: 0.5 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 4.6, y: 2.94, w: 3.04, h: 1.7 },
      ]
    case "roof_minimal":
      return [
        { id: "paper", kind: "shape", role: "paper", x: 0, y: 0, w: 4.8, h: 5, bleed: true, fill: "paper" },
        { id: "photo", kind: "photo", role: "photo", x: 4.72, y: 0, w: 3.28, h: 5, bleed: true, subject: "person" },
        { id: "headline", kind: "text", role: "headline", x: 0.4, y: 0.4, w: 4.08, h: 1.28 },
        { id: "rule", kind: "shape", role: "rule", x: 0.4, y: 1.8, w: 1.15, h: 0.02, fill: "rule" },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 0.4, y: 1.98, w: 3.7, h: 0.46, fill: "offer" },
        { id: "offer", kind: "text", role: "offer", x: 0.52, y: 2.04, w: 3.46, h: 0.34 },
        { id: "body", kind: "text", role: "body", x: 0.4, y: 2.54, w: 4.08, h: 0.42 },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.4, y: 3.12, w: 4.08, h: 1.52 },
      ]
    case "roof_premium":
      return [
        { id: "photo", kind: "photo", role: "photo", x: 0, y: 0, w: 8, h: 2.15, bleed: true, subject: "scene" },
        { id: "paper", kind: "shape", role: "paper", x: 0, y: 2.1, w: 8, h: 2.9, bleed: true, fill: "paper" },
        { id: "headline", kind: "text", role: "headline", x: 0.48, y: 2.36, w: 7.04, h: 0.58, align: "center" },
        { id: "offer-tile", kind: "shape", role: "offer-tile", x: 1.95, y: 3.08, w: 4.1, h: 0.4, fill: "offer" },
        { id: "offer", kind: "text", role: "offer", x: 2.07, y: 3.12, w: 3.86, h: 0.32, align: "center" },
        { id: "lockup", kind: "lockup", role: "lockup", x: 0.48, y: 3.58, w: 7.04, h: 1.06 },
      ]
    default:
      return proFrontRegions("roof_full_bleed")
  }
}
