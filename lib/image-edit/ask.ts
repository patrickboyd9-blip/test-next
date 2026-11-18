import type { PostcardSizeId } from "@/lib/postcard-layouts/ids"

import { nextLayerId, placeLayer, placementLimits } from "./placement"
import { getImageEditProvider } from "./provider"
import type { ImageEditProvider, ProofFace, ProofLayer } from "./types"

export interface AskResult {
  layers: ProofLayer[]
  /** Customer copy. No vendor, model, or price. */
  message: string
  kind: "text" | "photo" | "none"
}

const BAKED_TEXT =
  "Those words are part of the uploaded picture, so they cannot be rewritten. Add a text layer over the picture instead."

export async function askComet(input: {
  instruction: string
  layers: ProofLayer[]
  face: ProofFace
  size: PostcardSizeId
  provider?: ImageEditProvider
}): Promise<AskResult> {
  const instruction = input.instruction.replace(/\s+/g, " ").trim()
  if (!instruction) {
    return { layers: input.layers, message: "Say what to change.", kind: "none" }
  }
  const textEdit = editText(instruction, input.layers, input.face, input.size)
  if (textEdit) return textEdit
  const provider = input.provider ?? getImageEditProvider()
  const photo = await provider.edit({
    instruction,
    face: input.face,
    size: input.size,
  })
  return { layers: input.layers, message: photo.message, kind: "photo" }
}

function editText(
  instruction: string,
  layers: ProofLayer[],
  face: ProofFace,
  size: PostcardSizeId
): AskResult | null {
  const onFace = layers.filter((layer) => layer.face === face)
  const words = quotedChange(instruction)
  if (words) {
    const texts = onFace.filter((layer) => layer.kind === "text")
    if (texts.length === 0) return { layers, message: BAKED_TEXT, kind: "text" }
    return {
      kind: "text",
      message: "Updated the text layer.",
      layers: layers.map((layer) => (layer.face === face && layer.kind === "text" ? { ...layer, text: words } : layer)),
    }
  }
  const added = addedWords(instruction)
  if (added) {
    const limits = placementLimits(size, face)
    const box = placeLayer({ x: limits.safe.x + 4, y: limits.safe.y + 4, w: Math.min(46, limits.safe.w - 8), h: 12 }, limits)
    const layer: ProofLayer = {
      id: nextLayerId(layers),
      face,
      kind: "text",
      ...box,
      z: maxZ(layers) + 1,
      text: added,
      color: "#102033",
      name: "Text",
    }
    return { layers: [...layers, layer], message: "Added a text layer. The uploaded picture was not changed.", kind: "text" }
  }
  if (/\b(red|blue|black|white|gold)\b/i.test(instruction) && /\b(color|text|words)\b/i.test(instruction)) {
    const color = colorFor(instruction)
    const target = /\b(text|words)\b/i.test(instruction) ? "text" : onFace.some((layer) => layer.kind === "color") ? "color" : "text"
    const targets = onFace.filter((layer) => layer.kind === target)
    if (targets.length === 0) return { layers, message: BAKED_TEXT, kind: "text" }
    return {
      kind: "text",
      message: target === "color" ? "Changed the color layer." : "Changed the text color.",
      layers: layers.map((layer) => (layer.face === face && layer.kind === target ? { ...layer, color } : layer)),
    }
  }
  const shift = movement(instruction)
  if (shift) {
    const texts = onFace.filter((layer) => layer.kind === "text")
    if (texts.length === 0) return { layers, message: BAKED_TEXT, kind: "text" }
    const limits = placementLimits(size, face)
    return {
      kind: "text",
      message: "Moved the text. It stays inside the safe area, clear of the address and barcode.",
      layers: layers.map((layer) => {
        if (layer.face !== face || layer.kind !== "text") return layer
        const next = placeLayer({ x: layer.x + shift.x, y: layer.y + shift.y, w: layer.w, h: layer.h }, limits)
        return { ...layer, ...next }
      }),
    }
  }
  if (/\b(bigger|smaller|larger)\b/i.test(instruction) && /\b(text|words|logo|artwork)\b/i.test(instruction)) {
    const scale = /\bsmaller\b/i.test(instruction) ? 0.85 : 1.15
    const kind = /\b(logo|artwork|image)\b/i.test(instruction) ? "image" : "text"
    const limits = placementLimits(size, face)
    return {
      kind: "text",
      message: kind === "text" ? "Resized the text." : "Resized the artwork.",
      layers: layers.map((layer) => {
        if (layer.face !== face || layer.kind !== kind) return layer
        const next = placeLayer(
          { x: layer.x, y: layer.y, w: layer.w * scale, h: layer.h * scale },
          limits
        )
        return { ...layer, ...next }
      }),
    }
  }
  if (/\b(delete|remove)\b/i.test(instruction)) {
    const kind = /\b(text|words)\b/i.test(instruction) ? "text" : "image"
    return {
      kind: "text",
      message: kind === "text" ? "Removed the text layer." : "Removed the added artwork.",
      layers: layers.filter((layer) => !(layer.face === face && layer.kind === kind)),
    }
  }
  return null
}

function quotedChange(instruction: string): string | null {
  const match = instruction.match(/\b(?:change|make) the words (?:to|say)\s+["']?(.+?)["']?$/i)
  return match?.[1]?.trim() || null
}

function addedWords(instruction: string): string | null {
  const match = instruction.match(/\badd (?:a text layer|the words|text)(?: saying| that says|:)?\s+["']?(.+?)["']?$/i)
  return match?.[1]?.trim() || null
}

function movement(instruction: string): { x: number; y: number } | null {
  if (!/\b(move|shift)\b/i.test(instruction) || !/\btext\b/i.test(instruction)) return null
  if (/\bright\b/i.test(instruction)) return { x: 8, y: 0 }
  if (/\bleft\b/i.test(instruction)) return { x: -8, y: 0 }
  if (/\bup\b/i.test(instruction)) return { x: 0, y: -8 }
  if (/\bdown\b/i.test(instruction)) return { x: 0, y: 8 }
  return { x: 8, y: 0 }
}

function colorFor(instruction: string): string {
  if (/\bblue\b/i.test(instruction)) return "#1e4696"
  if (/\bblack\b/i.test(instruction)) return "#102033"
  if (/\bwhite\b/i.test(instruction)) return "#f7fbff"
  if (/\bgold\b/i.test(instruction)) return "#c4922a"
  return "#b42318"
}

function maxZ(layers: ProofLayer[]): number {
  return layers.reduce((highest, layer) => Math.max(highest, layer.z), 0)
}
