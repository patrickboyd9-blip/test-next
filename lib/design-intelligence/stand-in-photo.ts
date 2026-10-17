import { encode as encodeJpeg } from "jpeg-js"

/**
 * A dark photograph stand-in. The words are repeated so a cover-crop still
 * shows the label. Most of the frame stays dark, which is the backdrop that
 * made "See The Ceiling Stain" illegible when type sat on the picture.
 */

const LABEL = "STAND-IN PHOTO"

const GLYPHS: Record<string, string[]> = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
}

export interface StandInRaster {
  width: number
  height: number
  rgba: Buffer
}

let cached: StandInRaster | null = null
let cachedJpeg: Buffer | null = null

export function standInPhoto(): StandInRaster {
  if (cached) return cached
  const width = 640
  const height = 400
  const rgba = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    const shade = 22 + Math.round((y / height) * 18)
    for (let x = 0; x < width; x += 1) {
      const wobble = ((x * 13 + y * 7) % 11) - 5
      const index = (y * width + x) * 4
      rgba[index] = clampByte(shade + wobble)
      rgba[index + 1] = clampByte(shade + wobble - 4)
      rgba[index + 2] = clampByte(shade + wobble - 8)
      rgba[index + 3] = 255
    }
  }
  stampLabel(rgba, width, height)
  cached = { width, height, rgba }
  return cached
}

export function standInPhotoJpeg(): Buffer {
  if (cachedJpeg) return cachedJpeg
  const photo = standInPhoto()
  cachedJpeg = Buffer.from(encodeJpeg({ data: photo.rgba, width: photo.width, height: photo.height }, 80).data)
  return cachedJpeg
}

function stampLabel(rgba: Buffer, width: number, height: number): void {
  const scale = 3
  // Keep the left half a calm dark field. Full-bleed type sits there.
  const positions = [
    [360, 24],
    [360, 150],
    [360, 270],
  ]
  for (const [x, y] of positions) {
    const textWidth = LABEL.length * 6 * scale
    fillRect(rgba, width, height, x - 8, y - 6, textWidth + 16, 7 * scale + 12, 244, 241, 234)
    drawText(rgba, width, height, LABEL, x, y, scale)
  }
}

function drawText(rgba: Buffer, width: number, height: number, text: string, originX: number, originY: number, scale: number): void {
  let cursor = originX
  for (const character of text) {
    const glyph = GLYPHS[character] ?? GLYPHS[" "]!
    for (let row = 0; row < glyph.length; row += 1) {
      const bits = glyph[row] ?? ""
      for (let col = 0; col < bits.length; col += 1) {
        if (bits[col] !== "1") continue
        fillRect(rgba, width, height, cursor + col * scale, originY + row * scale, scale, scale, 22, 22, 22)
      }
    }
    cursor += 6 * scale
  }
}

function fillRect(
  rgba: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number
): void {
  const x0 = Math.max(0, x)
  const y0 = Math.max(0, y)
  const x1 = Math.min(width, x + w)
  const y1 = Math.min(height, y + h)
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      const index = (py * width + px) * 4
      rgba[index] = r
      rgba[index + 1] = g
      rgba[index + 2] = b
      rgba[index + 3] = 255
    }
  }
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, value))
}
