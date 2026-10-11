import { PDFDocument } from "pdf-lib"

import type { PostcardGeometry } from "@/lib/print-spec/postcard-5x8-print-spec"

import { sniffDesignMedia } from "./decode-raster"

export interface UploadedFaceBytes {
  bytes: Uint8Array
  mediaType: "application/pdf" | "image/png" | "image/jpeg"
}

/**
 * Two-page print file at the artwork canvas size.
 * The customer's front and back are placed full-bleed. The address area is
 * left as they approved it. This is the file the staging mail path uploads.
 */
export async function renderUploadedPostcardPdf(input: {
  geometry: PostcardGeometry
  front: UploadedFaceBytes
  back: UploadedFaceBytes
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const width = input.geometry.pdfPagePoints.widthPoints
  const height = input.geometry.pdfPagePoints.heightPoints
  const trim = input.geometry.trimBox

  for (const face of [input.front, input.back]) {
    const page = doc.addPage([width, height])
    page.setMediaBox(0, 0, width, height)
    page.setBleedBox(0, 0, width, height)
    page.setTrimBox(trim[0], trim[1], trim[2] - trim[0], trim[3] - trim[1])
    await paintFace(doc, page, face, width, height)
  }

  doc.setTitle("Modern Mail postcard")
  doc.setProducer("Modern Mail")
  doc.setCreator("Modern Mail")
  return doc.save({ useObjectStreams: false })
}

async function paintFace(
  doc: PDFDocument,
  page: ReturnType<PDFDocument["addPage"]>,
  face: UploadedFaceBytes,
  width: number,
  height: number
): Promise<void> {
  const media = sniffDesignMedia(face.bytes, face.mediaType) ?? face.mediaType
  if (media === "application/pdf") {
    const source = await PDFDocument.load(face.bytes, { ignoreEncryption: true })
    const [embedded] = await doc.embedPages([source.getPage(0)])
    page.drawPage(embedded, { x: 0, y: 0, width, height })
    return
  }
  const image =
    media === "image/jpeg" ? await doc.embedJpg(face.bytes) : await doc.embedPng(face.bytes)
  page.drawImage(image, { x: 0, y: 0, width, height })
}
