import { PDFDocument } from "pdf-lib"
import sharp from "sharp"

import type { Click2MailSize } from "@/lib/print-spec/click2mail-keep-outs"
import { buildPostcard5x8PrintSpec, POINTS_PER_INCH, type PostcardGeometry } from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"

import { paintBackForSave, paintQrsOnFace, qrMarkPng, type QrMark } from "./composite"
import { qrScanUrl, type SanitizedQr } from "./model"

export interface UploadFaceBytes {
  bytes: Uint8Array
  mediaType: "application/pdf" | "image/png" | "image/jpeg"
}

export function geometryForQrSize(size: Click2MailSize): PostcardGeometry {
  return size === "6x9" ? buildPostcard6x9PrintSpec() : buildPostcard5x8PrintSpec()
}

export function qrPdfBox(
  geometry: PostcardGeometry,
  mark: { xInches: number; yInches: number; sizeInches: number }
): { x: number; y: number; size: number } {
  const bleed = geometry.bleedInchesPerSide
  const pageH = geometry.artworkCanvasInches.heightInches
  const x = (bleed + mark.xInches) * POINTS_PER_INCH
  const y = (pageH - (bleed + mark.yInches) - mark.sizeInches) * POINTS_PER_INCH
  return { x, y, size: mark.sizeInches * POINTS_PER_INCH }
}

export function marksForCodes(codes: readonly SanitizedQr[], side: SanitizedQr["side"], origin: string): QrMark[] {
  return codes
    .filter((code) => code.side === side)
    .map((code) => ({
      xInches: code.xInches,
      yInches: code.yInches,
      sizeInches: code.sizeInches,
      payload: qrScanUrl(origin, code.code),
    }))
}

/**
 * Paints QR symbols onto a raster upload.
 * A PDF face is left as the customer sent it; the caller draws the symbols on the page.
 */
export async function compositeQrOntoUploadFace(
  face: UploadFaceBytes,
  size: Click2MailSize,
  marks: readonly QrMark[]
): Promise<{ face: UploadFaceBytes; overlay: QrMark[] }> {
  if (marks.length === 0 || face.mediaType === "application/pdf") {
    return { face, overlay: face.mediaType === "application/pdf" ? [...marks] : [] }
  }
  const painted = await paintQrsOnFace(Buffer.from(face.bytes), { size, frame: "canvas", marks })
  return { face: { bytes: painted, mediaType: "image/jpeg" }, overlay: [] }
}

export async function drawQrMarks(
  doc: PDFDocument,
  page: ReturnType<PDFDocument["addPage"]>,
  geometry: PostcardGeometry,
  marks: readonly QrMark[]
): Promise<void> {
  for (const mark of marks) {
    const png = await qrMarkPng(mark.payload, 256)
    if (!png) continue
    const image = await doc.embedPng(png)
    const box = qrPdfBox(geometry, mark)
    page.drawImage(image, { x: box.x, y: box.y, width: box.size, height: box.size })
  }
}

/**
 * A print-sized postcard with the words drawn first and the QR symbols painted after.
 * The symbol is not part of the words.
 */
export async function renderTrackedPostcardPdf(input: {
  size: Click2MailSize
  origin: string
  codes: readonly SanitizedQr[]
  frontLines: readonly string[]
  backLines: readonly string[]
}): Promise<{ pdf: Uint8Array; front: Buffer; back: Buffer }> {
  const geometry = geometryForQrSize(input.size)
  const front = await paintQrsOnFace(await labeledFace(geometry, input.frontLines), {
    size: input.size,
    frame: "canvas",
    marks: marksForCodes(input.codes, "front", input.origin),
  })
  const back = await paintBackForSave(
    await labeledFace(geometry, input.backLines),
    input.size,
    marksForCodes(input.codes, "back", input.origin)
  )
  const pdf = await pdfFromFaces(geometry, front, back)
  return { pdf, front, back }
}

async function labeledFace(geometry: PostcardGeometry, lines: readonly string[]): Promise<Buffer> {
  const width = geometry.pixelSize.widthPx
  const height = geometry.pixelSize.heightPx
  const text = lines
    .slice(0, 4)
    .map((line, index) => {
      const y = Math.round(height * 0.22 + index * height * 0.08)
      return `<text x="${Math.round(width * 0.42)}" y="${y}" font-size="${Math.round(height * 0.04)}" font-family="sans-serif" fill="#102033">${escapeXml(line.slice(0, 80))}</text>`
    })
    .join("")
  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#ffffff"/>${text}</svg>`
  return sharp(Buffer.from(svg)).jpeg({ quality: 90, mozjpeg: true }).toBuffer()
}

async function pdfFromFaces(geometry: PostcardGeometry, front: Buffer, back: Buffer): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const width = geometry.pdfPagePoints.widthPoints
  const height = geometry.pdfPagePoints.heightPoints
  const trim = geometry.trimBox
  for (const face of [front, back]) {
    const page = doc.addPage([width, height])
    page.setMediaBox(0, 0, width, height)
    page.setBleedBox(0, 0, width, height)
    page.setTrimBox(trim[0], trim[1], trim[2] - trim[0], trim[3] - trim[1])
    const image = await doc.embedJpg(face)
    page.drawImage(image, { x: 0, y: 0, width, height })
  }
  doc.setTitle("Modern Mail postcard")
  doc.setProducer("Modern Mail")
  doc.setCreator("Modern Mail")
  return doc.save({ useObjectStreams: false })
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => {
    if (char === "&") return "&amp;"
    if (char === "<") return "&lt;"
    if (char === ">") return "&gt;"
    return "&quot;"
  })
}
