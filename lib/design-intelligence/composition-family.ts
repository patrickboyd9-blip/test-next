import type { ShapePlan } from "@/lib/postcard-layouts/compose"
import { fitText, type FittedText, type InchRect } from "@/lib/postcard-layouts/typefit"

import { contrastRatio } from "./contrast"
import {
  familyFromRationale,
  rectsOverlap,
  type CompositionFamily,
} from "./composition-read"
import { composeGridCard, trimInches, type GridCard, type GridComposeInput } from "./grid-composer"
import type { DesignRationale, GridName } from "./rationale"

/**
 * Turns one Design Rationale into a composition family.
 * The grid composer still places the type. This module only restyles the
 * card the composer already built: open ground, a cut-out subject, two type
 * colors, and at most one row of small thumbnails.
 */

const LIGHT = "#F6F3EC"

export function composeDirectedCard(input: GridComposeInput): GridCard {
  const family = familyFromRationale(input.rationale)
  const card = composeGridCard(input)
  return applyCompositionFamily(card, family, input.spec.offer || input.spec.callToAction || "")
}

export function rationaleForFamily(base: DesignRationale, family: CompositionFamily): DesignRationale {
  const medicare = base.vertical === "medicare_insurance"
  const open = family === "cutout-right" || family === "cutout-left" || family === "stacked-open" || family === "offer-float"
  const heroOffer = open && !medicare && family !== "stacked-open"
  return {
    ...base,
    grid: {
      ...base.grid,
      name: gridForFamily(family),
      alignment: family === "stacked-open" ? "left" : base.grid.alignment,
      intentional_break: `family:${family}`,
    },
    scale_ratios: family === "stacked-open"
      ? { ...base.scale_ratios, hero: "headline", offer_to_headline_cap: 0.55 }
      : heroOffer
        ? { ...base.scale_ratios, hero: "offer", offer_to_headline_cap: Math.max(base.scale_ratios.offer_to_headline_cap, 1.7) }
        : { ...base.scale_ratios },
    photo_brief: { ...base.photo_brief },
    palette: { ...base.palette, neutral_hex: [...base.palette.neutral_hex], banned: [...base.palette.banned] },
    offer_treatment: { ...base.offer_treatment },
  }
}

export function gridForFamily(family: CompositionFamily): GridName {
  if (family === "panel-right") return "thirds"
  if (family === "bottom-band" || family === "stacked-open") return "bands"
  if (family === "centered-card" || family === "boxed-card") return "centered-stack"
  if (family === "split") return "split-40-60"
  return "full-bleed-plus-panel"
}

export function applyCompositionFamily(card: GridCard, family: CompositionFamily, offerCopy = ""): GridCard {
  if (family === "cutout-right" || family === "offer-float") return openCutout(card, "right", family === "offer-float")
  if (family === "cutout-left") return openCutout(card, "left", false)
  if (family === "stacked-open") return openStack(card, offerCopy)
  return card
}

function openCutout(card: GridCard, side: "left" | "right", floating: boolean): GridCard {
  const trim = trimInches(card.front.size)
  const photo: InchRect = side === "right"
    ? floating
      ? { x: round2(trim.w * 0.46), y: round2(trim.h * 0.05), w: round2(trim.w * 0.52), h: round2(trim.h * 0.77) }
      : { x: round2(trim.w * 0.46), y: 0, w: round2(trim.w * 0.54), h: round2(trim.h * 0.76) }
    : { x: 0, y: 0, w: round2(trim.w * 0.5), h: round2(trim.h * 0.82) }
  let next = paintOpenGround(card)
  if (side === "left") next = shiftTypeToRight(next)
  next = withPhoto(next, photo)
  next = recolorType(next)
  if (typeOverflows(next)) next = reflowOpenColumn(next, side)
  const placed = next.front.photos[0]?.rect ?? photo
  const thumbs = thumbnailRow(next, side === "right" ? placed.x : 0.28, placed.y + placed.h + 0.08)
  if (thumbs.length > 0) next = addShapes(next, thumbs)
  next = { ...next, calmFieldPct: 42 }
  return next
}

function openStack(card: GridCard, offerCopy: string): GridCard {
  let next = paintOpenGround(card)
  next = recolorType(next)
  const trim = trimInches(next.front.size)
  const photoH = round2(trim.h * 0.42)
  next = withPhoto(next, { x: 0, y: 0, w: trim.w, h: photoH })
  next = { ...next, calmFieldPct: 42 }
  if (next.front.texts.some((text) => text.role === "offer" && text.text.trim())) return next
  const copy = offerCopy.trim()
  const headline = next.front.texts.find((text) => text.role === "headline")
  if (!copy || !headline) return next
  const top = round2(photoH + 0.12)
  const bottom = round2(headline.rect.y - 0.08)
  if (bottom - top < 0.3) return next
  const offer = fitText({
    text: copy,
    rect: { x: 0.25, y: top, w: round2(trim.w - 0.5), h: round2(bottom - top) },
    role: "offer",
    pairing: next.front.pairing,
    color: colorOnLight(next.front.palette.accent, headline.color),
    minPt: 16,
    maxPt: 22,
  })
  if (!offer.text || offer.overflows) return next
  return { ...next, front: { ...next.front, texts: [offer, ...next.front.texts] } }
}

function shiftTypeToRight(card: GridCard): GridCard {
  const trim = trimInches(card.front.size)
  const rects = [
    ...card.front.texts.map((text) => text.rect),
    ...(card.front.lockup ? [card.front.lockup.rect] : []),
  ]
  if (rects.length === 0) return card
  const minX = Math.min(...rects.map((rect) => rect.x))
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.w))
  const dx = round2(trim.w - 0.25 - maxX)
  if (dx <= 0.05 || minX + dx < trim.w * 0.4) return card
  const move = (rect: InchRect): InchRect => ({ ...rect, x: round2(rect.x + dx) })
  const moveText = (text: FittedText): FittedText => ({ ...text, rect: move(text.rect) })
  const lockup = card.front.lockup
  return {
    ...card,
    front: {
      ...card.front,
      texts: card.front.texts.map(moveText),
      lockup: lockup
        ? {
            ...lockup,
            rect: move(lockup.rect),
            qrRect: move(lockup.qrRect),
            phone: lockup.phone ? moveText(lockup.phone) : undefined,
            website: lockup.website ? moveText(lockup.website) : undefined,
            phoneBox: lockup.phoneBox ? { ...lockup.phoneBox, rect: move(lockup.phoneBox.rect) } : undefined,
          }
        : lockup,
    },
  }
}

function typeOverflows(card: GridCard): boolean {
  return card.front.overflows || card.front.texts.some((text) => text.overflows)
}

/**
 * A 44pt offer word does not fit the composer's narrow panel.
 * The open column gets wide enough for that word, and the subject
 * keeps the rest of the card so the photograph stays above 40 percent.
 */
function reflowOpenColumn(card: GridCard, side: "left" | "right"): GridCard {
  const trim = trimInches(card.front.size)
  const columnW = 4.15
  const textX = side === "right" ? 0.25 : round2(trim.w - 0.25 - columnW)
  const photoX = side === "right" ? round2(textX + columnW + 0.15) : 0
  const photoW = side === "right" ? round2(trim.w - photoX) : round2(textX - 0.15)
  const photo: InchRect = { x: photoX, y: 0, w: photoW, h: trim.h }
  const stack = card.front.texts
    .filter((text) => text.role === "offer" || text.role === "headline" || text.role === "body" || text.role === "proof")
    .sort((a, b) => a.rect.y - b.rect.y)
  const fitted: FittedText[] = []
  let cursor = 0.25
  for (const text of stack) {
    const block = fitText({
      text: text.text,
      rect: { x: textX, y: cursor, w: columnW, h: 2.4 },
      role: text.role,
      pairing: card.front.pairing,
      color: text.color,
      minPt: text.role === "headline" ? 27 : text.role === "offer" ? 16 : 11,
      maxPt: Math.max(text.fontPt, text.role === "headline" ? 27 : text.role === "offer" ? 16 : 11),
    })
    const height = usedHeight(block)
    fitted.push({ ...block, rect: { ...block.rect, h: round2(height) } })
    cursor = round2(cursor + height + 0.08)
  }
  const lockup = card.front.lockup
  const lockupTop = round2(Math.max(cursor + 0.06, lockup ? lockup.rect.y : cursor))
  const dx = lockup ? round2(textX - lockup.rect.x) : 0
  const dy = lockup ? round2(lockupTop - lockup.rect.y) : 0
  const move = (rect: InchRect): InchRect => ({ ...rect, x: round2(rect.x + dx), y: round2(rect.y + dy) })
  const moveText = (text: FittedText): FittedText => ({ ...text, rect: move(text.rect) })
  const labels = card.front.texts
    .filter((text) => !stack.includes(text))
    .map((text) => (dx !== 0 || dy !== 0 ? moveText(text) : text))
  let next = withPhoto(card, photo)
  next = {
    ...next,
    front: {
      ...next.front,
      overflows: fitted.some((text) => text.overflows),
      texts: [...fitted, ...labels],
      lockup: lockup
        ? {
            ...lockup,
            rect: move(lockup.rect),
            qrRect: move(lockup.qrRect),
            phone: lockup.phone ? moveText(lockup.phone) : undefined,
            website: lockup.website ? moveText(lockup.website) : undefined,
            phoneBox: lockup.phoneBox ? { ...lockup.phoneBox, rect: move(lockup.phoneBox.rect) } : undefined,
          }
        : lockup,
    },
  }
  return next
}

function usedHeight(text: FittedText): number {
  const line = (text.fontPt / 72) * (text.font === "display" ? 1.02 : 1.18) * 1.04
  return Math.max(0.22, Math.max(1, text.lines.length) * line)
}

function paintOpenGround(card: GridCard): GridCard {
  return {
    ...card,
    front: {
      ...card.front,
      palette: { ...card.front.palette, paper: LIGHT },
      shapes: card.front.shapes.map((shape) => {
        if (shape.role === "paper" || shape.role === "type-panel" || shape.role === "field") {
          return { ...shape, fill: LIGHT }
        }
        return shape
      }),
    },
  }
}

function withPhoto(card: GridCard, rect: InchRect): GridCard {
  const trim = trimInches(card.front.size)
  const share = (rect.w * rect.h) / (trim.w * trim.h)
  return {
    ...card,
    photoAreaPct: Math.round(share * 100),
    front: {
      ...card.front,
      photos: [{ id: "photo", role: "photo", rect, bleed: rect.x <= 0.02 || rect.y <= 0.02 }],
    },
  }
}

function recolorType(card: GridCard): GridCard {
  const headline = colorOnLight("#1B3A4B")
  const offer = colorOnLight(card.front.palette.accent, headline)
  const paint = (text: FittedText): FittedText => {
    if (text.role === "headline") return { ...text, color: headline }
    if (text.role === "offer") return { ...text, color: offer }
    return text
  }
  const lockup = card.front.lockup
  return {
    ...card,
    front: {
      ...card.front,
      texts: card.front.texts.map(paint),
      lockup: lockup
        ? {
            ...lockup,
            phone: lockup.phone ? { ...lockup.phone, color: headline } : undefined,
            website: lockup.website ? { ...lockup.website, color: "#161616" } : undefined,
          }
        : lockup,
    },
  }
}

function colorOnLight(preferred: string, avoid?: string): string {
  const choices = [preferred, "#0B6A43", "#0E6B6B", "#161616"]
  for (const hex of choices) {
    if (avoid && hex.toLowerCase() === avoid.toLowerCase()) continue
    if (contrastRatio(hex, LIGHT) >= 4.5) return hex
  }
  return "#161616"
}

function thumbnailRow(card: GridCard, startX: number, y: number): ShapePlan[] {
  const trim = trimInches(card.front.size)
  const box: InchRect = { x: round2(startX), y: round2(y), w: 1.05, h: 0.48 }
  if (box.y + box.h > trim.h - 0.25) return []
  const gap = 0.12
  const shapes: ShapePlan[] = []
  for (let index = 0; index < 3; index += 1) {
    const rect = { ...box, x: round2(box.x + index * (box.w + gap)) }
    if (rect.x + rect.w > trim.w - 0.25) break
    if (overlapsLive(card, rect)) return []
    shapes.push({ id: `thumb-${index}`, role: "thumbnail", rect, fill: "#D9D0C3" })
  }
  return shapes.length === 3 ? shapes : []
}

function overlapsLive(card: GridCard, rect: InchRect): boolean {
  const texts = [
    ...card.front.texts,
    ...(card.front.lockup?.phone ? [card.front.lockup.phone] : []),
    ...(card.front.lockup?.website ? [card.front.lockup.website] : []),
  ]
  if (texts.some((text) => text.text.trim() && rectsOverlap(text.rect, rect))) return true
  return card.front.photos.some((photo) => rectsOverlap(photo.rect, rect))
}

function addShapes(card: GridCard, shapes: ShapePlan[]): GridCard {
  return { ...card, front: { ...card.front, shapes: [...card.front.shapes, ...shapes] } }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
