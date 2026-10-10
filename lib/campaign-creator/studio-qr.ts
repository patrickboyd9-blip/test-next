import { create } from "qrcode"
import jsQR from "jsqr"

/**
 * ISO/IEC 18004 matrix for a scan payload.
 * `qrcode` is the encoder. A painted grid of empty CSS cells is not a QR code:
 * those rows collapse to 0px and the tile stays a blank white square.
 * Quiet zone is four modules, included in the painted symbol.
 */
export const QR_QUIET_MODULES = 4

const decodeCache = new Map<string, boolean>()

export interface PaintedQr {
  modules: number
  quiet: number
  /** Dark module columns and rows, before the quiet zone. */
  dark: Array<[number, number]>
}

export function buildQrMatrix(payload: string): boolean[][] | null {
  const text = payload.trim()
  if (!text) return null

  const symbol = create(text, { errorCorrectionLevel: "Q" })
  const size = symbol.modules.size
  const matrix: boolean[][] = []

  for (let row = 0; row < size; row += 1) {
    const line: boolean[] = []
    for (let col = 0; col < size; col += 1) {
      line.push(symbol.modules.get(row, col) === 1)
    }
    matrix.push(line)
  }

  return matrix
}

/** Dark modules in symbol coordinates. Null when there is nothing to scan. */
export function paintQr(payload: string): PaintedQr | null {
  const matrix = buildQrMatrix(payload)
  if (!matrix) return null
  const dark: Array<[number, number]> = []
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix.length; col += 1) {
      if (matrix[row]?.[col]) dark.push([col, row])
    }
  }
  if (dark.length === 0) return null
  return { modules: matrix.length, quiet: QR_QUIET_MODULES, dark }
}

/** True when the painted symbol scans back to the same payload. */
export function qrPaintDecodes(payload: string): boolean {
  const text = payload.trim()
  if (!text) return false
  const cached = decodeCache.get(text)
  if (cached !== undefined) return cached
  const painted = paintQr(text)
  const ok = painted ? decodePaintedQr(painted) === text : false
  decodeCache.set(text, ok)
  return ok
}

export function decodePaintedQr(painted: PaintedQr): string | null {
  try {
    const { data, size } = rasterizePaintedQr(painted)
    return jsQR(data, size, size)?.data ?? null
  } catch {
    return null
  }
}

export function rasterizePaintedQr(painted: PaintedQr): {
  data: Uint8ClampedArray
  size: number
} {
  const scale = 6
  const total = painted.modules + painted.quiet * 2
  const size = total * scale
  const data = new Uint8ClampedArray(size * size * 4)
  data.fill(255)

  for (const [col, row] of painted.dark) {
    for (let y = 0; y < scale; y += 1) {
      for (let x = 0; x < scale; x += 1) {
        const pixelX = (painted.quiet + col) * scale + x
        const pixelY = (painted.quiet + row) * scale + y
        const index = (pixelY * size + pixelX) * 4
        data[index] = 0x11
        data[index + 1] = 0x11
        data[index + 2] = 0x11
        data[index + 3] = 255
      }
    }
  }

  return { data, size }
}
