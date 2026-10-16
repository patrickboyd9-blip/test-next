import type { FontPairingId } from "./ids"

/**
 * Strict scale. Offer is the largest line, then the headline, then the body.
 * Sizes are in points. The fitter may step down, and it will not go below the minimum.
 */
export const TYPE_SCALE = {
  offer: { min: 16, max: 36 },
  headline: { min: 15, max: 28 },
  body: { min: 11, max: 12.5 },
  eyebrow: { min: 8, max: 11 },
  label: { min: 8, max: 10 },
  contact: { min: 11, max: 13 },
  proof: { min: 11, max: 13 },
} as const

export type TextRole = keyof typeof TYPE_SCALE

export const PAIRING_MEASURE = {
  trade: { display: 0.62, text: 0.5 },
  signal: { display: 0.46, text: 0.5 },
  letter: { display: 0.54, text: 0.5 },
} as const satisfies Record<FontPairingId, { display: number; text: number }>

const DISPLAY_LINE = 1.02
const TEXT_LINE = 1.18

export interface InchRect {
  x: number
  y: number
  w: number
  h: number
}

export interface FittedText {
  role: TextRole
  text: string
  lines: string[]
  fontPt: number
  font: "display" | "text"
  overflows: boolean
  rect: InchRect
  align: "left" | "center"
  color: string
}

export function fitText(input: {
  text: string
  rect: InchRect
  role: TextRole
  pairing: FontPairingId
  color: string
  align?: "left" | "center"
  maxPt?: number
  minPt?: number
}): FittedText {
  const text = collapse(input.text)
  const font = input.role === "offer" || input.role === "headline" ? "display" : "text"
  const em = font === "display" ? PAIRING_MEASURE[input.pairing].display : PAIRING_MEASURE[input.pairing].text
  const lineHeight = font === "display" ? DISPLAY_LINE : TEXT_LINE
  const minPt = input.minPt ?? TYPE_SCALE[input.role].min
  const maxPt = input.maxPt ?? TYPE_SCALE[input.role].max
  const empty: FittedText = {
    role: input.role,
    text,
    lines: [],
    fontPt: minPt,
    font,
    overflows: false,
    rect: input.rect,
    align: input.align ?? "left",
    color: input.color,
  }
  if (!text || input.rect.w <= 0 || input.rect.h <= 0) return empty

  for (let pt = maxPt; pt >= minPt; pt -= 0.5) {
    const lines = wrapLines(text, pt, input.rect.w, em)
    if (blockHeight(lines.length, pt, lineHeight) <= input.rect.h + 0.01 && widest(lines, pt, em) <= input.rect.w + 0.01) {
      return { ...empty, lines, fontPt: pt, overflows: false }
    }
  }

  const lines = wrapLines(text, minPt, input.rect.w, em)
  const overflows =
    blockHeight(lines.length, minPt, lineHeight) > input.rect.h + 0.02 ||
    widest(lines, minPt, em) > input.rect.w + 0.02
  return { ...empty, lines, fontPt: minPt, overflows }
}

export function lineHeightFor(font: "display" | "text"): number {
  return font === "display" ? DISPLAY_LINE : TEXT_LINE
}

function wrapLines(text: string, fontPt: number, widthIn: number, em: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (measure(next, fontPt, em) <= widthIn || !current) {
      current = next
      continue
    }
    lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : [text]
}

function measure(text: string, fontPt: number, em: number): number {
  return text.length * (fontPt / 72) * em
}

function widest(lines: string[], fontPt: number, em: number): number {
  return lines.reduce((max, line) => Math.max(max, measure(line, fontPt, em)), 0)
}

function blockHeight(lines: number, fontPt: number, lineHeight: number): number {
  return lines * (fontPt / 72) * lineHeight * 1.04
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}
