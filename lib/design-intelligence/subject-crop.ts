import type { PhotoSlotPlan, PostcardFacePlan } from "@/lib/postcard-layouts/compose"
import type { InchRect } from "@/lib/postcard-layouts/typefit"

/**
 * A person is assumed to fill a portrait frame. The head box is the part
 * that must stay inside the visible crop, with a little air above it.
 * Scene photographs are not checked for a head.
 */
export const PERSON_SOURCE_ASPECT = 0.75
export const PERSON_HEAD_BOX = { x: 0.28, y: 0.03, w: 0.44, h: 0.26 }
export const EMPTY_CARD_LIMIT = 0.35

export interface FocalPoint {
  x: number
  y: number
}

export function briefShowsPerson(brief: { mode?: string; subject?: string } | null | undefined): boolean {
  if (!brief) return false
  if (brief.mode === "advisor_portrait") return true
  return /\b(?:person|people|face|faces|portrait|roofer|crew|technician|advisor|plumber|worker|head)\b/i.test(brief.subject ?? "")
}

export function personFocal(): FocalPoint {
  return { x: 0.5, y: 0.16 }
}

export function sceneFocal(): FocalPoint {
  return { x: 0.5, y: 0.42 }
}

/** Cover window in source space (0–1). `sourceAspect` is width / height. */
export function coverWindow(
  slot: Pick<InchRect, "w" | "h">,
  focal: FocalPoint,
  sourceAspect = PERSON_SOURCE_ASPECT
): { x: number; y: number; w: number; h: number } {
  const slotAspect = slot.h <= 0 ? sourceAspect : slot.w / slot.h
  if (slotAspect >= sourceAspect) {
    const visibleH = Math.min(1, sourceAspect / slotAspect)
    let y = focal.y - visibleH / 2
    y = Math.max(0, Math.min(1 - visibleH, y))
    return { x: 0, y, w: 1, h: visibleH }
  }
  const visibleW = Math.min(1, slotAspect / sourceAspect)
  let x = focal.x - visibleW / 2
  x = Math.max(0, Math.min(1 - visibleW, x))
  return { x, y: 0, w: visibleW, h: 1 }
}

export function headIsClipped(
  slot: PhotoSlotPlan,
  sourceAspect = PERSON_SOURCE_ASPECT
): boolean {
  if (slot.treatment === "cutout" || slot.treatment === "thumbnail") return false
  const focal = slot.focal ?? personFocal()
  const window = coverWindow(slot.rect, focal, sourceAspect)
  const head = PERSON_HEAD_BOX
  const margin = 0.015
  return (
    head.x + margin < window.x - 0.001 ||
    head.y + margin < window.y - 0.001 ||
    head.x + head.w - margin > window.x + window.w + 0.001 ||
    head.y + head.h - margin > window.y + window.h + 0.001
  )
}

/** Minimum slot height so a portrait head survives a cover crop. */
export function minHeightForHead(width: number, sourceAspect = PERSON_SOURCE_ASPECT): number {
  const headSpan = PERSON_HEAD_BOX.h + PERSON_HEAD_BOX.y + 0.04
  return Math.round((headSpan * width) / sourceAspect * 100) / 100
}

/**
 * Image rect in the same y-down space as the slot. The rect may extend
 * outside the slot; the painter clips to the slot.
 */
export function coverImageRect(
  slot: InchRect,
  image: { w: number; h: number },
  focal: FocalPoint = { x: 0.5, y: 0.5 }
): InchRect {
  if (image.w <= 0 || image.h <= 0 || slot.w <= 0 || slot.h <= 0) return { ...slot }
  const scale = Math.max(slot.w / image.w, slot.h / image.h)
  const w = image.w * scale
  const h = image.h * scale
  let x = slot.x + focal.x * slot.w - focal.x * w
  let y = slot.y + focal.y * slot.h - focal.y * h
  if (x > slot.x) x = slot.x
  if (y > slot.y) y = slot.y
  if (x + w < slot.x + slot.w) x = slot.x + slot.w - w
  if (y + h < slot.y + slot.h) y = slot.y + slot.h - h
  return { x, y, w, h }
}

/** Share of the card that is neither a photograph nor painted type. */
export function emptyShare(plan: PostcardFacePlan, trim: { w: number; h: number }): number {
  const step = 0.1
  let empty = 0
  let total = 0
  for (let y = step / 2; y < trim.h; y += step) {
    for (let x = step / 2; x < trim.w; x += step) {
      total += 1
      if (!sampleFilled(plan, x, y)) empty += 1
    }
  }
  return total === 0 ? 1 : empty / total
}

function sampleFilled(plan: PostcardFacePlan, x: number, y: number): boolean {
  if (plan.photos.some((slot) => contains(slot.rect, x, y))) return true
  if (plan.texts.some((text) => text.text.trim() && contains(text.rect, x, y))) return true
  if (plan.lockup && contains(plan.lockup.rect, x, y)) return true
  if (plan.trust.some((chip) => contains(chip.rect, x, y))) return true
  return false
}

function contains(rect: InchRect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h
}

export function cardRenderFailures(
  plan: PostcardFacePlan,
  input: { person: boolean; trim: { w: number; h: number } }
): string[] {
  const failures: string[] = []
  if (input.person) {
    for (const slot of plan.photos) {
      if (headIsClipped(slot)) failures.push(`Head is clipped in ${slot.id}.`)
    }
  }
  const empty = emptyShare(plan, input.trim)
  if (empty > EMPTY_CARD_LIMIT + 0.01) {
    failures.push(`Empty space is ${Math.round(empty * 100)}% of the card.`)
  }
  return failures
}
