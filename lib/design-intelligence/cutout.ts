import { deflateSync, inflateSync } from "node:zlib"

import { decode as decodeJpeg, encode as encodeJpeg } from "jpeg-js"

/**
 * A subject with the background removed, so it can sit on the card
 * instead of inside a photo box. Generated pictures are asked for a
 * plain backdrop. This knocks that backdrop out. A real scene, whose
 * corners are not one color, is left alone.
 */

export interface Raster {
  width: number
  height: number
  rgba: Buffer
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export function cutoutSubjectRequested(spec: { designRationale?: unknown }): boolean {
  if (!spec.designRationale || typeof spec.designRationale !== "object") return false
  const rationale = spec.designRationale as { vertical?: string; grid?: { intentional_break?: string } }
  if (rationale.vertical === "hvac") return false
  return rationale.grid?.intentional_break === "integrated"
}

export function cutoutSubjectLine(subject: string): string {
  return `${subject} Isolate the person and the object together on a flat light-gray background, with empty space around them. No room, no sky, no floor scene, and no frame, so the background can be removed.`
}

export function knockOutPlainBackground(bytes: Buffer): { bytes: Buffer; changed: boolean } {
  const image = decodeRaster(bytes)
  if (!image) return { bytes, changed: false }
  const next = knockOutRgba(image.rgba, image.width, image.height)
  if (!next) return { bytes, changed: false }
  return { bytes: encodePng(image.width, image.height, next), changed: true }
}

/** Returns a transparent raster, or null when the corners are not one flat color. */
export function knockOutRgba(rgba: Buffer, width: number, height: number): Buffer | null {
  const sample = cornerColor(rgba, width, height)
  if (!sample) return null
  const next = Buffer.from(rgba)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const distance = colorDistance(next, index, sample)
      if (distance < 28) {
        next[index + 3] = 0
      } else if (distance < 46) {
        const fade = (distance - 28) / 18
        next[index + 3] = Math.round((next[index + 3] ?? 255) * fade)
      }
    }
  }
  return next
}

let cachedCutout: Raster | null = null
let cachedCutoutPng: Buffer | null = null

/**
 * A subject on a transparent ground. The lower mass reaches toward the type.
 * The upper mass stays further right, clear of a two-line headline.
 */
export function standInCutout(): Raster {
  if (cachedCutout) return cachedCutout
  const width = 640
  const height = 400
  const rgba = Buffer.alloc(width * height * 4, 0)
  // Lower body reaches toward the offer. Upper figures stay clear of the response cluster.
  fill(rgba, width, 120, 248, 490, 110, 27, 58, 74, 255)
  fill(rgba, width, 250, 175, 200, 80, 46, 107, 74, 255)
  fill(rgba, width, 430, 36, 72, 250, 27, 58, 74, 255)
  fill(rgba, width, 446, 12, 38, 34, 196, 122, 74, 255)
  fill(rgba, width, 300, 48, 64, 220, 27, 58, 74, 255)
  fill(rgba, width, 314, 20, 34, 32, 196, 122, 74, 255)
  disc(rgba, width, height, 190, 348, 30, 27, 58, 74)
  disc(rgba, width, height, 430, 348, 30, 27, 58, 74)
  fill(rgba, width, 166, 308, 46, 42, 196, 122, 74, 255)
  fill(rgba, width, 406, 308, 46, 42, 196, 122, 74, 255)
  cachedCutout = { width, height, rgba }
  return cachedCutout
}

export function standInCutoutPng(): Buffer {
  if (cachedCutoutPng) return cachedCutoutPng
  const cutout = standInCutout()
  cachedCutoutPng = encodePng(cutout.width, cutout.height, cutout.rgba)
  return cachedCutoutPng
}

function cornerColor(rgba: Buffer, width: number, height: number): [number, number, number] | null {
  const points = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
  ]
  const colors = points.map(([x, y]) => {
    const index = ((y ?? 0) * width + (x ?? 0)) * 4
    return [rgba[index] ?? 0, rgba[index + 1] ?? 0, rgba[index + 2] ?? 0] as [number, number, number]
  })
  const first = colors[0]
  if (!first) return null
  for (const color of colors) {
    if (Math.abs(color[0] - first[0]) + Math.abs(color[1] - first[1]) + Math.abs(color[2] - first[2]) > 36) {
      return null
    }
  }
  return [
    Math.round(colors.reduce((sum, color) => sum + color[0], 0) / colors.length),
    Math.round(colors.reduce((sum, color) => sum + color[1], 0) / colors.length),
    Math.round(colors.reduce((sum, color) => sum + color[2], 0) / colors.length),
  ]
}

function colorDistance(rgba: Buffer, index: number, sample: [number, number, number]): number {
  return (
    Math.abs((rgba[index] ?? 0) - sample[0]) +
    Math.abs((rgba[index + 1] ?? 0) - sample[1]) +
    Math.abs((rgba[index + 2] ?? 0) - sample[2])
  )
}

export function decodeImageRaster(bytes: Buffer): Raster | null {
  return decodeRaster(bytes)
}

function decodeRaster(bytes: Buffer): Raster | null {
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return decodePng(bytes)
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    try {
      const decoded = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true })
      return { width: decoded.width, height: decoded.height, rgba: Buffer.from(decoded.data) }
    } catch {
      return null
    }
  }
  return null
}

export function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 4 + 1)
    raw[start] = 0
    rgba.copy(raw, start + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

export function decodePng(bytes: Buffer): Raster | null {
  let offset = 8
  let width = 0
  let height = 0
  let colorType = 6
  const idat: Buffer[] = []
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.toString("ascii", offset + 4, offset + 8)
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === "IHDR") {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      if (data[8] !== 8 || data[12] !== 0) return null
      colorType = data[9] ?? 6
      if (colorType !== 2 && colorType !== 6) return null
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data))
    } else if (type === "IEND") {
      break
    }
    offset += 12 + length
  }
  if (!width || !height || idat.length === 0) return null
  const bpp = colorType === 6 ? 4 : 3
  let inflated: Buffer
  try {
    inflated = inflateSync(Buffer.concat(idat))
  } catch {
    return null
  }
  const stride = width * bpp
  const raw = Buffer.alloc(height * stride)
  let source = 0
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source] ?? 0
    source += 1
    if (filter > 4) return null
    const row = y * stride
    const prior = y > 0 ? (y - 1) * stride : -1
    for (let x = 0; x < stride; x += 1) {
      const value = inflated[source] ?? 0
      source += 1
      const left = x >= bpp ? raw[row + x - bpp] ?? 0 : 0
      const up = prior >= 0 ? raw[prior + x] ?? 0 : 0
      const upLeft = prior >= 0 && x >= bpp ? raw[prior + x - bpp] ?? 0 : 0
      let reconstructed = value
      if (filter === 1) reconstructed = (value + left) & 255
      else if (filter === 2) reconstructed = (value + up) & 255
      else if (filter === 3) reconstructed = (value + Math.floor((left + up) / 2)) & 255
      else if (filter === 4) reconstructed = (value + paeth(left, up, upLeft)) & 255
      raw[row + x] = reconstructed
    }
  }
  const rgba = Buffer.alloc(width * height * 4, 255)
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (colorType === 6) {
      rgba[pixel * 4] = raw[pixel * 4] ?? 0
      rgba[pixel * 4 + 1] = raw[pixel * 4 + 1] ?? 0
      rgba[pixel * 4 + 2] = raw[pixel * 4 + 2] ?? 0
      rgba[pixel * 4 + 3] = raw[pixel * 4 + 3] ?? 255
    } else {
      rgba[pixel * 4] = raw[pixel * 3] ?? 0
      rgba[pixel * 4 + 1] = raw[pixel * 3 + 1] ?? 0
      rgba[pixel * 4 + 2] = raw[pixel * 3 + 2] ?? 0
    }
  }
  return { width, height, rgba }
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft
  const leftDistance = Math.abs(estimate - left)
  const upDistance = Math.abs(estimate - up)
  const diagonal = Math.abs(estimate - upLeft)
  if (leftDistance <= upDistance && leftDistance <= diagonal) return left
  if (upDistance <= diagonal) return up
  return upLeft
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([length, body, crc])
}

function crc32(buf: Buffer): number {
  let crc = ~0
  for (let index = 0; index < buf.length; index += 1) {
    crc ^= buf[index] ?? 0
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
  }
  return ~crc
}

function fill(
  rgba: Buffer,
  width: number,
  x: number,
  y: number,
  w: number,
  h: number,
  red: number,
  green: number,
  blue: number,
  alpha: number
): void {
  for (let row = y; row < y + h; row += 1) {
    for (let column = x; column < x + w; column += 1) {
      const index = (row * width + column) * 4
      rgba[index] = red
      rgba[index + 1] = green
      rgba[index + 2] = blue
      rgba[index + 3] = alpha
    }
  }
}

function disc(
  rgba: Buffer,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  red: number,
  green: number,
  blue: number
): void {
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue
      if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue
      const index = (y * width + x) * 4
      rgba[index] = red
      rgba[index + 1] = green
      rgba[index + 2] = blue
      rgba[index + 3] = 255
    }
  }
}

/** Used by tests that need a plain-background JPEG without committing a fixture. */
export function plainBackdropJpeg(width: number, height: number, subject: { x: number; y: number; w: number; h: number }): Buffer {
  const rgba = Buffer.alloc(width * height * 4, 255)
  for (let index = 0; index < rgba.length; index += 4) {
    rgba[index] = 214
    rgba[index + 1] = 214
    rgba[index + 2] = 214
    rgba[index + 3] = 255
  }
  fill(rgba, width, subject.x, subject.y, subject.w, subject.h, 20, 40, 60, 255)
  return Buffer.from(encodeJpeg({ data: rgba, width, height }, 90).data)
}
