import { deflateSync } from "node:zlib"

import { hexToRgb } from "./contrast"
import type { GridCard } from "./grid-composer"
import { trimInches } from "./grid-composer"
import type { TrimSize } from "./rationale"

/**
 * A small RGB postcard render for the benchmark and the vision critic.
 * Type is a bitmap face so the file does not depend on a system font.
 */

const PPI = 80

const GLYPHS: Record<string, string[]> = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "%": ["11001", "11010", "00100", "00100", "01011", "10011", "00000"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "00100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
}

export function renderCardPng(card: GridCard): Buffer {
  const trim = trimInches(card.front.size)
  const width = Math.round(trim.w * PPI)
  const height = Math.round(trim.h * PPI)
  const pixels = Buffer.alloc(width * height * 3, 255)
  const fill = (rect: { x: number; y: number; w: number; h: number }, hex: string) => {
    const [r, g, b] = hexToRgb(hex)
    const x0 = clamp(Math.round(rect.x * PPI), 0, width)
    const y0 = clamp(Math.round(rect.y * PPI), 0, height)
    const x1 = clamp(Math.round((rect.x + rect.w) * PPI), 0, width)
    const y1 = clamp(Math.round((rect.y + rect.h) * PPI), 0, height)
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const index = (y * width + x) * 3
        pixels[index] = r
        pixels[index + 1] = g
        pixels[index + 2] = b
      }
    }
  }
  for (const shape of card.front.shapes) fill(shape.rect, shape.fill)
  for (const photo of card.front.photos) fill(photo.rect, card.front.palette.field)
  for (const shape of card.front.shapes.filter((shape) => shape.role !== "paper")) fill(shape.rect, shape.fill)
  if (card.front.lockup) fill(card.front.lockup.qrRect, "#FFFFFF")
  for (const text of card.front.texts) drawText(pixels, width, height, text.rect, text.text, text.color, text.fontPt)
  if (card.front.lockup?.phone) {
    drawText(pixels, width, height, card.front.lockup.phone.rect, card.front.lockup.phone.text, card.front.lockup.phone.color, card.front.lockup.phone.fontPt)
  }
  return encodePng(width, height, pixels)
}

function drawText(
  pixels: Buffer,
  width: number,
  height: number,
  rect: { x: number; y: number; w: number; h: number },
  text: string,
  color: string,
  fontPt: number
): void {
  const [r, g, b] = hexToRgb(color)
  const scale = Math.max(1, Math.min(4, Math.round((fontPt / 72) * PPI / 7)))
  let penX = Math.round(rect.x * PPI)
  const penY = Math.round(rect.y * PPI)
  const glyphs = text.toUpperCase()
  for (const char of glyphs) {
    const rows = GLYPHS[char] ?? GLYPHS["?"]!
    for (let row = 0; row < rows.length; row += 1) {
      for (let col = 0; col < rows[row]!.length; col += 1) {
        if (rows[row]![col] !== "1") continue
        for (let sy = 0; sy < scale; sy += 1) {
          for (let sx = 0; sx < scale; sx += 1) {
            const x = penX + col * scale + sx
            const y = penY + row * scale + sy
            if (x < 0 || y < 0 || x >= width || y >= height) continue
            const index = (y * width + x) * 3
            pixels[index] = r
            pixels[index + 1] = g
            pixels[index + 2] = b
          }
        }
      }
    }
    penX += 6 * scale
    if (penX > (rect.x + rect.w) * PPI) break
  }
}

function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 3))
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 3)
    raw[rowStart] = 0
    rgb.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ])
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer: Buffer): number {
  let c = 0xffffffff
  for (let index = 0; index < buffer.length; index += 1) {
    c = CRC_TABLE[(c ^ buffer[index]!) & 0xff]! ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function renderSize(size: TrimSize): { width: number; height: number } {
  const trim = trimInches(size)
  return { width: Math.round(trim.w * PPI), height: Math.round(trim.h * PPI) }
}
