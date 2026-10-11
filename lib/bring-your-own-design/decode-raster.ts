import { inflateSync } from "node:zlib"

import { decode as decodeJpeg } from "jpeg-js"

export interface DecodedRaster {
  width: number
  height: number
  /** Straight RGBA, top row first. */
  rgba: Uint8Array
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

export function sniffDesignMedia(bytes: Uint8Array, declared: string): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf"
  }
  if (bytes.length >= 8 && PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    return "image/png"
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }
  if (declared === "application/pdf" || declared === "image/png" || declared === "image/jpeg") {
    return null
  }
  return null
}

export function readRasterDpi(bytes: Uint8Array, kind: "png" | "jpeg"): number | null {
  if (kind === "png") return readPngDpi(bytes)
  return readJpegDpi(bytes)
}

export function decodeRaster(bytes: Uint8Array, kind: "png" | "jpeg"): DecodedRaster | null {
  try {
    if (kind === "png") return decodePng(bytes)
    const decoded = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 40 })
    return { width: decoded.width, height: decoded.height, rgba: decoded.data }
  } catch {
    return null
  }
}

function readPngDpi(bytes: Uint8Array): number | null {
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset)
    const type = ascii(bytes, offset + 4, 4)
    if (type === "pHYs" && length >= 9) {
      const ppmX = readUint32(bytes, offset + 8)
      const ppmY = readUint32(bytes, offset + 12)
      const unit = bytes[offset + 16]
      if (unit === 1 && ppmX > 0 && ppmY > 0) {
        return Math.min(ppmX, ppmY) * 0.0254
      }
      return null
    }
    if (type === "IEND") break
    offset += 12 + length
  }
  return null
}

function readJpegDpi(bytes: Uint8Array): number | null {
  let offset = 2
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) break
    const marker = bytes[offset + 1] ?? 0
    if (marker === 0xda || marker === 0xd9) break
    const length = ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0)
    if (length < 2) break
    if (
      marker === 0xe0 &&
      ascii(bytes, offset + 4, 4) === "JFIF" &&
      offset + 16 < bytes.length
    ) {
      const units = bytes[offset + 11]
      const x = ((bytes[offset + 12] ?? 0) << 8) + (bytes[offset + 13] ?? 0)
      const y = ((bytes[offset + 14] ?? 0) << 8) + (bytes[offset + 15] ?? 0)
      if (!x || !y) return null
      if (units === 1) return Math.min(x, y)
      if (units === 2) return Math.min(x, y) * 2.54
      return null
    }
    offset += 2 + length
  }
  return null
}

function decodePng(bytes: Uint8Array): DecodedRaster | null {
  if (bytes.length < 24 || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return null
  const width = readUint32(bytes, 16)
  const height = readUint32(bytes, 20)
  const bitDepth = bytes[24]
  const colorType = bytes[25]
  const interlace = bytes[28]
  if (!width || !height || bitDepth !== 8 || interlace !== 0) return null
  if (width * height > 40_000_000) return null

  const channels = channelsFor(colorType ?? 0)
  if (!channels) return null

  const idat: Buffer[] = []
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset)
    const type = ascii(bytes, offset + 4, 4)
    if (type === "IDAT") {
      idat.push(Buffer.from(bytes.subarray(offset + 8, offset + 8 + length)))
    }
    if (type === "IEND") break
    offset += 12 + length
  }
  if (idat.length === 0) return null

  let inflated: Buffer
  try {
    inflated = inflateSync(Buffer.concat(idat))
  } catch {
    return null
  }

  const stride = width * channels
  const rowSize = stride + 1
  if (inflated.length < rowSize * height) return null
  const samples = unfilter(inflated, height, rowSize, channels)
  if (!samples) return null

  const rgba = new Uint8Array(width * height * 4)
  for (let index = 0; index < width * height; index += 1) {
    const source = index * channels
    const target = index * 4
    if (colorType === 0) {
      const gray = samples[source] ?? 0
      rgba[target] = gray
      rgba[target + 1] = gray
      rgba[target + 2] = gray
      rgba[target + 3] = 255
    } else if (colorType === 2) {
      rgba[target] = samples[source] ?? 0
      rgba[target + 1] = samples[source + 1] ?? 0
      rgba[target + 2] = samples[source + 2] ?? 0
      rgba[target + 3] = 255
    } else if (colorType === 4) {
      const gray = samples[source] ?? 0
      rgba[target] = gray
      rgba[target + 1] = gray
      rgba[target + 2] = gray
      rgba[target + 3] = samples[source + 1] ?? 255
    } else {
      rgba[target] = samples[source] ?? 0
      rgba[target + 1] = samples[source + 1] ?? 0
      rgba[target + 2] = samples[source + 2] ?? 0
      rgba[target + 3] = samples[source + 3] ?? 255
    }
  }
  return { width, height, rgba }
}

function channelsFor(colorType: number): number | null {
  if (colorType === 0) return 1
  if (colorType === 2) return 3
  if (colorType === 4) return 2
  if (colorType === 6) return 4
  return null
}

function unfilter(raw: Buffer, height: number, rowSize: number, bpp: number): Buffer | null {
  const stride = rowSize - 1
  const out = Buffer.alloc(stride * height)
  let previous = Buffer.alloc(stride)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * rowSize] ?? 0
    const row = raw.subarray(y * rowSize + 1, (y + 1) * rowSize)
    const current = Buffer.alloc(stride)
    for (let index = 0; index < stride; index += 1) {
      const left = index >= bpp ? (current[index - bpp] ?? 0) : 0
      const up = previous[index] ?? 0
      const upLeft = index >= bpp ? (previous[index - bpp] ?? 0) : 0
      const value = row[index] ?? 0
      if (filter === 0) current[index] = value
      else if (filter === 1) current[index] = (value + left) & 255
      else if (filter === 2) current[index] = (value + up) & 255
      else if (filter === 3) current[index] = (value + Math.floor((left + up) / 2)) & 255
      else if (filter === 4) current[index] = (value + paeth(left, up, upLeft)) & 255
      else return null
    }
    current.copy(out, y * stride)
    previous = current
  }
  return out
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft
  const distanceLeft = Math.abs(estimate - left)
  const distanceUp = Math.abs(estimate - up)
  const distanceUpLeft = Math.abs(estimate - upLeft)
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) return left
  if (distanceUp <= distanceUpLeft) return up
  return upLeft
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let text = ""
  for (let index = 0; index < length; index += 1) text += String.fromCharCode(bytes[offset + index] ?? 0)
  return text
}
