import { POSTCARD_5X8_V1 } from "../mail-catalog/pieces/postcard-5x8"
import type { ReservedKeepOutRect } from "../mail-catalog/types"

/**
 * Phase 1 print-spec for the immutable 5×8 catalog entry.
 * Geometry is read from POSTCARD_5X8_V1. This module does not edit that entry.
 * It does not log into Click2Mail, create a job, or take payment.
 */

export const PRINT_SPEC_DPI = 300
export const POINTS_PER_INCH = 72

export const PRINT_SPEC_PHASE1_COLOR_POLICY = [
  "Phase 1 files are RGB. There is no CMYK conversion and no ICC profile.",
  "Click2Mail's published design guidance asks designers to submit CMYK. This spike does not do that. Color may shift if a later step prints an RGB file. That is a known gap, not a silent conversion.",
  "The dimension check this file is built for is page size: the artwork canvas from the 5×8 catalog, 8.5 in × 5.5 in, which is 0.25 in bleed on every side of the 8 in × 5 in trim.",
  "A vendor document-class name is not asserted here. The catalog does not store vendor ids, and the public API enum for this size is not treated as confirmed.",
  "The PDF page boxes are the preflight artifact. The PNG is a 300 DPI RGB raster of the same guides (2550 × 1650 px). Neither file is customer artwork.",
].join(" ")

export const PRINT_SPEC_NON_GOALS = [
  "Click2Mail account login or API credentials",
  "Click2Mail job create, proof, or submit",
  "Payment",
  "Data Axle or any audience purchase",
  "CMYK conversion",
  "Pasting research specimen images into customer mail",
] as const

export interface InchesSize {
  widthInches: number
  heightInches: number
}

export interface InchesRect {
  xInches: number
  yInches: number
  widthInches: number
  heightInches: number
}

export interface PixelRect {
  xPx: number
  yPx: number
  widthPx: number
  heightPx: number
}

export interface PdfRect {
  /** Lower-left x, PDF user space (points, y up). */
  xPoints: number
  yPoints: number
  widthPoints: number
  heightPoints: number
}

export interface PrintSpecKeepOut {
  id: string
  /** Catalog rectangle: trim top-left, y down. */
  trim: InchesRect
  /** Same rectangle on the artwork canvas: canvas top-left, y down. */
  canvas: InchesRect
  pixels: PixelRect
  pdf: PdfRect
}

export interface Postcard5x8PrintSpec {
  catalogId: "postcard_5x8"
  catalogVersion: 1
  dpi: typeof PRINT_SPEC_DPI
  colorSpace: "rgb"
  colorPolicy: string
  nonGoals: readonly string[]
  faces: readonly ["front", "back"]
  addressFace: "back"
  artworkCanvasInches: InchesSize
  finishedTrimInches: InchesSize
  bleedInchesPerSide: number
  imageBleedExtensionMinimumInches: number
  recommendedSafeTextInsetInches: number
  pixelSize: { widthPx: number; heightPx: number }
  pdfPagePoints: { widthPoints: number; heightPoints: number }
  /** PDF TrimBox lower-left and upper-right, points. */
  trimBox: readonly [number, number, number, number]
  /** PDF BleedBox. Equal to the media box for this catalog: bleed is the page. */
  bleedBox: readonly [number, number, number, number]
  mediaBox: readonly [number, number, number, number]
  trimOnCanvas: InchesRect
  safeTextOnCanvas: InchesRect
  keepOuts: readonly PrintSpecKeepOut[]
}

export function inchesToPixels(inches: number, dpi = PRINT_SPEC_DPI): number {
  return Math.round(inches * dpi)
}

export function inchesToPoints(inches: number): number {
  return inches * POINTS_PER_INCH
}

/** Catalog keep-outs use trim top-left. Canvas origin is the bleed edge, y down. */
export function trimRectToCanvas(
  rect: InchesRect,
  bleedInchesPerSide: number
): InchesRect {
  return {
    xInches: bleedInchesPerSide + rect.xInches,
    yInches: bleedInchesPerSide + rect.yInches,
    widthInches: rect.widthInches,
    heightInches: rect.heightInches,
  }
}

/**
 * PDF user space is bottom-left, y up.
 * `canvas` is top-left, y down, on the artwork page.
 */
export function canvasRectToPdf(
  canvas: InchesRect,
  pageHeightInches: number
): PdfRect {
  return {
    xPoints: inchesToPoints(canvas.xInches),
    yPoints: inchesToPoints(
      pageHeightInches - canvas.yInches - canvas.heightInches
    ),
    widthPoints: inchesToPoints(canvas.widthInches),
    heightPoints: inchesToPoints(canvas.heightInches),
  }
}

export function canvasRectToPixels(canvas: InchesRect): PixelRect {
  return {
    xPx: inchesToPixels(canvas.xInches),
    yPx: inchesToPixels(canvas.yInches),
    widthPx: inchesToPixels(canvas.widthInches),
    heightPx: inchesToPixels(canvas.heightInches),
  }
}

function box(
  x: number,
  y: number,
  width: number,
  height: number
): readonly [number, number, number, number] {
  return [x, y, x + width, y + height]
}

export function buildPostcard5x8PrintSpec(): Postcard5x8PrintSpec {
  const entry = POSTCARD_5X8_V1
  const canvas = entry.physical.artworkCanvasInches
  const trim = entry.physical.finishedTrimInches
  const bleed = entry.physical.bleedInchesPerSide
  const safeInset = entry.creativeCanvas.recommendedSafeTextInsetInches

  if (entry.id !== "postcard_5x8" || entry.version !== 1) {
    throw new Error("Print spec spike is bound to postcard_5x8 version 1.")
  }
  if (canvas.widthInches !== trim.widthInches + bleed * 2) {
    throw new Error("Artwork canvas width does not equal trim plus bleed.")
  }
  if (canvas.heightInches !== trim.heightInches + bleed * 2) {
    throw new Error("Artwork canvas height does not equal trim plus bleed.")
  }

  const trimOnCanvas: InchesRect = {
    xInches: bleed,
    yInches: bleed,
    widthInches: trim.widthInches,
    heightInches: trim.heightInches,
  }
  const safeTextOnCanvas: InchesRect = {
    xInches: bleed + safeInset,
    yInches: bleed + safeInset,
    widthInches: trim.widthInches - safeInset * 2,
    heightInches: trim.heightInches - safeInset * 2,
  }

  const pageWidthPoints = inchesToPoints(canvas.widthInches)
  const pageHeightPoints = inchesToPoints(canvas.heightInches)
  const trimPdf = canvasRectToPdf(trimOnCanvas, canvas.heightInches)

  const keepOuts = entry.creativeCanvas.reservedKeepOut.rectangles.map(
    (rect) => keepOutFromCatalog(rect, bleed, canvas.heightInches)
  )

  return {
    catalogId: "postcard_5x8",
    catalogVersion: 1,
    dpi: PRINT_SPEC_DPI,
    colorSpace: "rgb",
    colorPolicy: PRINT_SPEC_PHASE1_COLOR_POLICY,
    nonGoals: PRINT_SPEC_NON_GOALS,
    faces: ["front", "back"],
    addressFace: "back",
    artworkCanvasInches: {
      widthInches: canvas.widthInches,
      heightInches: canvas.heightInches,
    },
    finishedTrimInches: {
      widthInches: trim.widthInches,
      heightInches: trim.heightInches,
    },
    bleedInchesPerSide: bleed,
    imageBleedExtensionMinimumInches:
      entry.physical.imageBleedExtensionMinimumInches,
    recommendedSafeTextInsetInches: safeInset,
    pixelSize: {
      widthPx: inchesToPixels(canvas.widthInches),
      heightPx: inchesToPixels(canvas.heightInches),
    },
    pdfPagePoints: {
      widthPoints: pageWidthPoints,
      heightPoints: pageHeightPoints,
    },
    mediaBox: box(0, 0, pageWidthPoints, pageHeightPoints),
    bleedBox: box(0, 0, pageWidthPoints, pageHeightPoints),
    trimBox: box(
      trimPdf.xPoints,
      trimPdf.yPoints,
      trimPdf.widthPoints,
      trimPdf.heightPoints
    ),
    trimOnCanvas,
    safeTextOnCanvas,
    keepOuts,
  }
}

function keepOutFromCatalog(
  rect: ReservedKeepOutRect,
  bleedInchesPerSide: number,
  pageHeightInches: number
): PrintSpecKeepOut {
  const trimRect: InchesRect = {
    xInches: rect.xInches,
    yInches: rect.yInches,
    widthInches: rect.widthInches,
    heightInches: rect.heightInches,
  }
  const canvas = trimRectToCanvas(trimRect, bleedInchesPerSide)
  return {
    id: rect.id,
    trim: trimRect,
    canvas,
    pixels: canvasRectToPixels(canvas),
    pdf: canvasRectToPdf(canvas, pageHeightInches),
  }
}
