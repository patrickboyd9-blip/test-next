import type { PdfRect, PostcardGeometry } from "./postcard-5x8-print-spec"
import { formatInches, type DesignTemplate } from "./design-templates"

/**
 * Two-page designer template.
 * Each page is the full bleed size. Page 1 is the front. Page 2 is the back,
 * with the address, postage, and barcode keep-out filled in.
 * Guides only. Not a mail job.
 */
export function renderDesignTemplatePdf(template: DesignTemplate): Buffer {
  const spec = template.geometry
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
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]

  return Buffer.from(buildPdf(objects))
}

function pageObject(media: string, trim: string, bleed: string, contents: string): string {
  return `<< /Type /Page /Parent 2 0 R /MediaBox ${media} /TrimBox ${trim} /BleedBox ${bleed} /Contents ${contents} /Resources << /Font << /F1 7 0 R /F2 8 0 R >> >> >>`
}

function pageStream(spec: PostcardGeometry, face: "front" | "back"): string {
  const width = formatInches(spec.artworkCanvasInches.widthInches)
  const height = formatInches(spec.artworkCanvasInches.heightInches)
  const trimW = formatInches(spec.finishedTrimInches.widthInches)
  const trimH = formatInches(spec.finishedTrimInches.heightInches)
  const lines: string[] = []

  if (face === "back") {
    lines.push("0.98 0.90 0.90 rg", "0.55 0.18 0.18 RG", "1 w")
    for (const keepOut of spec.keepOuts) {
      lines.push(rectOperator(keepOut.pdf, "B"))
    }
  }

  lines.push(
    "0.12 0.12 0.12 RG",
    "1.4 w",
    rectOperator(canvasPdf(spec, "trim"), "S"),
    "0.15 0.28 0.62 RG",
    "1 w",
    rectOperator(canvasPdf(spec, "safe"), "S")
  )

  const title =
    face === "front"
      ? `Front. Page is ${width} x ${height} in, including a quarter inch of bleed.`
      : `Back. Page is ${width} x ${height} in. The shaded area must stay empty.`
  const note =
    face === "front"
      ? `Black line: cut line. Finished card is ${trimW} x ${trimH} in. Blue line: keep words inside it.`
      : "Shaded area: address, postage, and barcode. Anything there will not show on the mailed card."

  const top = spec.pdfPagePoints.heightPoints - 28
  lines.push(
    textLine("/F1", 10, 28, top, title),
    textLine("/F2", 9, 28, top - 14, note)
  )

  if (face === "back") {
    const panel = spec.keepOuts.find((item) => item.id === "mailing_panel")
    if (panel) {
      lines.push(
        textLine(
          "/F1",
          11,
          panel.pdf.xPoints + 12,
          panel.pdf.yPoints + panel.pdf.heightPoints - 28,
          "Leave this area empty"
        ),
        textLine(
          "/F2",
          9,
          panel.pdf.xPoints + 12,
          panel.pdf.yPoints + panel.pdf.heightPoints - 44,
          "Address, postage, and barcode"
        )
      )
    }
  }

  return lines.join("\n")
}

function textLine(font: string, size: number, x: number, y: number, value: string): string {
  return [
    "BT",
    `${font} ${size} Tf`,
    "0.1 0.1 0.1 rg",
    `1 0 0 1 ${formatNumber(x)} ${formatNumber(y)} Tm`,
    `(${pdfEscape(value)}) Tj`,
    "ET",
  ].join("\n")
}

function canvasPdf(spec: PostcardGeometry, which: "trim" | "safe"): PdfRect {
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
