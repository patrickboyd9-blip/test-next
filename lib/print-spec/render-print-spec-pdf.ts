import {
  buildPostcard5x8PrintSpec,
  type PdfRect,
  type Postcard5x8PrintSpec,
} from "./postcard-5x8-print-spec"

/**
 * Two-page RGB PDF.
 * Each page MediaBox is the 5×8 artwork canvas (8.5 × 5.5 in).
 * TrimBox is the finished 8 × 5 in card. BleedBox is the page.
 * Page 2 draws the address-face keep-outs from the catalog.
 * This is a geometry proof, not a Click2Mail job and not customer art.
 */
export function renderPostcard5x8PrintSpecPdf(
  spec: Postcard5x8PrintSpec = buildPostcard5x8PrintSpec()
): Buffer {
  const front = pageStream(spec, "front")
  const back = pageStream(spec, "back")
  const media = pdfRect(spec.mediaBox)
  const trim = pdfRect(spec.trimBox)
  const bleed = pdfRect(spec.bleedBox)

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 2 /Kids [3 0 R 4 0 R] >>",
    pageObject(media, trim, bleed, "5 0 R"),
    pageObject(media, trim, bleed, "6 0 R"),
    streamObject(front),
    streamObject(back),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]

  return Buffer.from(buildPdf(objects))
}

function pageObject(media: string, trim: string, bleed: string, contents: string): string {
  return `<< /Type /Page /Parent 2 0 R /MediaBox ${media} /TrimBox ${trim} /BleedBox ${bleed} /Contents ${contents} /Resources << /Font << /F1 7 0 R >> >> >>`
}

function pageStream(spec: Postcard5x8PrintSpec, face: "front" | "back"): string {
  const lines: string[] = []

  if (face === "back") {
    lines.push("0.97 0.86 0.86 rg", "0.55 0.22 0.22 RG", "0.8 w")
    for (const keepOut of spec.keepOuts) {
      lines.push(rectOperator(keepOut.pdf, "B"))
    }
  }

  lines.push(
    "0.93 0.93 0.93 RG",
    "0.6 w",
    rectOperator(
      {
        xPoints: 0,
        yPoints: 0,
        widthPoints: spec.pdfPagePoints.widthPoints,
        heightPoints: spec.pdfPagePoints.heightPoints,
      },
      "S"
    ),
    "0.12 0.12 0.12 RG",
    "1.25 w",
    rectOperator(canvasPdf(spec, "trim"), "S"),
    "0.15 0.25 0.55 RG",
    "0.7 w",
    rectOperator(canvasPdf(spec, "safe"), "S")
  )

  const label =
    face === "front"
      ? "FRONT  5x8 artwork canvas  8.5 x 5.5 in  RGB  not a mail job"
      : "BACK  address face  keep-outs are unprintable  RGB  not a mail job"
  const note =
    "Phase 1 color is RGB. No CMYK. 300 DPI raster is 2550 x 1650 px. Trim is the inner box."

  lines.push(
    "BT",
    "/F1 8 Tf",
    "0.1 0.1 0.1 rg",
    `36 ${formatNumber(spec.pdfPagePoints.heightPoints - 36)} Td`,
    `(${pdfEscape(label)}) Tj`,
    "0 -12 Td",
    `(${pdfEscape(note)}) Tj`,
    "ET"
  )

  return lines.join("\n")
}

function canvasPdf(
  spec: Postcard5x8PrintSpec,
  which: "trim" | "safe"
): PdfRect {
  const rect = which === "trim" ? spec.trimOnCanvas : spec.safeTextOnCanvas
  const pageHeight = spec.artworkCanvasInches.heightInches
  return {
    xPoints: rect.xInches * 72,
    yPoints: (pageHeight - rect.yInches - rect.heightInches) * 72,
    widthPoints: rect.widthInches * 72,
    heightPoints: rect.heightInches * 72,
  }
}

function rectOperator(rect: PdfRect, op: "S" | "B"): string {
  return `${formatNumber(rect.xPoints)} ${formatNumber(rect.yPoints)} ${formatNumber(rect.widthPoints)} ${formatNumber(rect.heightPoints)} re ${op}`
}

function pdfRect(box: readonly [number, number, number, number]): string {
  return `[${box.map(formatNumber).join(" ")}]`
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")
}

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function streamObject(content: string): string {
  const length = Buffer.byteLength(content)
  return `<< /Length ${length} >>\nstream\n${content}\nendstream`
}

function buildPdf(objects: readonly string[]): string {
  let body = "%PDF-1.4\n"
  const offsets: number[] = [0]
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body))
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xrefAt = Buffer.byteLength(body)
  let xref = `xref\n0 ${objects.length + 1}\n`
  xref += "0000000000 65535 f \n"
  for (let index = 1; index <= objects.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`
  return body + xref + trailer
}
