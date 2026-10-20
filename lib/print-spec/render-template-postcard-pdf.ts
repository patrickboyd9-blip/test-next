import { readFileSync } from "node:fs"
import path from "node:path"

import fontkit from "@pdf-lib/fontkit"
import {
  clip,
  endPath,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib"

import { buildQrMatrix, QR_QUIET_MODULES } from "@/lib/campaign-creator/studio-qr"
import {
  canvasRect,
  composePostcardFace,
  geometryFor,
  type PhotoSlotPlan,
  type PostcardFacePlan,
  type ShapePlan,
} from "@/lib/postcard-layouts/compose"
import type { FontPairingId, PostcardSizeId, PostcardTemplateId, VerticalPaletteId } from "@/lib/postcard-layouts/ids"
import { trimInches } from "@/lib/postcard-layouts/templates"
import type { FittedText, InchRect } from "@/lib/postcard-layouts/typefit"
import {
  addressBackDisclaimerPlacement,
  addressBackPlan,
  addressBackQrPlacement,
  addressSideContentRect,
  type PostcardPrintCopy,
  type PostcardPrintImage,
  type RenderedPostcardPdf,
} from "@/lib/print-spec/render-campaign-postcard-pdf"
import { canvasRectToPdf, type PostcardGeometry } from "@/lib/print-spec/postcard-5x8-print-spec"
import { assertPrintImageDpi } from "@/lib/print-spec/render-campaign-postcard-pdf"

const FONT_DIR = path.join(process.cwd(), "lib/print-spec/fonts")

const DISPLAY_FILE: Record<FontPairingId, string> = {
  trade: "Archivo-ExtraBold.ttf",
  signal: "BarlowCondensed-Bold.ttf",
  letter: "Fraunces-Semibold.ttf",
}

export async function renderTemplatedPostcardPdf(input: {
  copy: PostcardPrintCopy
  templateId: PostcardTemplateId
  paletteId?: VerticalPaletteId
  size?: PostcardSizeId
  image?: PostcardPrintImage
  alternateImage?: PostcardPrintImage
}): Promise<RenderedPostcardPdf> {
  const size = input.size ?? "5x8"
  const spec = geometryFor(size)
  const planInput = {
    templateId: input.templateId,
    size,
    paletteId: input.paletteId ?? "general",
    businessName: input.copy.businessName,
    qrPayload: input.copy.qrPayload,
    disclaimer: Boolean(input.copy.disclaimer),
    complianceMark: input.copy.complianceMark,
    spec: input.copy,
  }
  const front = composePostcardFace({ ...planInput, face: "front" })
  const back = composePostcardFace({ ...planInput, face: "back" })
  if (front.overflows || front.missingContact.length > 0) {
    throw new Error(
      `Postcard front does not fit (${front.templateId}): ${front.missingContact.join(", ") || "type overflows"}.`
    )
  }
  if (back.overflows) {
    throw new Error(`Postcard back does not fit (${back.templateId}).`)
  }

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const display = await doc.embedFont(readFileSync(path.join(FONT_DIR, DISPLAY_FILE[front.pairing])), { subset: true })
  const text = await doc.embedFont(readFileSync(path.join(FONT_DIR, "SourceSans3-Regular.ttf")), { subset: true })
  const strong = await doc.embedFont(readFileSync(path.join(FONT_DIR, "SourceSans3-Semibold.ttf")), { subset: true })
  const images = await embedImages(doc, input.image, input.alternateImage, spec)

  const pageSize: [number, number] = [spec.pdfPagePoints.widthPoints, spec.pdfPagePoints.heightPoints]
  const frontPage = doc.addPage(pageSize)
  const backPage = doc.addPage(pageSize)
  markBoxes(frontPage, spec)
  markBoxes(backPage, spec)

  drawFront(frontPage, spec, front, images, input.copy.qrPayload, display, strong, text)
  drawBack(backPage, spec, input.copy, back, display, strong, text)

  const bytes = await doc.save({ useObjectStreams: false })
  assertTemplatedPage(bytes, spec)
  return {
    bytes,
    backContent: addressSideContentRect(spec),
    imageDpi: images.dpi,
    artwork: input.image ? "final-photo" : "type-plate",
  }
}

function drawFront(
  page: PDFPage,
  spec: PostcardGeometry,
  plan: PostcardFacePlan,
  images: EmbeddedImages,
  qrPayload: string | undefined,
  display: PDFFont,
  strong: PDFFont,
  text: PDFFont
) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: spec.pdfPagePoints.widthPoints,
    height: spec.pdfPagePoints.heightPoints,
    color: paint(plan.palette.paper),
  })
  for (const shape of plan.shapes.filter((item) => item.role === "paper" || item.role === "field")) {
    drawShape(page, spec, plan, shape)
  }
  plan.photos.forEach((slot, index) => {
    const image = index === 0 ? images.primary : images.alternate
    drawPhoto(page, spec, plan, slot, image, plan.palette.field)
  })
  for (const shape of plan.shapes.filter((item) => item.role !== "paper" && item.role !== "field")) {
    drawShape(page, spec, plan, shape)
  }
  drawTrust(page, spec, plan, strong)
  for (const line of plan.texts) drawFitted(page, spec, line, display, text)
  drawFrontLockup(page, spec, plan, qrPayload, display, strong, text)
}

function drawBack(
  page: PDFPage,
  spec: PostcardGeometry,
  copy: PostcardPrintCopy,
  plan: PostcardFacePlan,
  display: PDFFont,
  strong: PDFFont,
  text: PDFFont
) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: spec.pdfPagePoints.widthPoints,
    height: spec.pdfPagePoints.heightPoints,
    color: rgb(1, 1, 1),
  })
  const content = addressSideContentRect(spec)
  const address = addressBackPlan(copy)
  const box = canvasRectToPdf(content, spec.artworkCanvasInches.heightInches)
  const disclaimerBand = addressBackDisclaimerPlacement(content, address.disclaimer)
  const qr = addressBackQrPlacement(
    content,
    Boolean(address.qrPayload && buildQrMatrix(address.qrPayload)),
    Boolean(address.phone || address.website),
    disclaimerBand?.heightInches ?? 0
  )
  let top = box.yPoints + box.heightPoints - 4
  const ink = paint(plan.palette.ink)
  if (address.brand) {
    page.drawText(truncate(address.brand, strong, 11, box.widthPoints), {
      x: box.xPoints,
      y: top - 11,
      size: 11,
      font: strong,
      color: ink,
    })
    top -= 16
  }
  for (const line of address.returnLines) {
    page.drawText(truncate(line, text, 8, box.widthPoints), {
      x: box.xPoints,
      y: top - 8,
      size: 8,
      font: text,
      color: ink,
    })
    top -= 11
  }
  for (const shape of plan.shapes) drawShape(page, spec, plan, shape)
  for (const line of plan.texts) drawFitted(page, spec, line, display, text)
  if (disclaimerBand && address.disclaimer) {
    const disclaimerBox = canvasRectToPdf(disclaimerBand, spec.artworkCanvasInches.heightInches)
    drawWrapped(
      page,
      text,
      address.disclaimer,
      disclaimerBox.xPoints,
      disclaimerBox.yPoints + disclaimerBox.heightPoints - 2,
      disclaimerBox.widthPoints,
      8,
      ink
    )
  }
  if (qr && address.qrPayload) {
    const qrBox = canvasRectToPdf(qr, spec.artworkCanvasInches.heightInches)
    drawQr(page, address.qrPayload, qrBox.xPoints, qrBox.yPoints, qrBox.widthPoints)
    const contactX = qrBox.xPoints + qrBox.widthPoints + 8
    const lines = [address.phone, address.website, "Scan to book"].filter((line): line is string => Boolean(line))
    let cursor = qrBox.yPoints + qrBox.heightPoints - 4
    for (const line of lines) {
      const size = fitWidth(line, strong, 11, box.xPoints + box.widthPoints - contactX)
      cursor -= size
      page.drawText(line, { x: contactX, y: cursor, size, font: strong, color: ink })
      cursor -= 3
    }
  }
}

function drawPhoto(
  page: PDFPage,
  spec: PostcardGeometry,
  plan: PostcardFacePlan,
  slot: PhotoSlotPlan,
  image: PDFImage | null,
  wash: string
) {
  const expanded = slot.bleed ? expandBleed(slot.rect, plan.size, spec.bleedInchesPerSide) : slot.rect
  const pdf = canvasRectToPdf(canvasRect(expanded, spec.bleedInchesPerSide), spec.artworkCanvasInches.heightInches)
  if (!image) {
    page.drawRectangle({ x: pdf.xPoints, y: pdf.yPoints, width: pdf.widthPoints, height: pdf.heightPoints, color: paint(wash) })
    return
  }
  page.pushOperators(pushGraphicsState(), rectangle(pdf.xPoints, pdf.yPoints, pdf.widthPoints, pdf.heightPoints), clip(), endPath())
  const scale = Math.max(pdf.widthPoints / image.width, pdf.heightPoints / image.height)
  const width = image.width * scale
  const height = image.height * scale
  page.drawImage(image, {
    x: pdf.xPoints + (pdf.widthPoints - width) / 2,
    y: pdf.yPoints + (pdf.heightPoints - height) / 2,
    width,
    height,
  })
  page.pushOperators(popGraphicsState())
}

function drawShape(page: PDFPage, spec: PostcardGeometry, plan: PostcardFacePlan, shape: ShapePlan) {
  const expanded =
    shape.role === "field" ||
    shape.role === "paper" ||
    shape.role === "band" ||
    shape.role === "scrim" ||
    shape.role === "offer-tile"
      ? expandBleed(shape.rect, plan.size, spec.bleedInchesPerSide)
      : shape.rect
  const pdf = canvasRectToPdf(canvasRect(expanded, spec.bleedInchesPerSide), spec.artworkCanvasInches.heightInches)
  if (shape.role === "scrim") {
    drawScrim(page, pdf, plan.palette.scrim)
    return
  }
  if (shape.role === "starburst") {
    page.drawSvgPath(starPath(pdf.xPoints, pdf.yPoints, pdf.widthPoints, pdf.heightPoints), {
      color: paint(plan.palette.accent),
    })
    return
  }
  if (shape.role === "badge") {
    page.drawEllipse({
      x: pdf.xPoints + pdf.widthPoints / 2,
      y: pdf.yPoints + pdf.heightPoints / 2,
      xScale: pdf.widthPoints / 2,
      yScale: pdf.heightPoints / 2,
      color: paint(shape.fill),
    })
    return
  }
  if (shape.role === "chip") {
    page.drawSvgPath(pillPath(pdf.xPoints, pdf.yPoints, pdf.widthPoints, pdf.heightPoints), {
      color: paint(shape.fill),
    })
    return
  }
  if (shape.role === "coupon") {
    page.drawRectangle({
      x: pdf.xPoints,
      y: pdf.yPoints,
      width: pdf.widthPoints,
      height: pdf.heightPoints,
      borderColor: paint(plan.palette.accent),
      borderWidth: 1.25,
      borderDashArray: [3, 2],
      color: paint(shape.fill),
    })
    return
  }
  page.drawRectangle({
    x: pdf.xPoints,
    y: pdf.yPoints,
    width: pdf.widthPoints,
    height: pdf.heightPoints,
    color: paint(shape.fill),
  })
}

function drawFitted(page: PDFPage, spec: PostcardGeometry, line: FittedText, display: PDFFont, text: PDFFont) {
  if (line.lines.length === 0) return
  const font = line.font === "display" ? display : text
  const pdf = canvasRectToPdf(canvasRect(line.rect), spec.artworkCanvasInches.heightInches)
  let size = line.fontPt
  const widest = Math.max(...line.lines.map((item) => font.widthOfTextAtSize(item, size)))
  if (widest > pdf.widthPoints) size = fitWidth(line.lines.join(" "), font, size, pdf.widthPoints)
  const leading = size * (line.font === "display" ? 1.02 : 1.18)
  const block = line.lines.length * leading
  const spare =
    line.role === "offer" || line.role === "label" || line.role === "contact"
      ? Math.max(0, pdf.heightPoints - block) / 2
      : 0
  let cursor = pdf.yPoints + pdf.heightPoints - spare - size
  for (const row of line.lines) {
    if (cursor < pdf.yPoints - 1) break
    const rowWidth = font.widthOfTextAtSize(row, size)
    const x = line.align === "center" ? pdf.xPoints + Math.max(0, (pdf.widthPoints - rowWidth) / 2) : pdf.xPoints
    page.drawText(row, { x, y: cursor, size, font, color: paint(line.color) })
    cursor -= leading
  }
}

function drawFrontLockup(
  page: PDFPage,
  spec: PostcardGeometry,
  plan: PostcardFacePlan,
  payload: string | undefined,
  display: PDFFont,
  strong: PDFFont,
  text: PDFFont
) {
  const lockup = plan.lockup
  if (!lockup) return
  if (lockup.phoneBox) {
    const box = canvasRectToPdf(canvasRect(lockup.phoneBox.rect), spec.artworkCanvasInches.heightInches)
    page.drawRectangle({
      x: box.xPoints,
      y: box.yPoints,
      width: box.widthPoints,
      height: box.heightPoints,
      color: paint(lockup.phoneBox.fill),
    })
  }
  if (lockup.phone) drawFitted(page, spec, lockup.phone, display, strong)
  if (lockup.website) drawFitted(page, spec, lockup.website, display, text)
  if (!payload) return
  const pdf = canvasRectToPdf(canvasRect(lockup.qrRect), spec.artworkCanvasInches.heightInches)
  const labelSize = lockup.qrLabelPt
  const size = Math.min(lockup.qrInches * 72, Math.max(12, pdf.heightPoints - labelSize - 2))
  const qrY = pdf.yPoints + pdf.heightPoints - size
  drawQr(page, payload, pdf.xPoints, qrY, size)
  const labelWidth = strong.widthOfTextAtSize(lockup.qrLabel, labelSize)
  page.drawRectangle({
    x: pdf.xPoints,
    y: pdf.yPoints,
    width: Math.max(size, labelWidth),
    height: labelSize + 2,
    color: rgb(1, 1, 1),
  })
  page.drawText(lockup.qrLabel, {
    x: pdf.xPoints + Math.max(0, (size - labelWidth) / 2),
    y: pdf.yPoints + 1.5,
    size: labelSize,
    font: strong,
    color: paint("#14120f"),
  })
}

function drawTrust(page: PDFPage, spec: PostcardGeometry, plan: PostcardFacePlan, font: PDFFont) {
  for (const chip of plan.trust) {
    const pdf = canvasRectToPdf(canvasRect(chip.rect), spec.artworkCanvasInches.heightInches)
    page.drawSvgPath(pillPath(pdf.xPoints, pdf.yPoints, pdf.widthPoints, pdf.heightPoints), {
      color: paint(chip.fill),
    })
    const size = chip.fontPt
    const width = font.widthOfTextAtSize(chip.label, size)
    page.drawText(chip.label, {
      x: pdf.xPoints + Math.max(2, (pdf.widthPoints - width) / 2),
      y: pdf.yPoints + Math.max(1, (pdf.heightPoints - size) / 2),
      size,
      font,
      color: paint(chip.color),
    })
  }
}

function drawScrim(
  page: PDFPage,
  rect: { xPoints: number; yPoints: number; widthPoints: number; heightPoints: number },
  color: string
) {
  const steps = 16
  const band = rect.heightPoints / steps
  const ink = paint(color)
  for (let index = 0; index < steps; index += 1) {
    const t = index / (steps - 1)
    page.drawRectangle({
      x: rect.xPoints,
      y: rect.yPoints + rect.heightPoints - (index + 1) * band,
      width: rect.widthPoints,
      height: band + 0.6,
      color: ink,
      opacity: t * t * 0.94,
    })
  }
}

function drawQr(page: PDFPage, payload: string, x: number, y: number, size: number) {
  const matrix = buildQrMatrix(payload)
  if (!matrix || size <= 0) return
  const modules = matrix.length
  const total = modules + QR_QUIET_MODULES * 2
  const cell = size / total
  page.drawRectangle({ x, y, width: size, height: size, color: rgb(1, 1, 1) })
  const ink = rgb(0.08, 0.09, 0.1)
  for (let row = 0; row < modules; row += 1) {
    const line = matrix[row]
    if (!line) continue
    for (let col = 0; col < modules; col += 1) {
      if (!line[col]) continue
      page.drawRectangle({
        x: x + (col + QR_QUIET_MODULES) * cell,
        y: y + size - (row + QR_QUIET_MODULES + 1) * cell,
        width: cell,
        height: cell,
        color: ink,
      })
    }
  }
}

function drawWrapped(
  page: PDFPage,
  font: PDFFont,
  value: string,
  x: number,
  top: number,
  width: number,
  size: number,
  color: ReturnType<typeof rgb>
) {
  const words = value.split(/\s+/)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= width || !current) current = next
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  let cursor = top - size
  for (const line of lines.slice(0, 8)) {
    page.drawText(line, { x, y: cursor, size, font, color })
    cursor -= size + 2
  }
}

interface EmbeddedImages {
  primary: PDFImage | null
  alternate: PDFImage | null
  dpi: { x: number; y: number }
}

async function embedImages(
  doc: PDFDocument,
  primary: PostcardPrintImage | undefined,
  alternate: PostcardPrintImage | undefined,
  spec: PostcardGeometry
): Promise<EmbeddedImages> {
  const embed = async (image: PostcardPrintImage | undefined) => {
    if (!image) return null
    const kind = image.bytes[0] === 0xff && image.bytes[1] === 0xd8 ? "jpeg" : "png"
    return kind === "jpeg" ? doc.embedJpg(image.bytes) : doc.embedPng(image.bytes)
  }
  const dpi = primary
    ? assertPrintImageDpi({ width: primary.width, height: primary.height }, spec.artworkCanvasInches)
    : { x: 300, y: 300 }
  return { primary: await embed(primary), alternate: await embed(alternate), dpi }
}

function expandBleed(rect: InchRect, size: PostcardSizeId, bleed: number): InchRect {
  const trim = trimInches(size)
  let { x, y, w, h } = rect
  if (x <= 0.02) {
    x -= bleed
    w += bleed
  }
  if (y <= 0.02) {
    y -= bleed
    h += bleed
  }
  if (x + w >= trim.w - 0.02) w += bleed
  if (y + h >= trim.h - 0.02) h += bleed
  return { x, y, w, h }
}

function pillPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(h / 2, w / 2)
  const k = r * 0.5522847498
  return [
    `M ${(x + r).toFixed(2)} ${y.toFixed(2)}`,
    `L ${(x + w - r).toFixed(2)} ${y.toFixed(2)}`,
    `C ${(x + w - r + k).toFixed(2)} ${y.toFixed(2)} ${x + w} ${(y + r - k).toFixed(2)} ${x + w} ${(y + r).toFixed(2)}`,
    `L ${x + w} ${(y + h - r).toFixed(2)}`,
    `C ${x + w} ${(y + h - r + k).toFixed(2)} ${(x + w - r + k).toFixed(2)} ${y + h} ${(x + w - r).toFixed(2)} ${y + h}`,
    `L ${(x + r).toFixed(2)} ${y + h}`,
    `C ${(x + r - k).toFixed(2)} ${y + h} ${x} ${(y + h - r + k).toFixed(2)} ${x} ${(y + h - r).toFixed(2)}`,
    `L ${x} ${(y + r).toFixed(2)}`,
    `C ${x} ${(y + r - k).toFixed(2)} ${(x + r - k).toFixed(2)} ${y.toFixed(2)} ${(x + r).toFixed(2)} ${y.toFixed(2)}`,
    "Z",
  ].join(" ")
}

function starPath(x: number, y: number, w: number, h: number): string {
  const points = 16
  const parts: string[] = []
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? 0.5 : 0.36
    const angle = -Math.PI / 2 + (index * Math.PI) / points
    const px = x + w / 2 + Math.cos(angle) * w * radius
    const py = y + h / 2 + Math.sin(angle) * h * radius
    parts.push(`${index === 0 ? "M" : "L"} ${px.toFixed(2)} ${py.toFixed(2)}`)
  }
  return `${parts.join(" ")} Z`
}

function paint(hex: string): ReturnType<typeof rgb> {
  const value = hex.replace("#", "")
  return rgb(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255
  )
}

function fitWidth(value: string, font: PDFFont, start: number, width: number): number {
  let size = start
  while (size > 6 && font.widthOfTextAtSize(value, size) > width) size -= 0.5
  return size
}

function truncate(value: string, font: PDFFont, size: number, width: number): string {
  if (font.widthOfTextAtSize(value, size) <= width) return value
  let next = value
  while (next.length > 1 && font.widthOfTextAtSize(`${next}…`, size) > width) next = next.slice(0, -1)
  return `${next}…`
}

function markBoxes(page: PDFPage, spec: PostcardGeometry) {
  const trim = spec.trimBox
  const bleed = spec.bleedBox
  page.setTrimBox(trim[0], trim[1], trim[2] - trim[0], trim[3] - trim[1])
  page.setBleedBox(bleed[0], bleed[1], bleed[2] - bleed[0], bleed[3] - bleed[1])
}

async function assertTemplatedPage(bytes: Uint8Array, spec: PostcardGeometry): Promise<void> {
  const doc = await PDFDocument.load(bytes)
  if (doc.getPageCount() !== 2) throw new Error("Print PDF must be 2 pages.")
  const expectedW = spec.pdfPagePoints.widthPoints
  const expectedH = spec.pdfPagePoints.heightPoints
  for (const page of doc.getPages()) {
    const size = page.getSize()
    if (Math.abs(size.width - expectedW) > 0.05 || Math.abs(size.height - expectedH) > 0.05) {
      throw new Error(`Print PDF page is ${size.width} by ${size.height} points.`)
    }
  }
}

// drawFront calls drawLockup which no longer paints the QR. Paint it here.