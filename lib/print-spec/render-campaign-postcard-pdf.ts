import { readFileSync } from "node:fs"
import path from "node:path"

import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib"

import { buildQrMatrix, QR_QUIET_MODULES } from "../campaign-creator/studio-qr"

import type { InchesRect } from "./postcard-5x8-print-spec"
import {
  buildPostcard5x8PrintSpec,
  canvasRectToPdf,
  type Postcard5x8PrintSpec,
} from "./postcard-5x8-print-spec"
import { encodeSolidPng, effectiveDpi, readRasterSize } from "./raster"

export const MIN_EFFECTIVE_DPI = 300

const FONT_DIR = path.join(process.cwd(), "lib/print-spec/fonts")

export interface PostcardPrintCopy {
  headline?: string
  body?: string
  offer?: string
  callToAction?: string
  businessName?: string
  phone?: string
  website?: string
  /** Scan target painted inside the address-side content box. */
  qrPayload?: string
  /** Return lines in the content box. The vendor address panel stays blank. */
  returnLines?: string[]
}

export interface AddressBackPlan {
  returnLines: string[]
  brand?: string
  message?: string
  supporting?: string
  offer?: string
  phone?: string
  website?: string
  callToAction?: string
  qrPayload?: string
}

const QR_MAX_INCHES = 1.05

export function addressBackPlan(copy: PostcardPrintCopy): AddressBackPlan {
  const brand = textOf(copy.businessName)
  const headline = textOf(copy.headline)
  const body = textOf(copy.body)
  return {
    returnLines: (copy.returnLines ?? []).map(textOf).filter((line): line is string => Boolean(line)).slice(0, 3),
    brand,
    message: headline || body,
    supporting: headline && body && body !== headline ? body : undefined,
    offer: textOf(copy.offer),
    phone: textOf(copy.phone),
    website: textOf(copy.website),
    callToAction: textOf(copy.callToAction),
    qrPayload: textOf(copy.qrPayload),
  }
}

/** QR slot inside the address-side content box, canvas inches, y down. */
export function addressBackQrPlacement(content: InchesRect, hasQr: boolean): InchesRect | null {
  if (!hasQr) return null
  const size = Math.min(QR_MAX_INCHES, content.widthInches * 0.42, content.heightInches * 0.34)
  if (size < 0.6) return null
  return {
    xInches: content.xInches,
    yInches: content.yInches + content.heightInches - size,
    widthInches: size,
    heightInches: size,
  }
}

export interface PostcardPrintImage {
  bytes: Uint8Array
  width: number
  height: number
}

export interface RenderedPostcardPdf {
  bytes: Uint8Array
  /** Address-side copy box, canvas inches, y down. It does not meet a keep-out. */
  backContent: InchesRect
  imageDpi: { x: number; y: number }
  artwork: "final-photo" | "type-plate"
}

export function rectsOverlap(a: InchesRect, b: InchesRect): boolean {
  const gap = 0.01
  return (
    a.xInches + a.widthInches > b.xInches + gap &&
    b.xInches + b.widthInches > a.xInches + gap &&
    a.yInches + a.heightInches > b.yInches + gap &&
    b.yInches + b.heightInches > a.yInches + gap
  )
}

/**
 * Message area on the address side: left of the mailing panel and above the
 * barcode strip. Measured in canvas inches (bleed edge, y down).
 */
export function addressSideContentRect(
  spec: Postcard5x8PrintSpec = buildPostcard5x8PrintSpec()
): InchesRect {
  const panel = spec.keepOuts.find((item) => item.id === "mailing_panel")
  const strip = spec.keepOuts.find((item) => item.id === "barcode_strip")
  if (!panel || !strip) throw new Error("5×8 print spec is missing address keep-outs.")

  const x = spec.safeTextOnCanvas.xInches
  const y = spec.safeTextOnCanvas.yInches
  const rect: InchesRect = {
    xInches: x,
    yInches: y,
    widthInches: panel.canvas.xInches - 0.15 - x,
    heightInches: strip.canvas.yInches - 0.12 - y,
  }
  if (rect.widthInches <= 1 || rect.heightInches <= 1) {
    throw new Error("Address-side content area is too small to print.")
  }
  for (const keepOut of spec.keepOuts) {
    if (rectsOverlap(rect, keepOut.canvas)) {
      throw new Error(`Postcard copy overlaps the ${keepOut.id} keep-out.`)
    }
  }
  return rect
}

export function assertPrintImageDpi(
  size: { width: number; height: number },
  page = buildPostcard5x8PrintSpec().artworkCanvasInches
): { x: number; y: number } {
  const dpiX = effectiveDpi(size.width, page.widthInches)
  const dpiY = effectiveDpi(size.height, page.heightInches)
  if (dpiX < MIN_EFFECTIVE_DPI - 0.01 || dpiY < MIN_EFFECTIVE_DPI - 0.01) {
    throw new Error(
      `This photograph is ${size.width}×${size.height} pixels. On an ${page.widthInches}×${page.heightInches} in page that is ${Math.floor(dpiX)}×${Math.floor(dpiY)} DPI. Print export needs at least 300 DPI and will not enlarge a smaller image.`
    )
  }
  return { x: dpiX, y: dpiY }
}

export async function renderPostcardPrintPdf(input: {
  copy: PostcardPrintCopy
  image?: PostcardPrintImage
  plateColor?: readonly [number, number, number]
}): Promise<RenderedPostcardPdf> {
  const spec = buildPostcard5x8PrintSpec()
  const backContent = addressSideContentRect(spec)
  const plateColor = input.plateColor ?? [30, 58, 95]
  const artwork = input.image ? "final-photo" : "type-plate"
  const image = input.image ?? solidPlate(spec, plateColor)
  const imageDpi = assertPrintImageDpi(
    { width: image.width, height: image.height },
    spec.artworkCanvasInches
  )
  const measured = readRasterSize(image.bytes)
  if (measured.width !== image.width || measured.height !== image.height) {
    throw new Error("Print photograph dimensions do not match the file.")
  }

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const regular = await doc.embedFont(readFont("SourceSans3-Regular.ttf"), { subset: true })
  const semibold = await doc.embedFont(readFont("SourceSans3-Semibold.ttf"), { subset: true })
  const embedded = measured.kind === "jpeg" ? await doc.embedJpg(image.bytes) : await doc.embedPng(image.bytes)

  const width = spec.pdfPagePoints.widthPoints
  const height = spec.pdfPagePoints.heightPoints
  const front = doc.addPage([width, height])
  const back = doc.addPage([width, height])
  markBoxes(front, spec)
  markBoxes(back, spec)

  front.drawImage(embedded, { x: 0, y: 0, width, height })
  drawFrontCaption(front, spec, input.copy, regular, semibold)
  drawBack(back, spec, backContent, input.copy, regular, semibold)

  doc.setTitle("Modern Mail 5x8 postcard")
  doc.setProducer("Modern Mail")
  doc.setCreator("Modern Mail")

  // Object streams hide font files inside compressed containers. A print RIP
  // reads a plain file more reliably, and the font file stays visible.
  const bytes = await doc.save({ useObjectStreams: false })
  await assertPostcardPrintPdf(bytes)
  return { bytes, backContent, imageDpi, artwork }
}

/** Smoke-test postcard. The address side uses the same back layout as an approved piece. */
export const SAMPLE_POSTCARD_COPY: PostcardPrintCopy = {
  businessName: "Northwind HVAC",
  headline: "A quieter house",
  body: "We check the system and tell you what it needs.",
  offer: "Free inspection",
  callToAction: "Call to book",
  phone: "555-0100",
  website: "northwind.example",
  qrPayload: "https://northwind.example/inspect",
  returnLines: ["100 Market St, Austin, TX 78701"],
}

export async function renderSamplePostcardPdf(): Promise<Uint8Array> {
  const rendered = await renderPostcardPrintPdf({ copy: SAMPLE_POSTCARD_COPY })
  return rendered.bytes
}

export async function assertPostcardPrintPdf(bytes: Uint8Array): Promise<void> {
  const doc = await PDFDocument.load(bytes)
  if (doc.getPageCount() !== 2) throw new Error("Print PDF must be 2 pages.")
  for (const page of doc.getPages()) {
    const size = page.getSize()
    if (Math.abs(size.width - 612) > 0.05 || Math.abs(size.height - 396) > 0.05) {
      throw new Error(`Print PDF page is ${size.width} by ${size.height} points. It must be 612 by 396.`)
    }
    const trim = page.getTrimBox()
    if (Math.abs(trim.width - 576) > 0.2 || Math.abs(trim.height - 360) > 0.2) {
      throw new Error("Print PDF trim box is not the 8 by 5 inch card.")
    }
  }
  const raw = Buffer.from(bytes).toString("latin1")
  if (!raw.includes("/FontFile2") && !raw.includes("/FontFile3")) {
    throw new Error("Print PDF does not have embedded fonts.")
  }
}

const fontCache = new Map<string, Buffer>()
const plateCache = new Map<string, Buffer>()

function readFont(fileName: string): Buffer {
  const cached = fontCache.get(fileName)
  if (cached) return cached
  const bytes = readFileSync(path.join(FONT_DIR, fileName))
  fontCache.set(fileName, bytes)
  return bytes
}

function solidPlate(
  spec: Postcard5x8PrintSpec,
  color: readonly [number, number, number]
): PostcardPrintImage {
  const key = `${spec.pixelSize.widthPx}x${spec.pixelSize.heightPx}:${color.join(",")}`
  let bytes = plateCache.get(key)
  if (!bytes) {
    bytes = encodeSolidPng(spec.pixelSize.widthPx, spec.pixelSize.heightPx, color)
    plateCache.set(key, bytes)
  }
  return { bytes, width: spec.pixelSize.widthPx, height: spec.pixelSize.heightPx }
}

function markBoxes(page: PDFPage, spec: Postcard5x8PrintSpec) {
  const trim = spec.trimBox
  const bleed = spec.bleedBox
  page.setTrimBox(trim[0], trim[1], trim[2] - trim[0], trim[3] - trim[1])
  page.setBleedBox(bleed[0], bleed[1], bleed[2] - bleed[0], bleed[3] - bleed[1])
}

function drawFrontCaption(
  page: PDFPage,
  spec: Postcard5x8PrintSpec,
  copy: PostcardPrintCopy,
  regular: PDFFont,
  semibold: PDFFont
) {
  const safe = spec.safeTextOnCanvas
  const band: InchesRect = {
    xInches: safe.xInches,
    yInches: safe.yInches + safe.heightInches - 1.4,
    widthInches: safe.widthInches,
    heightInches: 1.4,
  }
  const box = canvasRectToPdf(band, spec.artworkCanvasInches.heightInches)
  page.drawRectangle({
    x: box.xPoints,
    y: box.yPoints,
    width: box.widthPoints,
    height: box.heightPoints,
    color: rgb(0.1, 0.14, 0.2),
  })
  const text = [copy.headline, copy.offer, copy.callToAction].filter(Boolean).join("  ·  ")
  drawWrapped({
    page,
    font: semibold,
    text: text || "Postcard",
    x: box.xPoints + 12,
    top: box.yPoints + box.heightPoints - 16,
    width: box.widthPoints - 24,
    size: 16,
    leading: 20,
    color: rgb(1, 1, 1),
    maxLines: 3,
  })
  if (copy.businessName) {
    page.drawText(truncate(copy.businessName, regular, 9, box.widthPoints - 24), {
      x: box.xPoints + 12,
      y: box.yPoints + 10,
      size: 9,
      font: regular,
      color: rgb(0.86, 0.9, 0.94),
    })
  }
}

function drawBack(
  page: PDFPage,
  spec: Postcard5x8PrintSpec,
  content: InchesRect,
  copy: PostcardPrintCopy,
  regular: PDFFont,
  semibold: PDFFont
) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: spec.pdfPagePoints.widthPoints,
    height: spec.pdfPagePoints.heightPoints,
    color: rgb(1, 1, 1),
  })
  const plan = addressBackPlan(copy)
  const box = canvasRectToPdf(content, spec.artworkCanvasInches.heightInches)
  const qr = addressBackQrPlacement(content, Boolean(plan.qrPayload && buildQrMatrix(plan.qrPayload)))
  const qrPoints = qr ? qr.widthInches * 72 : 0
  const textFloor = box.yPoints + (qrPoints > 0 ? qrPoints + 8 : 4)
  const ink = rgb(0.12, 0.14, 0.18)
  const muted = rgb(0.28, 0.32, 0.38)
  let top = box.yPoints + box.heightPoints - 2

  if (plan.brand && top > textFloor) {
    top = drawWrapped({
      page,
      font: semibold,
      text: plan.brand,
      x: box.xPoints,
      top,
      width: box.widthPoints,
      size: 12,
      leading: 15,
      color: ink,
      maxLines: linesThatFit(top, textFloor, 15, 2),
    })
    top -= 4
  }
  for (const line of plan.returnLines) {
    if (top - 10 < textFloor) break
    page.drawText(truncate(line, regular, 8, box.widthPoints), {
      x: box.xPoints,
      y: top - 8,
      size: 8,
      font: regular,
      color: muted,
    })
    top -= 11
  }
  if (plan.returnLines.length > 0) top -= 6
  if (plan.message && top > textFloor) {
    top = drawWrapped({
      page,
      font: semibold,
      text: plan.message,
      x: box.xPoints,
      top,
      width: box.widthPoints,
      size: 16,
      leading: 19,
      color: ink,
      maxLines: linesThatFit(top, textFloor, 19, 3),
    })
    top -= 6
  }
  if (plan.offer && top > textFloor) {
    top = drawWrapped({
      page,
      font: semibold,
      text: plan.offer,
      x: box.xPoints,
      top,
      width: box.widthPoints,
      size: 12,
      leading: 15,
      color: ink,
      maxLines: linesThatFit(top, textFloor, 15, 2),
    })
    top -= 6
  }
  if (plan.supporting && top > textFloor) {
    top = drawWrapped({
      page,
      font: regular,
      text: plan.supporting,
      x: box.xPoints,
      top,
      width: box.widthPoints,
      size: 10,
      leading: 13,
      color: ink,
      maxLines: linesThatFit(top, textFloor, 13, 4),
    })
    top -= 8
  }
  if (!qr && plan.callToAction && top > textFloor) {
    const contact = [plan.callToAction, plan.phone, plan.website].filter(Boolean).join("   ")
    drawWrapped({
      page,
      font: regular,
      text: contact,
      x: box.xPoints,
      top,
      width: box.widthPoints,
      size: 10,
      leading: 13,
      color: muted,
      maxLines: linesThatFit(top, textFloor, 13, 3),
    })
  }

  if (qr && plan.qrPayload) {
    drawQr(page, plan.qrPayload, box.xPoints, box.yPoints, qrPoints)
    const contactX = box.xPoints + qrPoints + 8
    const contactWidth = box.widthPoints - qrPoints - 8
    const beside = [plan.phone, plan.website, plan.callToAction].filter((line): line is string => Boolean(line))
    if (contactWidth > 36) {
      let cursor = box.yPoints + qrPoints - 12
      for (const line of beside) {
        if (cursor < box.yPoints) break
        page.drawText(truncate(line, regular, 9, contactWidth), {
          x: contactX,
          y: cursor,
          size: 9,
          font: regular,
          color: ink,
        })
        cursor -= 12
      }
    }
  }
}

function linesThatFit(top: number, floor: number, leading: number, cap: number): number {
  const room = Math.floor((top - floor) / leading)
  return Math.max(0, Math.min(cap, room))
}

function drawQr(page: PDFPage, payload: string, x: number, y: number, size: number) {
  const matrix = buildQrMatrix(payload)
  if (!matrix || size <= 0) return
  const modules = matrix.length
  const total = modules + QR_QUIET_MODULES * 2
  const cell = size / total
  page.drawRectangle({
    x,
    y,
    width: size,
    height: size,
    color: rgb(1, 1, 1),
  })
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

function textOf(value: string | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, " ").trim()
  return trimmed || undefined
}

function drawWrapped(options: {
  page: PDFPage
  font: PDFFont
  text: string
  x: number
  top: number
  width: number
  size: number
  leading: number
  color: ReturnType<typeof rgb>
  maxLines: number
}): number {
  if (options.maxLines < 1 || !options.text.trim()) return options.top
  const lines = wrapText(options.text, options.font, options.size, options.width).slice(0, options.maxLines)
  let cursor = options.top - options.size
  for (const line of lines) {
    options.page.drawText(line, {
      x: options.x,
      y: cursor,
      size: options.size,
      font: options.font,
      color: options.color,
    })
    cursor -= options.leading
  }
  return cursor + options.leading
}

function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= width) {
      current = next
      continue
    }
    if (current) lines.push(current)
    current = truncate(word, font, size, width)
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : []
}

function truncate(text: string, font: PDFFont, size: number, width: number): string {
  if (font.widthOfTextAtSize(text, size) <= width) return text
  let next = text
  while (next.length > 1 && font.widthOfTextAtSize(`${next}…`, size) > width) {
    next = next.slice(0, -1)
  }
  return `${next}…`
}
