import { deflateSync } from "node:zlib"

import type { PixelRect, PostcardGeometry } from "./postcard-5x8-print-spec"
import { PRINT_SPEC_DPI } from "./postcard-5x8-print-spec"

const TRIM: readonly [number, number, number, number] = [20, 20, 20, 255]
const SAFE: readonly [number, number, number, number] = [30, 70, 160, 255]
const KEEPOUT: readonly [number, number, number, number] = [196, 48, 48, 88]
const KEEPOUT_EDGE: readonly [number, number, number, number] = [160, 32, 32, 255]
const LABEL: readonly [number, number, number, number] = [20, 20, 20, 255]

/**
 * Transparent overlay at the print-spec pixel size (300 DPI).
 * The page outside the guides is clear, so the file can sit on top of
 * artwork in Figma, Photoshop, or Canva. The back tints the address keep-out.
 */
export function renderDesignOverlayPng(
  geometry: PostcardGeometry,
  face: "front" | "back"
): Buffer {
  const widthPx = geometry.pixelSize.widthPx
  const heightPx = geometry.pixelSize.heightPx
  const rgba = new Uint8Array(widthPx * heightPx * 4)
  const stroke = Math.max(4, Math.round(PRINT_SPEC_DPI * 0.012))

  if (face === "back") {
    for (const keepOut of geometry.keepOuts) {
      fillRect(rgba, widthPx, keepOut.pixels, KEEPOUT)
    }
  }

  strokeRect(rgba, widthPx, heightPx, inchesToPixels(geometry, "trim"), TRIM, stroke)
  strokeRect(rgba, widthPx, heightPx, inchesToPixels(geometry, "safe"), SAFE, Math.max(3, stroke - 1))

  if (face === "back") {
    for (const keepOut of geometry.keepOuts) {
      strokeRect(rgba, widthPx, heightPx, keepOut.pixels, KEEPOUT_EDGE, Math.max(3, stroke - 1))
    }
    const panel = geometry.keepOuts.find((item) => item.id === "mailing_panel")
    if (panel) {
      drawLabel(
        rgba,
        widthPx,
        heightPx,
        "LEAVE EMPTY",
        panel.pixels.xPx + stroke * 3,
        panel.pixels.yPx + stroke * 4
      )
    }
  }

  const trim = inchesToPixels(geometry, "trim")
  const safe = inchesToPixels(geometry, "safe")
  drawLabel(rgba, widthPx, heightPx, "TRIM", trim.xPx + stroke * 2, trim.yPx + stroke * 2)
  drawLabel(rgba, widthPx, heightPx, "SAFE", safe.xPx + stroke * 2, safe.yPx + stroke * 2)

  return encodeRgbaPng(widthPx, heightPx, rgba, geometry.pixelSize.widthPx / geometry.artworkCanvasInches.widthInches)
}

export function encodeRgbaPng(
  widthPx: number,
  heightPx: number,
  rgba: Uint8Array,
  dpi: number
): Buffer {
  const rowSize = 1 + widthPx * 4
  const raw = Buffer.alloc(rowSize * heightPx)
  for (let y = 0; y < heightPx; y += 1) {
    const rowStart = y * rowSize
    raw[rowStart] = 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * widthPx * 4, widthPx * 4).copy(raw, rowStart + 1)
  }

  const pixelsPerMeter = Math.round(dpi / 0.0254)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(widthPx, 0)
  ihdr.writeUInt32BE(heightPx, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const phys = Buffer.alloc(9)
  phys.writeUInt32BE(pixelsPerMeter, 0)
  phys.writeUInt32BE(pixelsPerMeter, 4)
  phys[8] = 1

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("pHYs", phys),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ])
}

function inchesToPixels(geometry: PostcardGeometry, which: "trim" | "safe"): PixelRect {
  const rect = which === "trim" ? geometry.trimOnCanvas : geometry.safeTextOnCanvas
  const dpi = geometry.pixelSize.widthPx / geometry.artworkCanvasInches.widthInches
  return {
    xPx: Math.round(rect.xInches * dpi),
    yPx: Math.round(rect.yInches * dpi),
    widthPx: Math.round(rect.widthInches * dpi),
    heightPx: Math.round(rect.heightInches * dpi),
  }
}

function fillRect(
  rgba: Uint8Array,
  widthPx: number,
  rect: PixelRect,
  color: readonly [number, number, number, number]
): void {
  const heightPx = rgba.length / 4 / widthPx
  const x0 = clamp(rect.xPx, 0, widthPx)
  const x1 = clamp(rect.xPx + rect.widthPx, 0, widthPx)
  const y0 = clamp(rect.yPx, 0, heightPx)
  const y1 = clamp(rect.yPx + rect.heightPx, 0, heightPx)
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) setPixel(rgba, widthPx, x, y, color)
  }
}

function strokeRect(
  rgba: Uint8Array,
  widthPx: number,
  heightPx: number,
  rect: PixelRect,
  color: readonly [number, number, number, number],
  stroke: number
): void {
  const x0 = rect.xPx
  const y0 = rect.yPx
  const x1 = rect.xPx + rect.widthPx - 1
  const y1 = rect.yPx + rect.heightPx - 1
  for (let thickness = 0; thickness < stroke; thickness += 1) {
    hLine(rgba, widthPx, heightPx, x0, x1, y0 + thickness, color)
    hLine(rgba, widthPx, heightPx, x0, x1, y1 - thickness, color)
    vLine(rgba, widthPx, heightPx, y0, y1, x0 + thickness, color)
    vLine(rgba, widthPx, heightPx, y0, y1, x1 - thickness, color)
  }
}

function hLine(
  rgba: Uint8Array,
  widthPx: number,
  heightPx: number,
  x0: number,
  x1: number,
  y: number,
  color: readonly [number, number, number, number]
): void {
  if (y < 0 || y >= heightPx) return
  const start = Math.max(0, Math.min(x0, x1))
  const end = Math.min(widthPx - 1, Math.max(x0, x1))
  for (let x = start; x <= end; x += 1) setPixel(rgba, widthPx, x, y, color)
}

function vLine(
  rgba: Uint8Array,
  widthPx: number,
  heightPx: number,
  y0: number,
  y1: number,
  x: number,
  color: readonly [number, number, number, number]
): void {
  if (x < 0 || x >= widthPx) return
  const start = Math.max(0, Math.min(y0, y1))
  const end = Math.min(heightPx - 1, Math.max(y0, y1))
  for (let y = start; y <= end; y += 1) setPixel(rgba, widthPx, x, y, color)
}

function setPixel(
  rgba: Uint8Array,
  widthPx: number,
  x: number,
  y: number,
  color: readonly [number, number, number, number]
): void {
  const index = (y * widthPx + x) * 4
  rgba[index] = color[0]
  rgba[index + 1] = color[1]
  rgba[index + 2] = color[2]
  rgba[index + 3] = color[3]
}

/** 5×7 glyphs for the few words a designer needs on the overlay. */
const GLYPHS: Record<string, readonly string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
}

function drawLabel(
  rgba: Uint8Array,
  widthPx: number,
  heightPx: number,
  text: string,
  x: number,
  y: number
): void {
  const scale = Math.max(3, Math.round(PRINT_SPEC_DPI / 80))
  let cursor = x
  for (const character of text) {
    const glyph = GLYPHS[character] ?? GLYPHS[" "]!
    for (let row = 0; row < glyph.length; row += 1) {
      const bits = glyph[row] ?? ""
      for (let col = 0; col < bits.length; col += 1) {
        if (bits[col] !== "1") continue
        for (let sy = 0; sy < scale; sy += 1) {
          for (let sx = 0; sx < scale; sx += 1) {
            const px = cursor + col * scale + sx
            const py = y + row * scale + sy
            if (px < 0 || py < 0 || px >= widthPx || py >= heightPx) continue
            setPixel(rgba, widthPx, px, py, LABEL)
          }
        }
      }
    }
    cursor += (5 + 1) * scale
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
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

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}
