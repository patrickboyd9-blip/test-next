import { degrees, PDFDocument, rgb } from "pdf-lib"

import { decodeRaster, readRasterDpi, sniffDesignMedia } from "./decode-raster"
import type { DesignFace, DesignPreflightIssue } from "./preflight"
import { inspectPdf } from "./pdf-inspect"
import { encodeRgbaPng } from "@/lib/print-spec/render-design-template-png"
import {
  canvasRectToPixels,
  type PostcardGeometry,
} from "@/lib/print-spec/postcard-5x8-print-spec"
import { PRINT_SPEC_DPI } from "@/lib/print-spec/postcard-5x8-print-spec"
import { readRasterSize } from "@/lib/print-spec/raster"

const MAX_EDGE = 8000
const MAX_PIXELS = 16_000_000
const SHARP_PPI = 220

export interface PreparedFace {
  bytes: Buffer
  mediaType: "image/png" | "application/pdf"
  issues: DesignPreflightIssue[]
  /** clear: address area is empty. covered: the customer must choose. unknown: a PDF we could not read. */
  address: "clear" | "covered" | "unknown" | "front"
}

/**
 * Fit one uploaded picture or PDF onto the postcard page.
 * Proportions stay. A small mark is not blown up into a fake full-card design.
 * A page-shaped file is fitted, and a soft source is labeled soft instead of being "fixed."
 */
export async function prepareDesignFace(input: {
  bytes: Uint8Array
  declaredType: string
  face: DesignFace
  geometry: PostcardGeometry
}): Promise<{ ok: true; prepared: PreparedFace } | { ok: false; error: string }> {
  const media = sniffDesignMedia(input.bytes, input.declaredType)
  if (media === "application/pdf") return preparePdf(input.bytes, input.face, input.geometry)
  if (media !== "image/png" && media !== "image/jpeg") {
    return { ok: false, error: "Save this as a PDF, PNG, or JPG. Other file types can't be printed from here." }
  }
  return prepareRaster(input.bytes, media === "image/jpeg" ? "jpeg" : "png", input.face, input.geometry)
}

async function prepareRaster(
  bytes: Uint8Array,
  kind: "png" | "jpeg",
  face: DesignFace,
  geometry: PostcardGeometry
): Promise<{ ok: true; prepared: PreparedFace } | { ok: false; error: string }> {
  let size
  try {
    size = readRasterSize(bytes)
  } catch {
    return { ok: false, error: "We couldn't read this picture. Export it again as a PNG or JPG." }
  }
  if (size.width > MAX_EDGE || size.height > MAX_EDGE || size.width * size.height > MAX_PIXELS) {
    return {
      ok: false,
      error: "This picture is too large to prepare. Use a PNG or JPG under 8,000 pixels on a side.",
    }
  }
  const decoded = decodeRaster(bytes, kind)
  if (!decoded || decoded.width < 2 || decoded.height < 2) {
    return { ok: false, error: "We couldn't read this picture. Export it again as a PNG or JPG." }
  }

  const dpi = readRasterDpi(bytes, kind)
  const match = matchPage(decoded.width, decoded.height, dpi, geometry)
  let rgba = decoded.rgba
  let width = decoded.width
  let height = decoded.height
  if (match?.swapped) {
    const turned = rotateClockwise(rgba, width, height)
    rgba = turned.rgba
    width = turned.width
    height = turned.height
  }

  const canvasW = geometry.pixelSize.widthPx
  const canvasH = geometry.pixelSize.heightPx
  const background = backgroundColor(rgba, width, height)
  const dest = new Uint8Array(canvasW * canvasH * 4)
  fill(dest, background)

  const issues: DesignPreflightIssue[] = []
  let address: PreparedFace["address"] = face === "back" ? "clear" : "front"

  if (match) {
    const rect = pageRect(match.kind, geometry)
    blit(dest, canvasW, canvasH, rgba, width, height, rect)
    extendEdges(dest, canvasW, canvasH, rect)
    const sourcePpi = (width / rect.w) * PRINT_SPEC_DPI
    if (sourcePpi < SHARP_PPI) {
      issues.push(
        note(
          face,
          "resolution",
          "This picture matches the card, but it is softer than a sharp print. Fitting it onto the page does not add detail. Small type may look soft."
        )
      )
    }
    if (match.kind !== "artwork" || match.swapped || Math.abs(sourcePpi - PRINT_SPEC_DPI) > 20) {
      issues.push(
        note(
          face,
          "prepared",
          "We fitted this to the postcard, including the extra edge the printer trims. It was not stretched, and the picture was not cropped."
        )
      )
    }
    if (face === "back" && keepOutHasInk(dest, canvasW, canvasH, geometry)) {
      const moved = moveContentOffAddress(dest, canvasW, canvasH, rgba, width, height, background, geometry)
      if (moved) {
        issues.push(
          note(
            face,
            "prepared",
            "We moved the back so the address, postage, and barcode stay clear. The proof shows the finished card."
          )
        )
      } else {
        address = "covered"
        issues.push(
          note(
            face,
            "keep_out",
            "The address, postage, and barcode will cover part of this back. That part of the picture will not show. You can print it this way, or upload a different back."
          )
        )
      }
    }
  } else {
    const content = contentBounds(rgba, width, height, background)
    const fillsFile = content.width * content.height > width * height * 0.9
    const paper: [number, number, number] = fillsFile ? [255, 255, 255] : background
    fill(dest, paper)
    const free = face === "back" ? clearPixelRect(geometry) : canvasRectToPixels(geometry.safeTextOnCanvas)
    const placed = containRect(content.width, content.height, free, 1)
    blit(dest, canvasW, canvasH, rgba, width, height, placed, content)
    issues.push(
      note(
        face,
        "prepared",
        "We placed this picture on the card at its real size so it stays sharp. It was not stretched to fill the postcard. The proof is the finished card."
      )
    )
  }

  return {
    ok: true,
    prepared: {
      bytes: encodeRgbaPng(canvasW, canvasH, dest, PRINT_SPEC_DPI),
      mediaType: "image/png",
      issues,
      address,
    },
  }
}

async function preparePdf(
  bytes: Uint8Array,
  face: DesignFace,
  geometry: PostcardGeometry
): Promise<{ ok: true; prepared: PreparedFace } | { ok: false; error: string }> {
  let source: PDFDocument
  try {
    source = await PDFDocument.load(bytes, { ignoreEncryption: true })
  } catch {
    return { ok: false, error: "We couldn't open this PDF. Export it again from your design app." }
  }
  if (source.getPageCount() !== 1) {
    return { ok: false, error: "Upload the front as one file and the back as another." }
  }
  const embeddedSource = source.getPage(0)
  const widthInches = embeddedSource.getWidth() / 72
  const heightInches = embeddedSource.getHeight() / 72
  const match = matchInches(widthInches, heightInches, geometry)
  const swapped = Boolean(match?.swapped)

  const pageW = geometry.pdfPagePoints.widthPoints
  const pageH = geometry.pdfPagePoints.heightPoints
  const full = { x: 0, y: 0, w: pageW, h: pageH }
  const fitted = face === "back" ? clearPdfRect(geometry) : pdfRect(geometry.safeTextOnCanvas, geometry)
  const pageSized = Boolean(match)

  let inspected: Awaited<ReturnType<typeof inspectPdf>> | null = null
  if (face === "back" && pageSized) {
    try {
      inspected = await inspectPdf(bytes, geometry, face)
    } catch {
      inspected = null
    }
  }
  const covers =
    face === "back" && pageSized && (inspected?.keepOutHasMarks === true || inspected?.keepOutUnchecked === true)
  const placeIn = covers || pageSized ? full : fitted

  const doc = await PDFDocument.create()
  const page = doc.addPage([pageW, pageH])
  page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(1, 1, 1) })
  const [embedded] = await doc.embedPages([embeddedSource])
  drawFittedPage(page, embedded, embeddedSource.getWidth(), embeddedSource.getHeight(), placeIn, swapped)

  const issues: DesignPreflightIssue[] = []
  let address: PreparedFace["address"] = face === "back" ? "clear" : "front"
  if (!match || match.kind !== "artwork" || swapped) {
    issues.push(
      note(
        face,
        "prepared",
        "We fitted this file onto the postcard without stretching it. The proof is the finished page."
      )
    )
  }
  if (covers && inspected?.keepOutHasMarks) {
    address = "covered"
    issues.push(
      note(
        face,
        "keep_out",
        "The address, postage, and barcode will cover part of this back. That part of the design will not show. You can print it this way, or upload a different back."
      )
    )
  } else if (covers && inspected?.keepOutUnchecked) {
    address = "unknown"
  } else if (face === "back" && !pageSized) {
    issues.push(
      note(
        face,
        "prepared",
        "We placed this file on the back so the address, postage, and barcode stay clear."
      )
    )
  }

  const saved = await doc.save({ useObjectStreams: false })
  return {
    ok: true,
    prepared: { bytes: Buffer.from(saved), mediaType: "application/pdf", issues, address },
  }
}

function drawFittedPage(
  page: ReturnType<PDFDocument["addPage"]>,
  embedded: Awaited<ReturnType<PDFDocument["embedPages"]>>[number],
  sourceWidth: number,
  sourceHeight: number,
  dest: { x: number; y: number; w: number; h: number },
  swapped: boolean
): void {
  if (!swapped) {
    const scale = Math.min(dest.w / sourceWidth, dest.h / sourceHeight)
    const width = sourceWidth * scale
    const height = sourceHeight * scale
    page.drawPage(embedded, {
      x: dest.x + (dest.w - width) / 2,
      y: dest.y + (dest.h - height) / 2,
      width,
      height,
    })
    return
  }
  const scale = Math.min(dest.w / sourceHeight, dest.h / sourceWidth)
  const visualW = sourceHeight * scale
  const visualH = sourceWidth * scale
  const left = dest.x + (dest.w - visualW) / 2
  const bottom = dest.y + (dest.h - visualH) / 2
  page.drawPage(embedded, {
    x: left + visualW,
    y: bottom,
    width: sourceWidth * scale,
    height: sourceHeight * scale,
    rotate: degrees(90),
  })
}

type PageKind = "artwork" | "trim" | "eighth"

function matchPage(
  widthPx: number,
  heightPx: number,
  dpi: number | null,
  geometry: PostcardGeometry
): { kind: PageKind; swapped: boolean } | null {
  if (dpi && dpi >= 36 && dpi <= 1200) {
    const byDpi = matchInches(widthPx / dpi, heightPx / dpi, geometry)
    if (byDpi) return byDpi
  }
  const pixelMatch = matchPixels(widthPx, heightPx, geometry)
  if (pixelMatch) return pixelMatch
  const ratio = widthPx / heightPx
  const artwork = geometry.artworkCanvasInches.widthInches / geometry.artworkCanvasInches.heightInches
  const shortSide = Math.min(widthPx, heightPx)
  if (Math.abs(ratio - artwork) / artwork <= 0.02 && shortSide >= 1200) return { kind: "artwork", swapped: false }
  if (Math.abs(ratio - 1 / artwork) / (1 / artwork) <= 0.02 && shortSide >= 1200) return { kind: "artwork", swapped: true }
  return null
}

function matchPixels(
  widthPx: number,
  heightPx: number,
  geometry: PostcardGeometry
): { kind: PageKind; swapped: boolean } | null {
  const sizes: Array<{ kind: PageKind; w: number; h: number }> = []
  for (const dpi of [72, 150, 200, 300]) {
    sizes.push(
      { kind: "artwork", w: Math.round(geometry.artworkCanvasInches.widthInches * dpi), h: Math.round(geometry.artworkCanvasInches.heightInches * dpi) },
      { kind: "trim", w: Math.round(geometry.finishedTrimInches.widthInches * dpi), h: Math.round(geometry.finishedTrimInches.heightInches * dpi) },
      {
        kind: "eighth",
        w: Math.round((geometry.finishedTrimInches.widthInches + 0.25) * dpi),
        h: Math.round((geometry.finishedTrimInches.heightInches + 0.25) * dpi),
      }
    )
  }
  for (const size of sizes) {
    if (nearPx(widthPx, size.w) && nearPx(heightPx, size.h)) return { kind: size.kind, swapped: false }
    if (nearPx(widthPx, size.h) && nearPx(heightPx, size.w)) return { kind: size.kind, swapped: true }
  }
  return null
}

function matchInches(
  widthInches: number,
  heightInches: number,
  geometry: PostcardGeometry
): { kind: PageKind; swapped: boolean } | null {
  const artwork = geometry.artworkCanvasInches
  const trim = geometry.finishedTrimInches
  const eighth = { widthInches: trim.widthInches + 0.25, heightInches: trim.heightInches + 0.25 }
  const sizes: Array<{ kind: PageKind; w: number; h: number }> = [
    { kind: "artwork", w: artwork.widthInches, h: artwork.heightInches },
    { kind: "trim", w: trim.widthInches, h: trim.heightInches },
    { kind: "eighth", w: eighth.widthInches, h: eighth.heightInches },
  ]
  for (const size of sizes) {
    if (nearIn(widthInches, size.w) && nearIn(heightInches, size.h)) return { kind: size.kind, swapped: false }
    if (nearIn(widthInches, size.h) && nearIn(heightInches, size.w)) return { kind: size.kind, swapped: true }
  }
  return null
}

function pageRect(kind: PageKind, geometry: PostcardGeometry): PixelRect {
  if (kind === "trim") return localRect(canvasRectToPixels(geometry.trimOnCanvas))
  if (kind === "eighth") {
    const bleed = geometry.bleedInchesPerSide
    const extra = Math.max(0, bleed - 0.125)
    return localRect(canvasRectToPixels({
      xInches: extra,
      yInches: extra,
      widthInches: geometry.artworkCanvasInches.widthInches - extra * 2,
      heightInches: geometry.artworkCanvasInches.heightInches - extra * 2,
    }))
  }
  return { x: 0, y: 0, w: geometry.pixelSize.widthPx, h: geometry.pixelSize.heightPx }
}

function localRect(rect: { xPx: number; yPx: number; widthPx: number; heightPx: number }): PixelRect {
  return { x: rect.xPx, y: rect.yPx, w: rect.widthPx, h: rect.heightPx }
}

interface PixelRect {
  x: number
  y: number
  w: number
  h: number
}

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

function containRect(srcW: number, srcH: number, box: { xPx: number; yPx: number; widthPx: number; heightPx: number } | PixelRect, maxScale: number): PixelRect {
  const boxX = "xPx" in box ? box.xPx : box.x
  const boxY = "xPx" in box ? box.yPx : box.y
  const boxW = "widthPx" in box ? box.widthPx : box.w
  const boxH = "widthPx" in box ? box.heightPx : box.h
  const scale = Math.min(maxScale, boxW / srcW, boxH / srcH)
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))
  return {
    x: Math.round(boxX + (boxW - w) / 2),
    y: Math.round(boxY + (boxH - h) / 2),
    w,
    h,
  }
}

function blit(
  dest: Uint8Array,
  destW: number,
  destH: number,
  src: Uint8Array,
  srcW: number,
  srcH: number,
  rect: PixelRect,
  source?: Bounds
): void {
  const crop = source ?? { x: 0, y: 0, width: srcW, height: srcH }
  const x0 = Math.max(0, rect.x)
  const y0 = Math.max(0, rect.y)
  const x1 = Math.min(destW, rect.x + rect.w)
  const y1 = Math.min(destH, rect.y + rect.h)
  const exact = crop.width === rect.w && crop.height === rect.h
  const shrink = rect.w < crop.width || rect.h < crop.height
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const to = (y * destW + x) * 4
      if (exact) {
        const from = ((crop.y + (y - rect.y)) * srcW + (crop.x + (x - rect.x))) * 4
        composite(dest, to, src, from)
        continue
      }
      if (shrink) {
        const sx0 = Math.min(crop.x + crop.width - 1, crop.x + Math.floor(((x - rect.x) * crop.width) / rect.w))
        const sx1 = Math.min(crop.x + crop.width, Math.max(sx0 + 1, crop.x + Math.ceil(((x + 1 - rect.x) * crop.width) / rect.w)))
        const sy0 = Math.min(crop.y + crop.height - 1, crop.y + Math.floor(((y - rect.y) * crop.height) / rect.h))
        const sy1 = Math.min(crop.y + crop.height, Math.max(sy0 + 1, crop.y + Math.ceil(((y + 1 - rect.y) * crop.height) / rect.h)))
        let red = 0
        let green = 0
        let blue = 0
        let alpha = 0
        let count = 0
        for (let sy = sy0; sy < sy1; sy += 1) {
          for (let sx = sx0; sx < sx1; sx += 1) {
            const from = (sy * srcW + sx) * 4
            red += src[from] ?? 0
            green += src[from + 1] ?? 0
            blue += src[from + 2] ?? 0
            alpha += src[from + 3] ?? 255
            count += 1
          }
        }
        if (count === 0) continue
        const pixel = new Uint8Array([Math.round(red / count), Math.round(green / count), Math.round(blue / count), Math.round(alpha / count)])
        composite(dest, to, pixel, 0)
        continue
      }
      const sx = crop.x + Math.min(crop.width - 1, Math.floor(((x - rect.x) * crop.width) / rect.w))
      const sy = crop.y + Math.min(crop.height - 1, Math.floor(((y - rect.y) * crop.height) / rect.h))
      composite(dest, to, src, (sy * srcW + sx) * 4)
    }
  }
}

function composite(dest: Uint8Array, to: number, src: Uint8Array, from: number): void {
  const alpha = src[from + 3] ?? 255
  if (alpha >= 250) {
    dest[to] = src[from] ?? 0
    dest[to + 1] = src[from + 1] ?? 0
    dest[to + 2] = src[from + 2] ?? 0
    dest[to + 3] = 255
    return
  }
  if (alpha <= 8) return
  const cover = alpha / 255
  dest[to] = Math.round((src[from] ?? 0) * cover + (dest[to] ?? 0) * (1 - cover))
  dest[to + 1] = Math.round((src[from + 1] ?? 0) * cover + (dest[to + 1] ?? 0) * (1 - cover))
  dest[to + 2] = Math.round((src[from + 2] ?? 0) * cover + (dest[to + 2] ?? 0) * (1 - cover))
  dest[to + 3] = 255
}

function extendEdges(dest: Uint8Array, width: number, height: number, rect: PixelRect): void {
  const x0 = Math.max(0, rect.x)
  const y0 = Math.max(0, rect.y)
  const x1 = Math.min(width - 1, rect.x + rect.w - 1)
  const y1 = Math.min(height - 1, rect.y + rect.h - 1)
  if (x1 < x0 || y1 < y0) return
  for (let y = 0; y < height; y += 1) {
    const sampleY = Math.min(y1, Math.max(y0, y))
    for (let x = 0; x < width; x += 1) {
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue
      const sampleX = Math.min(x1, Math.max(x0, x))
      const from = (sampleY * width + sampleX) * 4
      const to = (y * width + x) * 4
      dest[to] = dest[from] ?? 0
      dest[to + 1] = dest[from + 1] ?? 0
      dest[to + 2] = dest[from + 2] ?? 0
      dest[to + 3] = 255
    }
  }
}

function moveContentOffAddress(
  dest: Uint8Array,
  destW: number,
  destH: number,
  src: Uint8Array,
  srcW: number,
  srcH: number,
  background: [number, number, number],
  geometry: PostcardGeometry
): boolean {
  const content = contentBounds(src, srcW, srcH, background)
  if (content.width * content.height > srcW * srcH * 0.85) return false
  const free = clearPixelRect(geometry)
  if (content.width > free.widthPx || content.height > free.heightPx) {
    const scale = Math.min(free.widthPx / content.width, free.heightPx / content.height)
    if (scale < 0.75) return false
  }
  fill(dest, background)
  const placed = containRect(content.width, content.height, free, 1)
  blit(dest, destW, destH, src, srcW, srcH, placed, content)
  return !keepOutHasInk(dest, destW, destH, geometry)
}

function contentBounds(
  rgba: Uint8Array,
  width: number,
  height: number,
  background: [number, number, number]
): Bounds {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const alpha = rgba[index + 3] ?? 255
      if (alpha < 16) continue
      const red = rgba[index] ?? 0
      const green = rgba[index + 1] ?? 0
      const blue = rgba[index + 2] ?? 0
      if (Math.abs(red - background[0]) < 16 && Math.abs(green - background[1]) < 16 && Math.abs(blue - background[2]) < 16 && alpha > 240) {
        continue
      }
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < 0) return { x: 0, y: 0, width, height }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

function backgroundColor(rgba: Uint8Array, width: number, height: number): [number, number, number] {
  const spots = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ]
  let transparent = 0
  const colors: Array<[number, number, number]> = []
  for (const [x, y] of spots) {
    const index = (y * width + x) * 4
    const alpha = rgba[index + 3] ?? 255
    if (alpha < 20) {
      transparent += 1
      continue
    }
    colors.push([rgba[index] ?? 255, rgba[index + 1] ?? 255, rgba[index + 2] ?? 255])
  }
  if (transparent >= 2 || colors.length === 0) return [255, 255, 255]
  const first = colors[0]!
  const close = colors.every(
    (color) => Math.abs(color[0] - first[0]) < 18 && Math.abs(color[1] - first[1]) < 18 && Math.abs(color[2] - first[2]) < 18
  )
  if (!close) return [255, 255, 255]
  return [
    Math.round(colors.reduce((sum, color) => sum + color[0], 0) / colors.length),
    Math.round(colors.reduce((sum, color) => sum + color[1], 0) / colors.length),
    Math.round(colors.reduce((sum, color) => sum + color[2], 0) / colors.length),
  ]
}

function keepOutHasInk(rgba: Uint8Array, width: number, height: number, geometry: PostcardGeometry): boolean {
  let ink = 0
  for (const keepOut of geometry.keepOuts) {
    const box = keepOut.pixels
    const x0 = Math.max(0, box.xPx)
    const y0 = Math.max(0, box.yPx)
    const x1 = Math.min(width, box.xPx + box.widthPx)
    const y1 = Math.min(height, box.yPx + box.heightPx)
    const step = Math.max(1, Math.floor(Math.min(box.widthPx, box.heightPx) / 40))
    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        const index = (y * width + x) * 4
        const red = rgba[index] ?? 255
        const green = rgba[index + 1] ?? 255
        const blue = rgba[index + 2] ?? 255
        if (red < 230 || green < 230 || blue < 230) {
          ink += 1
          if (ink >= 8) return true
        }
      }
    }
  }
  return false
}

function clearPixelRect(geometry: PostcardGeometry): { xPx: number; yPx: number; widthPx: number; heightPx: number } {
  const inches = largestClearRect(geometry)
  return canvasRectToPixels(inches)
}

function clearPdfRect(geometry: PostcardGeometry): { x: number; y: number; w: number; h: number } {
  const pixels = pdfRect(largestClearRect(geometry), geometry)
  return { x: pixels.x, y: pixels.y, w: pixels.w, h: pixels.h }
}

function pdfRect(rect: { xInches: number; yInches: number; widthInches: number; heightInches: number }, geometry: PostcardGeometry): { x: number; y: number; w: number; h: number } {
  const pageH = geometry.pdfPagePoints.heightPoints
  const height = rect.heightInches * 72
  return {
    x: rect.xInches * 72,
    y: pageH - rect.yInches * 72 - height,
    w: rect.widthInches * 72,
    h: height,
  }
}

function largestClearRect(geometry: PostcardGeometry): { xInches: number; yInches: number; widthInches: number; heightInches: number } {
  const safe = geometry.safeTextOnCanvas
  const blocks = geometry.keepOuts.map((keepOut) => ({
    x: keepOut.canvas.xInches,
    y: keepOut.canvas.yInches,
    w: keepOut.canvas.widthInches,
    h: keepOut.canvas.heightInches,
  }))
  const xs = edges(safe.xInches, safe.xInches + safe.widthInches, blocks.flatMap((block) => [block.x, block.x + block.w]))
  const ys = edges(safe.yInches, safe.yInches + safe.heightInches, blocks.flatMap((block) => [block.y, block.y + block.h]))
  let best = { xInches: safe.xInches, yInches: safe.yInches, widthInches: safe.widthInches, heightInches: safe.heightInches }
  let bestScore = -1
  for (let left = 0; left < xs.length; left += 1) {
    for (let right = left + 1; right < xs.length; right += 1) {
      for (let top = 0; top < ys.length; top += 1) {
        for (let bottom = top + 1; bottom < ys.length; bottom += 1) {
          const rect = { x: xs[left]!, y: ys[top]!, w: xs[right]! - xs[left]!, h: ys[bottom]! - ys[top]! }
          if (rect.w < 0.4 || rect.h < 0.4) continue
          if (blocks.some((block) => overlaps(rect, block))) continue
          const score = Math.min(rect.w, rect.h) * 100 + rect.w * rect.h
          if (score > bestScore) {
            bestScore = score
            best = { xInches: rect.x, yInches: rect.y, widthInches: rect.w, heightInches: rect.h }
          }
        }
      }
    }
  }
  return best
}

function edges(start: number, end: number, cuts: number[]): number[] {
  const values = [start, end, ...cuts.filter((value) => value > start + 0.01 && value < end - 0.01)]
  return [...new Set(values.map((value) => Math.round(value * 1000) / 1000))].sort((a, b) => a - b)
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01
}

function fill(dest: Uint8Array, color: [number, number, number]): void {
  for (let index = 0; index < dest.length; index += 4) {
    dest[index] = color[0]
    dest[index + 1] = color[1]
    dest[index + 2] = color[2]
    dest[index + 3] = 255
  }
}

function rotateClockwise(src: Uint8Array, width: number, height: number): { rgba: Uint8Array; width: number; height: number } {
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = height - 1 - y
      const ny = x
      const from = (y * width + x) * 4
      const to = (ny * height + nx) * 4
      rgba[to] = src[from] ?? 0
      rgba[to + 1] = src[from + 1] ?? 0
      rgba[to + 2] = src[from + 2] ?? 0
      rgba[to + 3] = src[from + 3] ?? 255
    }
  }
  return { rgba, width: height, height: width }
}

function nearPx(left: number, right: number): boolean {
  return Math.abs(left - right) <= Math.max(2, right * 0.02)
}

function nearIn(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.04
}

function note(face: DesignFace, code: DesignPreflightIssue["code"], message: string): DesignPreflightIssue {
  return { face, severity: "warning", code, message }
}
