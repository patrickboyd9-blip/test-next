import type { InchesSize, PostcardGeometry } from "@/lib/print-spec/postcard-5x8-print-spec"
import { formatInches } from "@/lib/print-spec/design-templates"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"
import { readRasterSize } from "@/lib/print-spec/raster"

import { decodeRaster, readRasterDpi, sniffDesignMedia } from "./decode-raster"
import { inspectPdf } from "./pdf-inspect"

export type DesignFace = "front" | "back"

export type DesignIssueCode =
  | "file_type"
  | "file_size"
  | "unreadable"
  | "page_count"
  | "page_size"
  | "resolution"
  | "font"
  | "keep_out"

export interface DesignPreflightIssue {
  severity: "error" | "warning"
  code: DesignIssueCode
  face: DesignFace
  message: string
}

const SIZE_TOLERANCE_INCHES = 0.03
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const WARN_PPI = 300
const BLOCK_PPI = 100

const CAMPAIGN_SPEC = () => buildPostcard5x8PrintSpec()

export function campaignPrintGeometry(): PostcardGeometry {
  return CAMPAIGN_SPEC()
}

export async function preflightDesignFile(input: {
  bytes: Uint8Array
  declaredType: string
  face: DesignFace
  geometry?: PostcardGeometry
}): Promise<DesignPreflightIssue[]> {
  const geometry = input.geometry ?? campaignPrintGeometry()
  const face = input.face
  const issues: DesignPreflightIssue[] = []

  if (input.bytes.byteLength === 0) {
    return [issue(face, "error", "unreadable", "This file is empty. Export it again as a PDF, PNG, or JPG.")]
  }
  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) {
    return [
      issue(
        face,
        "error",
        "file_size",
        "This file is too large to upload. Export a PDF, PNG, or JPG under 8 MB."
      ),
    ]
  }

  const media = sniffDesignMedia(input.bytes, input.declaredType)
  if (!media) {
    return [
      issue(
        face,
        "error",
        "file_type",
        "Save this as a PDF, PNG, or JPG. Other file types can't be printed from here."
      ),
    ]
  }

  if (media === "application/pdf") {
    let inspected
    try {
      inspected = await inspectPdf(input.bytes, geometry, face)
    } catch {
      return [issue(face, "error", "unreadable", "We couldn't open this PDF. Export it again from your design app.")]
    }
    if (inspected.pageCount !== 1) {
      issues.push(
        issue(
          face,
          "error",
          "page_count",
          inspected.pageCount === 0
            ? "This PDF has no pages. Export the front or the back as a one-page file."
            : `This PDF has ${inspected.pageCount} pages. Upload the front as one file and the back as another.`
        )
      )
    }
    if (inspected.pageCount > 0) {
      const widthInches = inspected.widthPoints / 72
      const heightInches = inspected.heightPoints / 72
      const sizeIssue = pageSizeIssue(face, widthInches, heightInches, geometry)
      if (sizeIssue) issues.push(sizeIssue)
    }

    const ppi = lowestImagePpi(inspected.images)
    if (ppi !== null) issues.push(...resolutionIssues(face, ppi, geometry))

    if (inspected.unembeddedFonts.length > 0) {
      const names = inspected.unembeddedFonts.slice(0, 3).join(", ")
      issues.push(
        issue(
          face,
          "error",
          "font",
          `This PDF uses ${names}, and that font is not included in the file. The printer may swap in a different font, so the words can shift. Outline the text, or export the PDF again with fonts included.`
        )
      )
    }
    if (face === "back" && inspected.keepOutHasMarks) {
      issues.push(keepOutWarning(face))
    } else if (face === "back" && inspected.keepOutUnchecked) {
      issues.push(
        issue(
          face,
          "warning",
          "keep_out",
          "A picture covers the address area and we couldn't read it. On the proof, make sure the shaded box is empty. The address, postage, and barcode cover that area."
        )
      )
    }
    return issues
  }

  let raster
  try {
    raster = readRasterSize(input.bytes)
  } catch {
    return [issue(face, "error", "unreadable", "We couldn't read this picture. Export it again as a PNG or JPG.")]
  }

  const dpi = readRasterDpi(input.bytes, raster.kind)
  const classified = classifyRaster(raster.width, raster.height, dpi, geometry)
  if (classified.kind !== "artwork") {
    issues.push(rasterSizeIssue(face, classified, geometry))
  }
  if (classified.ppi !== null) issues.push(...resolutionIssues(face, classified.ppi, geometry))

  if (face === "back") {
    const decoded = decodeRaster(input.bytes, raster.kind)
    if (!decoded) {
      issues.push(
        issue(
          face,
          "warning",
          "keep_out",
          "We couldn't look inside the address area of this picture. On the proof, make sure the shaded box is empty. The address, postage, and barcode cover that area."
        )
      )
    } else if (rasterHasKeepOutInk(decoded.rgba, decoded.width, decoded.height, geometry)) {
      issues.push(keepOutWarning(face))
    }
  }

  return issues
}

export function preflightBlocksApproval(issues: readonly { severity: "error" | "warning" }[]): boolean {
  return issues.some((item) => item.severity === "error")
}

function lowestImagePpi(
  images: readonly { ppiX: number | null; ppiY: number | null; width: number; height: number; placement: { width: number; height: number } | null }[]
): number | null {
  let lowest: number | null = null
  for (const image of images) {
    const longSide = image.placement
      ? Math.max(image.placement.width, image.placement.height) / 72
      : 0
    if (image.placement && longSide < 0.75) continue
    const values = [image.ppiX, image.ppiY].filter((value): value is number => value !== null && Number.isFinite(value))
    for (const value of values) {
      if (lowest === null || value < lowest) lowest = value
    }
  }
  return lowest
}

function resolutionIssues(face: DesignFace, ppi: number, geometry: PostcardGeometry): DesignPreflightIssue[] {
  const rounded = Math.max(1, Math.round(ppi))
  const pixels = `${geometry.pixelSize.widthPx.toLocaleString("en-US")} × ${geometry.pixelSize.heightPx.toLocaleString("en-US")}`
  if (ppi < BLOCK_PPI - 0.01) {
    return [
      issue(
        face,
        "error",
        "resolution",
        `This picture is about ${rounded} pixels per inch. That is too coarse to print. Export it again at 300 pixels per inch (${pixels} pixels for this postcard).`
      ),
    ]
  }
  if (ppi < WARN_PPI - 0.01) {
    return [
      issue(
        face,
        "warning",
        "resolution",
        `This picture is about ${rounded} pixels per inch. Printed mail looks sharp at 300. It will still print, but small text may look soft. Export again at 300 pixels per inch if you can (${pixels} pixels).`
      ),
    ]
  }
  return []
}

type SizeKind = "artwork" | "trim" | "eighth" | "swapped" | "other-template" | "unknown"

interface ClassifiedRaster {
  kind: SizeKind
  ppi: number | null
  widthInches: number | null
  heightInches: number | null
  widthPx: number
  heightPx: number
  otherName?: string
}

function classifyRaster(
  widthPx: number,
  heightPx: number,
  dpi: number | null,
  geometry: PostcardGeometry
): ClassifiedRaster {
  if (dpi && dpi >= 36 && dpi <= 1200) {
    const widthInches = widthPx / dpi
    const heightInches = heightPx / dpi
    const kind = classifyInches(widthInches, heightInches, geometry)
    return {
      kind: kind.kind,
      ppi: dpi,
      widthInches,
      heightInches,
      widthPx,
      heightPx,
      otherName: kind.otherName,
    }
  }

  const matched = matchAspect(widthPx / heightPx, geometry)
  if (!matched) {
    return { kind: "unknown", ppi: null, widthInches: null, heightInches: null, widthPx, heightPx }
  }
  return {
    kind: matched.kind,
    ppi: widthPx / matched.widthInches,
    widthInches: matched.widthInches,
    heightInches: matched.heightInches,
    widthPx,
    heightPx,
    otherName: matched.otherName,
  }
}

function rasterSizeIssue(
  face: DesignFace,
  classified: ClassifiedRaster,
  geometry: PostcardGeometry
): DesignPreflightIssue {
  if (classified.kind === "unknown") {
    return issue(
      face,
      "error",
      "page_size",
      `This picture is ${classified.widthPx.toLocaleString("en-US")} × ${classified.heightPx.toLocaleString("en-US")} pixels. The page needs to be ${sizeLabel(geometry.artworkCanvasInches)}. At 300 pixels per inch that is ${geometry.pixelSize.widthPx.toLocaleString("en-US")} × ${geometry.pixelSize.heightPx.toLocaleString("en-US")} pixels.`
    )
  }
  return (
    pageSizeIssue(face, classified.widthInches ?? 0, classified.heightInches ?? 0, geometry, classified.otherName) ??
    issue(face, "error", "page_size", `This file needs to be ${sizeLabel(geometry.artworkCanvasInches)}.`)
  )
}

function pageSizeIssue(
  face: DesignFace,
  widthInches: number,
  heightInches: number,
  geometry: PostcardGeometry,
  otherName?: string
): DesignPreflightIssue | null {
  const found = classifyInches(widthInches, heightInches, geometry)
  const measured = `${formatInches(widthInches)} × ${formatInches(heightInches)}`
  const needed = sizeLabel(geometry.artworkCanvasInches)
  if (found.kind === "artwork") return null
  if (found.kind === "trim") {
    const trim = sizeLabel(geometry.finishedTrimInches)
    return issue(
      face,
      "error",
      "page_size",
      `This file is ${measured} inches. That is the finished card (${trim}), with no extra edge for trimming. The page needs to be ${needed}, which adds a quarter inch on every side.`
    )
  }
  if (found.kind === "eighth") {
    return issue(
      face,
      "error",
      "page_size",
      `This file is ${measured} inches. That is an eighth of an inch of extra edge, which is what Canva adds when bleed is turned on. This postcard needs a quarter inch, so the page should be ${needed}. In Canva, create a custom size of ${needed} and turn bleed and crop marks off.`
    )
  }
  if (found.kind === "swapped") {
    return issue(
      face,
      "error",
      "page_size",
      `This file is taller than it is wide (${measured} inches). The postcard is landscape, ${needed}.`
    )
  }
  if (found.kind === "other-template") {
    return issue(
      face,
      "error",
      "page_size",
      `This file is ${measured} inches, which is the ${found.otherName ?? otherName ?? "other"} template. This campaign prints a 5×8 postcard, so the page needs to be ${needed}.`
    )
  }
  return issue(
    face,
    "error",
    "page_size",
    `This file is ${measured} inches. It needs to be ${needed}.`
  )
}

function classifyInches(
  widthInches: number,
  heightInches: number,
  geometry: PostcardGeometry
): { kind: SizeKind; otherName?: string } {
  const artwork = geometry.artworkCanvasInches
  const trim = geometry.finishedTrimInches
  const eighth = {
    widthInches: trim.widthInches + 0.25,
    heightInches: trim.heightInches + 0.25,
  }
  if (nearSize(widthInches, heightInches, artwork)) return { kind: "artwork" }
  if (nearSize(widthInches, heightInches, trim)) return { kind: "trim" }
  if (nearSize(widthInches, heightInches, eighth)) return { kind: "eighth" }
  if (nearSize(heightInches, widthInches, artwork)) return { kind: "swapped" }

  for (const other of [buildPostcard5x8PrintSpec(), buildPostcard6x9PrintSpec()]) {
    if (sameSize(other.artworkCanvasInches, artwork)) continue
    if (nearSize(widthInches, heightInches, other.artworkCanvasInches)) {
      const name = other.artworkCanvasInches.widthInches > 9 ? "6×9" : "5×8"
      return { kind: "other-template", otherName: name }
    }
  }
  return { kind: "unknown" }
}

function matchAspect(
  ratio: number,
  geometry: PostcardGeometry
): { kind: SizeKind; widthInches: number; heightInches: number; otherName?: string } | null {
  const candidates: Array<{ kind: SizeKind; size: InchesSize; otherName?: string }> = [
    { kind: "artwork", size: geometry.artworkCanvasInches },
    { kind: "trim", size: geometry.finishedTrimInches },
    {
      kind: "eighth",
      size: {
        widthInches: geometry.finishedTrimInches.widthInches + 0.25,
        heightInches: geometry.finishedTrimInches.heightInches + 0.25,
      },
    },
  ]
  for (const other of [buildPostcard5x8PrintSpec(), buildPostcard6x9PrintSpec()]) {
    if (sameSize(other.artworkCanvasInches, geometry.artworkCanvasInches)) continue
    candidates.push({
      kind: "other-template",
      size: other.artworkCanvasInches,
      otherName: other.artworkCanvasInches.widthInches > 9 ? "6×9" : "5×8",
    })
  }
  for (const candidate of candidates) {
    const candidateRatio = candidate.size.widthInches / candidate.size.heightInches
    if (Math.abs(ratio - candidateRatio) / candidateRatio <= 0.015) {
      return {
        kind: candidate.kind,
        widthInches: candidate.size.widthInches,
        heightInches: candidate.size.heightInches,
        otherName: candidate.otherName,
      }
    }
  }
  return null
}

function rasterHasKeepOutInk(
  rgba: Uint8Array,
  width: number,
  height: number,
  geometry: PostcardGeometry
): boolean {
  let ink = 0
  const step = Math.max(1, Math.floor(Math.min(width, height) / 400))
  for (const keepOut of geometry.keepOuts) {
    const x0 = Math.max(0, Math.floor((keepOut.canvas.xInches / geometry.artworkCanvasInches.widthInches) * width))
    const x1 = Math.min(width, Math.ceil(((keepOut.canvas.xInches + keepOut.canvas.widthInches) / geometry.artworkCanvasInches.widthInches) * width))
    const y0 = Math.max(0, Math.floor((keepOut.canvas.yInches / geometry.artworkCanvasInches.heightInches) * height))
    const y1 = Math.min(height, Math.ceil(((keepOut.canvas.yInches + keepOut.canvas.heightInches) / geometry.artworkCanvasInches.heightInches) * height))
    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        const index = (y * width + x) * 4
        const alpha = rgba[index + 3] ?? 255
        if (alpha < 20) continue
        const red = rgba[index] ?? 255
        const green = rgba[index + 1] ?? 255
        const blue = rgba[index + 2] ?? 255
        if (red < 245 || green < 245 || blue < 245) {
          ink += 1
          if (ink >= 8) return true
        }
      }
    }
  }
  return false
}

function keepOutWarning(face: DesignFace): DesignPreflightIssue {
  return issue(
    face,
    "warning",
    "keep_out",
    "Something is printed in the address area on the back. The address, postage, and barcode cover that area, so that part of the design will not show. Move the artwork out of the shaded box, or approve the proof if you meant for it to be covered."
  )
}

function sizeLabel(size: InchesSize): string {
  return `${formatInches(size.widthInches)} × ${formatInches(size.heightInches)} inches`
}

function near(left: number, right: number): boolean {
  return Math.abs(left - right) <= SIZE_TOLERANCE_INCHES
}

function nearSize(width: number, height: number, size: InchesSize): boolean {
  return near(width, size.widthInches) && near(height, size.heightInches)
}

function sameSize(left: InchesSize, right: InchesSize): boolean {
  return Math.abs(left.widthInches - right.widthInches) < 0.01 && Math.abs(left.heightInches - right.heightInches) < 0.01
}

function issue(
  face: DesignFace,
  severity: "error" | "warning",
  code: DesignIssueCode,
  message: string
): DesignPreflightIssue {
  return { face, severity, code, message }
}
