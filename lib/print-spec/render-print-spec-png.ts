import { deflateSync } from "node:zlib"

import {
  buildPostcard5x8PrintSpec,
  type PixelRect,
  type Postcard5x8PrintSpec,
} from "./postcard-5x8-print-spec"

export interface RgbGuide {
  widthPx: number
  heightPx: number
  rgb: Uint8Array
}

const WHITE: readonly [number, number, number] = [255, 255, 255]
const TRIM: readonly [number, number, number] = [28, 28, 28]
const SAFE: readonly [number, number, number] = [36, 74, 148]
const EDGE: readonly [number, number, number] = [170, 170, 170]
const KEEPOUT: readonly [number, number, number] = [244, 214, 214]
const KEEPOUT_EDGE: readonly [number, number, number] = [150, 64, 64]

/**
 * 300 DPI RGB raster of the print guides.
 * Width and height are the artwork canvas in pixels (2550 × 1650).
 * No CMYK. Not customer artwork.
 */
export function renderPostcard5x8GuideRgb(
  face: "front" | "back",
  spec: Postcard5x8PrintSpec = buildPostcard5x8PrintSpec()
): RgbGuide {
  const widthPx = spec.pixelSize.widthPx
  const heightPx = spec.pixelSize.heightPx
  const rgb = new Uint8Array(widthPx * heightPx * 3)
  fill(rgb, WHITE)

  if (face === "back") {
    for (const keepOut of spec.keepOuts) {
      fillRect(rgb, widthPx, keepOut.pixels, KEEPOUT)
    }
  }

  strokeRect(rgb, widthPx, heightPx, { xPx: 0, yPx: 0, widthPx, heightPx }, EDGE, 2)
  strokeRect(rgb, widthPx, heightPx, inchesRectToPixels(spec, "trim"), TRIM, 3)
  strokeRect(rgb, widthPx, heightPx, inchesRectToPixels(spec, "safe"), SAFE, 2)

  if (face === "back") {
    for (const keepOut of spec.keepOuts) {
      strokeRect(rgb, widthPx, heightPx, keepOut.pixels, KEEPOUT_EDGE, 2)
    }
  }

  return { widthPx, heightPx, rgb }
}

export function renderPostcard5x8PrintSpecPng(
  face: "front" | "back",
  spec: Postcard5x8PrintSpec = buildPostcard5x8PrintSpec()
): Buffer {
  const guide = renderPostcard5x8GuideRgb(face, spec)
  return encodeRgbPng(guide.widthPx, guide.heightPx, guide.rgb, spec.dpi)
}

function inchesRectToPixels(
  spec: Postcard5x8PrintSpec,
  which: "trim" | "safe"
): PixelRect {
  const rect = which === "trim" ? spec.trimOnCanvas : spec.safeTextOnCanvas
  return {
    xPx: Math.round(rect.xInches * spec.dpi),
    yPx: Math.round(rect.yInches * spec.dpi),
    widthPx: Math.round(rect.widthInches * spec.dpi),
    heightPx: Math.round(rect.heightInches * spec.dpi),
  }
}

function fill(rgb: Uint8Array, color: readonly [number, number, number]): void {
  for (let index = 0; index < rgb.length; index += 3) {
    rgb[index] = color[0]
    rgb[index + 1] = color[1]
    rgb[index + 2] = color[2]
  }
}

function fillRect(
  rgb: Uint8Array,
  widthPx: number,
  rect: PixelRect,
  color: readonly [number, number, number]
): void {
  const x0 = clamp(rect.xPx, 0, widthPx)
  const x1 = clamp(rect.xPx + rect.widthPx, 0, widthPx)
  const heightBound = rgb.length / 3 / widthPx
  const y0 = clamp(rect.yPx, 0, heightBound)
  const y1 = clamp(rect.yPx + rect.heightPx, 0, heightBound)
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * widthPx + x) * 3
      rgb[index] = color[0]
      rgb[index + 1] = color[1]
      rgb[index + 2] = color[2]
    }
  }
}

function strokeRect(
  rgb: Uint8Array,
  widthPx: number,
  heightPx: number,
  rect: PixelRect,
  color: readonly [number, number, number],
  stroke: number
): void {
  const x0 = rect.xPx
  const y0 = rect.yPx
  const x1 = rect.xPx + rect.widthPx - 1
  const y1 = rect.yPx + rect.heightPx - 1
  for (let thickness = 0; thickness < stroke; thickness += 1) {
    hLine(rgb, widthPx, heightPx, x0, x1, y0 + thickness, color)
    hLine(rgb, widthPx, heightPx, x0, x1, y1 - thickness, color)
    vLine(rgb, widthPx, heightPx, y0, y1, x0 + thickness, color)
    vLine(rgb, widthPx, heightPx, y0, y1, x1 - thickness, color)
  }
}

function hLine(
  rgb: Uint8Array,
  widthPx: number,
  heightPx: number,
  x0: number,
  x1: number,
  y: number,
  color: readonly [number, number, number]
): void {
  if (y < 0 || y >= heightPx) return
  const start = Math.max(0, Math.min(x0, x1))
  const end = Math.min(widthPx - 1, Math.max(x0, x1))
  for (let x = start; x <= end; x += 1) setPixel(rgb, widthPx, x, y, color)
}

function vLine(
  rgb: Uint8Array,
  widthPx: number,
  heightPx: number,
  y0: number,
  y1: number,
  x: number,
  color: readonly [number, number, number]
): void {
  if (x < 0 || x >= widthPx) return
  const start = Math.max(0, Math.min(y0, y1))
  const end = Math.min(heightPx - 1, Math.max(y0, y1))
  for (let y = start; y <= end; y += 1) setPixel(rgb, widthPx, x, y, color)
}

function setPixel(
  rgb: Uint8Array,
  widthPx: number,
  x: number,
  y: number,
  color: readonly [number, number, number]
): void {
  const index = (y * widthPx + x) * 3
  rgb[index] = color[0]
  rgb[index + 1] = color[1]
  rgb[index + 2] = color[2]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function encodeRgbPng(
  widthPx: number,
  heightPx: number,
  rgb: Uint8Array,
  dpi: number
): Buffer {
  const rowSize = 1 + widthPx * 3
  const raw = Buffer.alloc(rowSize * heightPx)
  for (let y = 0; y < heightPx; y += 1) {
    const rowStart = y * rowSize
    raw[rowStart] = 0
    Buffer.from(rgb.buffer, rgb.byteOffset + y * widthPx * 3, widthPx * 3).copy(
      raw,
      rowStart + 1
    )
  }

  const pixelsPerMeter = Math.round(dpi / 0.0254)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(widthPx, 0)
  ihdr.writeUInt32BE(heightPx, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const phys = Buffer.alloc(9)
  phys.writeUInt32BE(pixelsPerMeter, 0)
  phys.writeUInt32BE(pixelsPerMeter, 4)
  phys[8] = 1

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("pHYs", phys),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([length, typeBuf, data, crc])
}

const CRC_TABLE = makeCrcTable()

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}
