import { decode as decodeJpeg } from "jpeg-js"

import type { CreativeSpec } from "@/lib/campaign-creator/types"

import type { BlueprintDevice, BlueprintGuard, NormBox } from "./blueprint"

/**
 * Measures how close a rebuilt card is to the mailer it learned from.
 * A high score, a copied phrase, or a protected color pair is perturbed
 * before the card is kept. The score is logged. It is not shown to the customer.
 */

const TOO_CLOSE = 0.82

/** Distinctive pairs that must not be painted onto a new card. */
const TRADE_DRESS: ReadonlyArray<readonly [string, string]> = [
  ["#12315C", "#C6D94A"],
  ["#351C15", "#FFB500"],
  ["#DA291C", "#FFC72C"],
  ["#E20074", "#FFFFFF"],
]

export interface SimilarityScore {
  score: number
  iou: number
  palette: number
  perceptual: number
  ngram: number
  tradeDress: boolean
  perturbed: boolean
}

export interface GuardedRebuild {
  boxes: NormBox[]
  devices: BlueprintDevice[]
  neutrals: string[]
  accent: string
  spec: CreativeSpec
  similarity: SimilarityScore
}

export function guardRebuild(input: {
  sourceId: string
  boxes: readonly NormBox[]
  devices: readonly BlueprintDevice[]
  guard: BlueprintGuard
  neutrals: string[]
  accent: string
  spec: CreativeSpec
}): GuardedRebuild {
  let boxes = input.boxes.map((box) => ({ ...box }))
  let devices = [...input.devices]
  let neutrals = [...input.neutrals]
  let accent = input.accent
  let spec = { ...input.spec }
  let similarity = measure(boxes, input.boxes, neutrals, accent, spec, input.guard)
  let attempts = 0
  while ((similarity.score > TOO_CLOSE || similarity.ngram > 0 || similarity.tradeDress) && attempts < 3) {
    attempts += 1
    boxes = perturbBoxes(boxes, attempts)
    if (attempts >= 2) devices = swapDevice(devices)
    accent = shiftHex(accent, 28 * attempts)
    neutrals = neutrals.map((hex, index) => index === 0 ? hex : shiftHex(hex, 12 * attempts))
    if (similarity.ngram > 0) spec = specWithoutOverlap(spec, input.guard.sourcePhrases)
    similarity = measure(boxes, input.boxes, neutrals, accent, spec, input.guard)
  }
  similarity = { ...similarity, perturbed: attempts > 0 }
  console.info(`[design-intelligence] ${JSON.stringify({
    step: "blueprint-similarity",
    sourceId: input.sourceId,
    score: round(similarity.score),
    iou: round(similarity.iou),
    palette: round(similarity.palette),
    perceptual: round(similarity.perceptual),
    ngram: similarity.ngram,
    tradeDress: similarity.tradeDress,
    perturbed: similarity.perturbed,
  })}`)
  return { boxes, devices, neutrals, accent, spec, similarity }
}

export function measureSimilarity(input: {
  boxes: readonly NormBox[]
  sourceBoxes: readonly NormBox[]
  neutrals: readonly string[]
  accent: string
  spec: CreativeSpec
  guard: BlueprintGuard
}): SimilarityScore {
  return measure(input.boxes, input.sourceBoxes, input.neutrals, input.accent, input.spec, input.guard)
}

export function ngramOverlap(generated: string, phrases: readonly string[]): number {
  const source = new Set<string>()
  for (const phrase of phrases) {
    for (const gram of grams(phrase)) source.add(gram)
  }
  if (source.size === 0) return 0
  const seen = grams(generated)
  return seen.some((gram) => source.has(gram)) ? 1 : 0
}

export function layoutIou(generated: readonly NormBox[], source: readonly NormBox[]): number {
  if (source.length === 0) return 0
  let sum = 0
  for (const box of source) {
    const match = generated.find((item) => item.role === box.role && item.face === box.face)
    sum += match ? iou(match, box) : 0
  }
  return sum / source.length
}

export function paletteCloseness(generated: readonly string[], source: readonly string[]): number {
  const left = generated.filter(isHex)
  const right = source.filter(isHex)
  if (left.length === 0 || right.length === 0) return 0
  const distances = right.map((hex) => Math.min(...left.map((other) => hexDistance(hex, other))))
  const average = distances.reduce((sum, value) => sum + value, 0) / distances.length
  return Math.max(0, 1 - average)
}

export function matchesTradeDress(colors: readonly string[]): boolean {
  const present = colors.filter(isHex)
  return TRADE_DRESS.some(([a, b]) => present.some((hex) => hexDistance(hex, a) < 0.18) && present.some((hex) => hexDistance(hex, b) < 0.18))
}

export function layoutHash(boxes: readonly NormBox[]): string {
  const bits: number[] = []
  const values: number[] = []
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const px = (x + 0.5) / 8
      const py = (y + 0.5) / 8
      const hit = boxes.some((box) => box.face === "front" && px >= box.x && px < box.x + box.w && py >= box.y && py < box.y + box.h)
      values.push(hit ? 1 : 0)
    }
  }
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  for (const value of values) bits.push(value >= average ? 1 : 0)
  return bitsToHex(bits)
}

export function averageHashImage(bytes: Buffer): string | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  try {
    const decoded = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 2 })
    return averageHashRgba(decoded.width, decoded.height, decoded.data)
  } catch {
    return null
  }
}

export function hashDistance(left: string, right: string): number {
  const a = hexToBits(left)
  const b = hexToBits(right)
  const length = Math.max(a.length, b.length)
  if (length === 0) return 1
  let differ = 0
  for (let index = 0; index < length; index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) differ += 1
  }
  return differ / length
}

function measure(
  boxes: readonly NormBox[],
  sourceBoxes: readonly NormBox[],
  neutrals: readonly string[],
  accent: string,
  spec: CreativeSpec,
  guard: BlueprintGuard
): SimilarityScore {
  const iouScore = layoutIou(boxes, sourceBoxes)
  const colors = [...neutrals, accent]
  const palette = Math.max(paletteCloseness(colors, guard.paletteHex), matchesTradeDress(colors) ? 1 : 0)
  const perceptual = 1 - hashDistance(layoutHash(boxes), layoutHash(sourceBoxes))
  const ngram = ngramOverlap([spec.headline, spec.subheadline, spec.offer, spec.body].filter(Boolean).join(" "), guard.sourcePhrases)
  const tradeDress = matchesTradeDress(colors)
  const score = 0.45 * iouScore + 0.25 * palette + 0.2 * perceptual + 0.1 * ngram
  return {
    score: tradeDress || ngram > 0 ? Math.max(score, TOO_CLOSE + 0.01) : score,
    iou: iouScore,
    palette,
    perceptual,
    ngram,
    tradeDress,
    perturbed: false,
  }
}

function perturbBoxes(boxes: readonly NormBox[], attempt: number): NormBox[] {
  const shift = 0.045 * attempt
  const scale = 1 - 0.1 * attempt
  return boxes.map((box) => clampBox({
    ...box,
    x: box.x + (box.face === "front" ? shift : shift / 2),
    y: box.y + shift / 2,
    w: box.w * scale,
    h: box.h * scale,
  }))
}

function swapDevice(devices: readonly BlueprintDevice[]): BlueprintDevice[] {
  const next = devices.filter((device) => device !== "color-blocked-offer" && device !== "burst-badge")
  if (next.length === devices.length) next.push("full-bleed")
  return next
}

function specWithoutOverlap(spec: CreativeSpec, phrases: readonly string[]): CreativeSpec {
  const next = { ...spec }
  if (ngramOverlap(next.headline ?? "", phrases) > 0) next.headline = "A clear next step"
  if (ngramOverlap(next.subheadline ?? "", phrases) > 0) next.subheadline = undefined
  if (ngramOverlap(next.offer ?? "", phrases) > 0) next.offer = "One next step"
  if (ngramOverlap(next.body ?? "", phrases) > 0) next.body = undefined
  return next
}

function grams(text: string): string[] {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 1)
  const size = words.length >= 4 ? 4 : 3
  if (words.length < size) return words.length >= 2 ? [words.join(" ")] : []
  const found: string[] = []
  for (let index = 0; index <= words.length - size; index += 1) found.push(words.slice(index, index + size).join(" "))
  return found
}

function iou(a: NormBox, b: NormBox): number {
  const width = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const height = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  const inter = width * height
  const union = a.w * a.h + b.w * b.h - inter
  return union <= 0 ? 0 : inter / union
}

function clampBox(box: NormBox): NormBox {
  const w = Math.min(0.96, Math.max(0.08, box.w))
  const h = Math.min(0.96, Math.max(0.06, box.h))
  const x = Math.min(1 - w, Math.max(0, box.x))
  const y = Math.min(1 - h, Math.max(0, box.y))
  return { ...box, x, y, w, h }
}

function hexDistance(left: string, right: string): number {
  const a = rgb(left)
  const b = rgb(right)
  if (!a || !b) return 1
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) / Math.sqrt(3 * 255 * 255)
}

function shiftHex(hex: string, degrees: number): string {
  const channels = rgb(hex)
  if (!channels) return "#2F6FED"
  const [r, g, b] = channels.map((channel) => channel / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const delta = max - min
  let hue = 0
  if (delta > 0) {
    if (max === r) hue = ((g - b) / delta) % 6
    else if (max === g) hue = (b - r) / delta + 2
    else hue = (r - g) / delta + 4
    hue *= 60
    if (hue < 0) hue += 360
  }
  hue = (hue + degrees) % 360
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const section = hue / 60
  const x = chroma * (1 - Math.abs((section % 2) - 1))
  let next: [number, number, number] = [0, 0, 0]
  if (section < 1) next = [chroma, x, 0]
  else if (section < 2) next = [x, chroma, 0]
  else if (section < 3) next = [0, chroma, x]
  else if (section < 4) next = [0, x, chroma]
  else if (section < 5) next = [x, 0, chroma]
  else next = [chroma, 0, x]
  const match = lightness - chroma / 2
  const toHex = (channel: number) => Math.round(Math.min(1, Math.max(0, channel + match)) * 255).toString(16).padStart(2, "0")
  return `#${toHex(next[0])}${toHex(next[1])}${toHex(next[2])}`.toUpperCase()
}

function rgb(hex: string): [number, number, number] | null {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(hex.trim())
  if (!match) return null
  const value = match[1] ?? ""
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)]
}

function isHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value)
}

function averageHashRgba(width: number, height: number, data: Uint8Array): string {
  const values: number[] = []
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const sx = Math.min(width - 1, Math.floor((x + 0.5) * width / 8))
      const sy = Math.min(height - 1, Math.floor((y + 0.5) * height / 8))
      const index = (sy * width + sx) * 4
      values.push((data[index] ?? 0) * 0.3 + (data[index + 1] ?? 0) * 0.59 + (data[index + 2] ?? 0) * 0.11)
    }
  }
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  return bitsToHex(values.map((value) => value >= average ? 1 : 0))
}

function bitsToHex(bits: number[]): string {
  let hex = ""
  for (let index = 0; index < bits.length; index += 4) {
    const nibble = ((bits[index] ?? 0) << 3) + ((bits[index + 1] ?? 0) << 2) + ((bits[index + 2] ?? 0) << 1) + (bits[index + 3] ?? 0)
    hex += nibble.toString(16)
  }
  return hex
}

function hexToBits(hex: string): number[] {
  const bits: number[] = []
  for (const char of hex) {
    const value = parseInt(char, 16)
    if (!Number.isFinite(value)) continue
    bits.push((value >> 3) & 1, (value >> 2) & 1, (value >> 1) & 1, value & 1)
  }
  return bits
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}
