import type { InchRect } from "@/lib/postcard-layouts/typefit"

import { trimInches, type GridCard } from "./grid-composer"
import type { DesignRationale } from "./rationale"

/**
 * Reads a composed card. The composer stays the source of the grid.
 * These checks tell the critic whether type is trapped in a slab or
 * sitting on the open ground.
 */

export const OPEN_FAMILIES = ["cutout-right", "cutout-left", "stacked-open", "offer-float"] as const
export type OpenFamily = (typeof OPEN_FAMILIES)[number]

export const PANEL_FAMILIES = ["panel-left", "panel-right", "bottom-band", "centered-card", "split", "boxed-card"] as const

export const COMPOSITION_FAMILIES = [...PANEL_FAMILIES, ...OPEN_FAMILIES] as const
export type CompositionFamily = (typeof COMPOSITION_FAMILIES)[number]

export function familyFromRationale(rationale: DesignRationale): CompositionFamily {
  const note = rationale.grid.intentional_break
  const match = /^family:([a-z-]+)$/.exec(note)
  const name = match?.[1]
  if (name && (COMPOSITION_FAMILIES as readonly string[]).includes(name)) return name as CompositionFamily
  return "panel-left"
}

export function groundFill(card: GridCard): string {
  const paper = card.front.shapes.find((shape) => shape.role === "paper")
  return (paper?.fill ?? card.front.palette.paper).toLowerCase()
}

export function typePanel(card: GridCard) {
  return card.front.shapes.find((shape) => shape.role === "type-panel")
}

export function isDistinctPanel(card: GridCard): boolean {
  const panel = typePanel(card)
  if (!panel) return false
  return panel.fill.toLowerCase() !== groundFill(card)
}

export function isFloatingBox(card: GridCard): boolean {
  const panel = typePanel(card)
  if (!panel || !isDistinctPanel(card)) return false
  const trim = trimInches(card.front.size)
  const { x, y } = panel.rect
  return x > trim.w * 0.08 && y > trim.h * 0.08
}

export function isOpenCanvas(card: GridCard): boolean {
  if (isDistinctPanel(card)) return false
  const headline = card.front.texts.find((text) => text.role === "headline")
  const offer = card.front.texts.find((text) => text.role === "offer")
  if (!headline?.text || !offer?.text) return false
  return card.photoAreaPct >= 40
}

export function rectsOverlap(a: InchRect, b: InchRect, gap = 0): boolean {
  return a.x < b.x + b.w - gap && a.x + a.w > b.x + gap && a.y < b.y + b.h - gap && a.y + a.h > b.y + gap
}

export function textColorDiffers(card: GridCard): boolean {
  const headline = card.front.texts.find((text) => text.role === "headline")
  const offer = card.front.texts.find((text) => text.role === "offer")
  if (!headline || !offer) return false
  return headline.color.toLowerCase() !== offer.color.toLowerCase()
}
