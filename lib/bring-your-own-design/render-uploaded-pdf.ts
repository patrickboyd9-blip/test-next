import { PDFDocument, rgb } from "pdf-lib"

import type { PostcardGeometry } from "@/lib/print-spec/postcard-5x8-print-spec"

import { sniffDesignMedia } from "./decode-raster"

export interface UploadedFaceBytes {
  bytes: Uint8Array
  mediaType: "application/pdf" | "image/png" | "image/jpeg"
}

/**
 * Two-page print file at the artwork canvas size.
 * Each face is the prepared file when one exists, placed without stretching.
 * The address area is left as the customer approved it.
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
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) })
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
    const scale = Math.min(width / embedded.width, height / embedded.height)
    const drawW = embedded.width * scale
    const drawH = embedded.height * scale
    page.drawPage(embedded, {
      x: (width - drawW) / 2,
      y: (height - drawH) / 2,
      width: drawW,
      height: drawH,
    })
    return
  }
  const image =
    media === "image/jpeg" ? await doc.embedJpg(face.bytes) : await doc.embedPng(face.bytes)
  const scale = Math.min(width / image.width, height / image.height)
  const drawW = image.width * scale
  const drawH = image.height * scale
  page.drawImage(image, {
    x: (width - drawW) / 2,
    y: (height - drawH) / 2,
    width: drawW,
    height: drawH,
  })
}
