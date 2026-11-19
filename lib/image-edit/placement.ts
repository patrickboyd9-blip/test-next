import { geometryFor } from "@/lib/postcard-layouts/compose"
import type { PostcardSizeId } from "@/lib/postcard-layouts/ids"

import type { ProofFace, ProofLayer } from "./types"

export interface LayerBox {
  x: number
  y: number
  w: number
  h: number
}

export interface PlacementLimits {
  safe: LayerBox
  blocked: LayerBox[]
}

const MIN_W = 8
const MIN_H = 6

export function placementLimits(size: PostcardSizeId, face: ProofFace): PlacementLimits {
  const spec = geometryFor(size)
  const canvasW = spec.artworkCanvasInches.widthInches
  const canvasH = spec.artworkCanvasInches.heightInches
  const toBox = (rect: { xInches: number; yInches: number; widthInches: number; heightInches: number }): LayerBox => ({
    x: (rect.xInches / canvasW) * 100,
    y: (rect.yInches / canvasH) * 100,
    w: (rect.widthInches / canvasW) * 100,
    h: (rect.heightInches / canvasH) * 100,
  })
  return {
    safe: toBox(spec.safeTextOnCanvas),
    blocked: face === "back" ? spec.keepOuts.map((keepOut) => toBox(keepOut.canvas)) : [],
  }
}

export function placeLayer(box: LayerBox, limits: PlacementLimits): LayerBox {
  const safe = limits.safe
  const w = clamp(box.w, MIN_W, safe.w)
  let h = clamp(box.h, MIN_H, safe.h)
  let x = clamp(box.x, safe.x, safe.x + safe.w - w)
  let y = clamp(box.y, safe.y, safe.y + safe.h - h)
  for (const block of limits.blocked) {
    if (!overlaps({ x, y, w, h }, block)) continue
    const above = block.y - h - 0.5
    if (above >= safe.y) {
      y = above
      continue
    }
    const left = block.x - w - 0.5
    if (left >= safe.x) {
      x = left
      continue
    }
    h = Math.max(MIN_H, block.y - safe.y - 0.5)
    y = safe.y
    x = clamp(x, safe.x, safe.x + safe.w - w)
  }
  return { x, y, w, h }
}

export function nextLayerId(layers: ProofLayer[]): string {
  return `layer-${layers.length + 1}-${Math.round(Math.random() * 1e6).toString(36)}`
}

function overlaps(a: LayerBox, b: LayerBox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
