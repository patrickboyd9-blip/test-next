import sharp from "sharp"

import { buildQrMatrix, QR_QUIET_MODULES } from "@/lib/campaign-creator/studio-qr"
import type { Click2MailSize } from "@/lib/print-spec/click2mail-keep-outs"
import { buildPostcard5x8PrintSpec, type PostcardGeometry } from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"

import { frameBox, type QrFrame } from "./model"

export interface QrMark {
  xInches: number
  yInches: number
  sizeInches: number
  payload: string
}

export interface QrPixelBox {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Paints QR symbols onto a finished picture.
 * Call this after the image edit. The editor never receives the symbol.
 */
export async function paintQrsOnFace(
  image: Buffer,
  input: { size: Click2MailSize; frame: QrFrame; marks: readonly QrMark[] }
): Promise<Buffer> {
  if (input.marks.length === 0) return image
  const meta = await sharp(image, { failOn: "none" }).metadata()
  const imgW = meta.width ?? 0
  const imgH = meta.height ?? 0
  if (imgW < 2 || imgH < 2) return image
  const box = frameBox(input.size, input.frame)
  const layers: sharp.OverlayOptions[] = []
  for (const mark of input.marks) {
    const px = qrPixelBox(box, imgW, imgH, mark)
    const svg = qrSvg(mark.payload, px.width, px.height)
    if (!svg) continue
    layers.push({ input: svg, left: px.left, top: px.top })
  }
  if (layers.length === 0) return image
  return sharp(image, { failOn: "none" })
    .composite(layers)
    .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer()
}

/**
 * The address side, at print size, with the postage block painted white
 * and the QR symbols added after that. The edit image is only the background.
 */
export async function paintBackForSave(image: Buffer, size: Click2MailSize, marks: readonly QrMark[]): Promise<Buffer> {
  const spec = specFor(size)
  const fitted = await sharp(image, { failOn: "none" })
    .resize(spec.pixelSize.widthPx, spec.pixelSize.heightPx, { fit: "fill" })
    .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer()
  const cleared = await clearKeepOuts(fitted, spec)
  return paintQrsOnFace(cleared, { size, frame: "canvas", marks })
}

export function qrPixelBox(
  box: { widthInches: number; heightInches: number; bleedInches: number },
  imgW: number,
  imgH: number,
  mark: { xInches: number; yInches: number; sizeInches: number }
): QrPixelBox {
  const left = clampInt(((box.bleedInches + mark.xInches) / box.widthInches) * imgW, 0, imgW - 1)
  const top = clampInt(((box.bleedInches + mark.yInches) / box.heightInches) * imgH, 0, imgH - 1)
  const width = clampInt((mark.sizeInches / box.widthInches) * imgW, 8, imgW - left)
  const height = clampInt((mark.sizeInches / box.heightInches) * imgH, 8, imgH - top)
  return { left, top, width, height }
}

function qrSvg(payload: string, width: number, height: number): Buffer | null {
  const matrix = buildQrMatrix(payload)
  if (!matrix) return null
  const modules = matrix.length
  const total = modules + QR_QUIET_MODULES * 2
  const cellW = width / total
  const cellH = height / total
  let rects = ""
  for (let row = 0; row < modules; row += 1) {
    const line = matrix[row]
    if (!line) continue
    for (let col = 0; col < modules; col += 1) {
      if (!line[col]) continue
      const x = (col + QR_QUIET_MODULES) * cellW
      const y = (row + QR_QUIET_MODULES) * cellH
      rects += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(cellW + 0.25).toFixed(2)}" height="${(cellH + 0.25).toFixed(2)}" fill="#111111"/>`
    }
  }
  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ffffff"/>${rects}</svg>`
  )
}

async function clearKeepOuts(image: Buffer, spec: PostcardGeometry): Promise<Buffer> {
  const meta = await sharp(image, { failOn: "none" }).metadata()
  const imgW = meta.width ?? spec.pixelSize.widthPx
  const imgH = meta.height ?? spec.pixelSize.heightPx
  const pageW = spec.artworkCanvasInches.widthInches
  const pageH = spec.artworkCanvasInches.heightInches
  const layers: sharp.OverlayOptions[] = []
  for (const zone of spec.keepOuts) {
    const left = clampInt((zone.canvas.xInches / pageW) * imgW, 0, imgW - 1)
    const top = clampInt((zone.canvas.yInches / pageH) * imgH, 0, imgH - 1)
    const width = clampInt((zone.canvas.widthInches / pageW) * imgW, 1, imgW - left)
    const height = clampInt((zone.canvas.heightInches / pageH) * imgH, 1, imgH - top)
    layers.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#ffffff"/></svg>`
      ),
      left,
      top,
    })
  }
  if (layers.length === 0) return image
  return sharp(image, { failOn: "none" })
    .composite(layers)
    .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer()
}

function specFor(size: Click2MailSize): PostcardGeometry {
  return size === "6x9" ? buildPostcard6x9PrintSpec() : buildPostcard5x8PrintSpec()
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (max < min) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}
