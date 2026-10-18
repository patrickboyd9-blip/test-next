import type { PostcardFacePlan } from "@/lib/postcard-layouts/compose"
import type { FittedText } from "@/lib/postcard-layouts/typefit"

import { contrastRatio, hexToRgb } from "./contrast"
import type { GridCard } from "./grid-composer"
import { trimInches } from "./grid-composer"
import { standInCutout } from "./cutout"
import { standInPhoto } from "./stand-in-photo"
import { studioShapeLayer } from "./studio-layer"

/**
 * Contrast against the pixels Studio actually paints behind the type.
 * The photograph covers anything drawn behind it. A type panel covers the photograph.
 */

const PPI = 72

export interface BackdropContrast {
  worst: number
  failing: string[]
  /** Under 14pt. These need 7:1, which is stricter than the 4.5 body floor. */
  smallFailing: string[]
}

export interface ContrastPhoto {
  rgba: Buffer | Uint8Array
  width: number
  height: number
}

export function measureBackdropContrast(card: GridCard, photo?: ContrastPhoto | null): BackdropContrast {
  return measurePlanContrast(card.front, photo)
}

export function measurePlanContrast(plan: PostcardFacePlan, photo?: ContrastPhoto | null): BackdropContrast {
  const raster = compositePlan(plan, photo)
  const samples = textSamples(plan)
  let worst = 21
  const failing: string[] = []
  const smallFailing: string[] = []
  for (const sample of samples) {
    const ratio = worstContrastInRect(raster, sample.rect, sample.color, plan)
    if (ratio < worst) worst = ratio
    const small = sample.fontPt < 14
    if (ratio < 4.5) failing.push(sample.role)
    if (small && ratio < 7) smallFailing.push(sample.role)
  }
  return { worst: Math.round(worst * 100) / 100, failing, smallFailing }
}

interface Raster {
  width: number
  height: number
  rgb: Buffer
}

function compositePlan(plan: PostcardFacePlan, cover?: ContrastPhoto | null): Raster {
  const trim = trimInches(plan.size)
  const width = Math.max(1, Math.round(trim.w * PPI))
  const height = Math.max(1, Math.round(trim.h * PPI))
  const rgb = Buffer.alloc(width * height * 3, 255)
  const paper = hexToRgb(plan.palette.paper)
  fillRect(rgb, width, height, { x: 0, y: 0, w: trim.w, h: trim.h }, paper, trim)

  for (const shape of plan.shapes.filter((item) => studioShapeLayer(item.role) === "back")) {
    fillRect(rgb, width, height, shape.rect, hexToRgb(shape.fill), trim)
  }
  const photo = standInPhoto()
  const cutout = standInCutout()
  const real = cover ? { width: cover.width, height: cover.height, rgba: Buffer.from(cover.rgba) } : null
  for (const slot of plan.photos) {
    const source = slot.treatment === "cutout" ? cutout : real ?? photo
    blitCover(rgb, width, height, slot.rect, source, trim, slot.treatment === "cutout")
  }
  for (const shape of plan.shapes.filter((item) => studioShapeLayer(item.role) === "mid")) {
    if (shape.role === "scrim") paintScrim(rgb, width, height, shape.rect, hexToRgb(plan.palette.scrim), trim)
    else if (shape.role === "local-scrim") paintLocalScrim(rgb, width, height, shape.rect, hexToRgb(shape.fill), trim)
    else fillRect(rgb, width, height, shape.rect, hexToRgb(shape.fill), trim)
  }
  for (const shape of plan.shapes.filter((item) => studioShapeLayer(item.role) === "front")) {
    fillRect(rgb, width, height, shape.rect, hexToRgb(shape.fill), trim)
  }
  return { width, height, rgb }
}

function textSamples(plan: PostcardFacePlan): Array<{ role: string; rect: FittedText["rect"]; color: string; fontPt: number }> {
  const samples: Array<{ role: string; rect: FittedText["rect"]; color: string; fontPt: number }> = plan.texts
    .filter((text) => text.text.trim().length > 0 && text.lines.length > 0)
    .map((text) => ({ role: text.role, rect: text.rect, color: text.color, fontPt: text.fontPt }))
  const lockup = plan.lockup
  if (lockup?.phone?.text) samples.push({ role: "phone", rect: lockup.phone.rect, color: lockup.phone.color, fontPt: lockup.phone.fontPt })
  if (lockup?.website?.text) samples.push({ role: "website", rect: lockup.website.rect, color: lockup.website.color, fontPt: lockup.website.fontPt })
  return samples
}

function worstContrastInRect(
  raster: Raster,
  rect: FittedText["rect"],
  color: string,
  plan: PostcardFacePlan
): number {
  const trim = trimInches(plan.size)
  const insetX = rect.w * 0.08
  const insetY = rect.h * 0.12
  const x0 = clamp(Math.floor((rect.x + insetX) * PPI), 0, raster.width - 1)
  const y0 = clamp(Math.floor((rect.y + insetY) * PPI), 0, raster.height - 1)
  const x1 = clamp(Math.ceil((rect.x + rect.w - insetX) * PPI), x0 + 1, raster.width)
  const y1 = clamp(Math.ceil((rect.y + rect.h - insetY) * PPI), y0 + 1, raster.height)
  let worst = 21
  const stepX = Math.max(1, Math.floor((x1 - x0) / 8))
  const stepY = Math.max(1, Math.floor((y1 - y0) / 6))
  for (let y = y0; y < y1; y += stepY) {
    for (let x = x0; x < x1; x += stepX) {
      const index = (y * raster.width + x) * 3
      const background = rgbHex(raster.rgb[index] ?? 0, raster.rgb[index + 1] ?? 0, raster.rgb[index + 2] ?? 0)
      const ratio = safeContrast(color, background)
      if (ratio < worst) worst = ratio
    }
  }
  void trim
  return worst
}

function blitCover(
  rgb: Buffer,
  width: number,
  height: number,
  rect: FittedText["rect"],
  photo: { width: number; height: number; rgba: Buffer },
  trim: { w: number; h: number },
  respectAlpha = false
): void {
  const x0 = clamp(Math.floor(rect.x * PPI), 0, width)
  const y0 = clamp(Math.floor(rect.y * PPI), 0, height)
  const x1 = clamp(Math.ceil((rect.x + rect.w) * PPI), x0, width)
  const y1 = clamp(Math.ceil((rect.y + rect.h) * PPI), y0, height)
  const destW = Math.max(1, x1 - x0)
  const destH = Math.max(1, y1 - y0)
  const scale = respectAlpha
    ? Math.min(destW / photo.width, destH / photo.height)
    : Math.max(destW / photo.width, destH / photo.height)
  const drawnW = photo.width * scale
  const drawnH = photo.height * scale
  const padX = respectAlpha ? 0 : (destW - drawnW) / 2
  const padY = (destH - drawnH) / 2
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const localX = x - x0 - padX
      const localY = y - y0 - padY
      if (localX < 0 || localY < 0 || localX >= drawnW || localY >= drawnH) continue
      const sx = clamp(Math.floor(localX / scale), 0, photo.width - 1)
      const sy = clamp(Math.floor(localY / scale), 0, photo.height - 1)
      const source = (sy * photo.width + sx) * 4
      const alpha = photo.rgba[source + 3] ?? 255
      if (respectAlpha && alpha < 8) continue
      const index = (y * width + x) * 3
      const blend = respectAlpha ? alpha / 255 : 1
      rgb[index] = Math.round((photo.rgba[source] ?? 0) * blend + (rgb[index] ?? 0) * (1 - blend))
      rgb[index + 1] = Math.round((photo.rgba[source + 1] ?? 0) * blend + (rgb[index + 1] ?? 0) * (1 - blend))
      rgb[index + 2] = Math.round((photo.rgba[source + 2] ?? 0) * blend + (rgb[index + 2] ?? 0) * (1 - blend))
    }
  }
  void trim
}

function paintLocalScrim(
  rgb: Buffer,
  width: number,
  height: number,
  rect: FittedText["rect"],
  color: [number, number, number],
  trim: { w: number; h: number }
): void {
  const x0 = clamp(Math.floor(rect.x * PPI), 0, width)
  const y0 = clamp(Math.floor(rect.y * PPI), 0, height)
  const x1 = clamp(Math.ceil((rect.x + rect.w) * PPI), x0, width)
  const y1 = clamp(Math.ceil((rect.y + rect.h) * PPI), y0, height)
  const span = Math.max(1, x1 - x0)
  const fromRight = rect.x > trim.w * 0.45
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const t = (x - x0) / span
      const along = fromRight ? 1 - t : t
      const alpha = along < 0.72 ? 0.42 : 0.42 * (1 - (along - 0.72) / 0.28)
      const index = (y * width + x) * 3
      rgb[index] = blend(rgb[index] ?? 0, color[0], alpha)
      rgb[index + 1] = blend(rgb[index + 1] ?? 0, color[1], alpha)
      rgb[index + 2] = blend(rgb[index + 2] ?? 0, color[2], alpha)
    }
  }
}

function paintScrim(
  rgb: Buffer,
  width: number,
  height: number,
  rect: FittedText["rect"],
  color: [number, number, number],
  trim: { w: number; h: number }
): void {
  const x0 = clamp(Math.floor(rect.x * PPI), 0, width)
  const y0 = clamp(Math.floor(rect.y * PPI), 0, height)
  const x1 = clamp(Math.ceil((rect.x + rect.w) * PPI), x0, width)
  const y1 = clamp(Math.ceil((rect.y + rect.h) * PPI), y0, height)
  const span = Math.max(1, y1 - y0)
  for (let y = y0; y < y1; y += 1) {
    const t = (y - y0) / span
    const alpha = t < 0.3 ? (t / 0.3) * 0.5 : t < 0.68 ? 0.5 + ((t - 0.3) / 0.38) * 0.4 : 0.9 + ((t - 0.68) / 0.32) * 0.04
    for (let x = x0; x < x1; x += 1) {
      const index = (y * width + x) * 3
      rgb[index] = blend(rgb[index] ?? 0, color[0], alpha)
      rgb[index + 1] = blend(rgb[index + 1] ?? 0, color[1], alpha)
      rgb[index + 2] = blend(rgb[index + 2] ?? 0, color[2], alpha)
    }
  }
  void trim
}

function fillRect(
  rgb: Buffer,
  width: number,
  height: number,
  rect: FittedText["rect"],
  color: [number, number, number],
  trim: { w: number; h: number }
): void {
  const x0 = clamp(Math.floor(rect.x * PPI), 0, width)
  const y0 = clamp(Math.floor(rect.y * PPI), 0, height)
  const x1 = clamp(Math.ceil((rect.x + rect.w) * PPI), x0, width)
  const y1 = clamp(Math.ceil((rect.y + rect.h) * PPI), y0, height)
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * width + x) * 3
      rgb[index] = color[0]
      rgb[index + 1] = color[1]
      rgb[index + 2] = color[2]
    }
  }
  void trim
}

function safeContrast(foreground: string, background: string): number {
  try {
    return contrastRatio(foreground, background)
  } catch {
    return 1
  }
}

function rgbHex(r: number, g: number, b: number): string {
  return `#${byte(r)}${byte(g)}${byte(b)}`
}

function byte(value: number): string {
  return value.toString(16).padStart(2, "0")
}

function blend(base: number, ink: number, alpha: number): number {
  return Math.round(base * (1 - alpha) + ink * alpha)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
