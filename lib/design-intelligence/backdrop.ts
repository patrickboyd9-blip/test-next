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
}

export function measureBackdropContrast(card: GridCard): BackdropContrast {
  return measurePlanContrast(card.front)
}

export function measurePlanContrast(plan: PostcardFacePlan): BackdropContrast {
  const raster = compositePlan(plan)
  const samples = textSamples(plan)
  let worst = 21
  const failing: string[] = []
  for (const sample of samples) {
    const ratio = worstContrastInRect(raster, sample.rect, sample.color, plan)
    if (ratio < worst) worst = ratio
    if (ratio < 4.5) failing.push(sample.role)
  }
  return { worst: Math.round(worst * 100) / 100, failing }
}

interface Raster {
  width: number
  height: number
  rgb: Buffer
}

function compositePlan(plan: PostcardFacePlan): Raster {
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
  for (const slot of plan.photos) {
    blitCover(rgb, width, height, slot.rect, slot.treatment === "cutout" ? cutout : photo, trim, slot.treatment === "cutout")
  }
  for (const shape of plan.shapes.filter((item) => studioShapeLayer(item.role) === "mid")) {
    if (shape.role === "scrim") paintScrim(rgb, width, height, shape.rect, hexToRgb(plan.palette.scrim), trim)
    else fillRect(rgb, width, height, shape.rect, hexToRgb(shape.fill), trim)
  }
  for (const shape of plan.shapes.filter((item) => studioShapeLayer(item.role) === "front")) {
    fillRect(rgb, width, height, shape.rect, hexToRgb(shape.fill), trim)
  }
  return { width, height, rgb }
}

function textSamples(plan: PostcardFacePlan): Array<{ role: string; rect: FittedText["rect"]; color: string }> {
  const samples: Array<{ role: string; rect: FittedText["rect"]; color: string }> = plan.texts
    .filter((text) => text.text.trim().length > 0 && text.lines.length > 0)
    .map((text) => ({ role: text.role, rect: text.rect, color: text.color }))
  const lockup = plan.lockup
  if (lockup?.phone?.text) samples.push({ role: "phone", rect: lockup.phone.rect, color: lockup.phone.color })
  if (lockup?.website?.text) samples.push({ role: "website", rect: lockup.website.rect, color: lockup.website.color })
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
  const scale = Math.max(destW / photo.width, destH / photo.height)
  const cropW = destW / scale
  const cropH = destH / scale
  const originX = (photo.width - cropW) / 2
  const originY = (photo.height - cropH) / 2
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const sx = clamp(Math.floor(originX + ((x - x0) / destW) * cropW), 0, photo.width - 1)
      const sy = clamp(Math.floor(originY + ((y - y0) / destH) * cropH), 0, photo.height - 1)
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
