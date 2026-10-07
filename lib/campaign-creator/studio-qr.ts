import { create } from "qrcode"

/**
 * ISO/IEC 18004 matrix for a scan payload.
 * `qrcode` is the encoder. A painted grid is not a QR code.
 * Quiet zone is left to the renderer (four modules of white).
 */
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
