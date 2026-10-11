import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, StandardFonts } from "pdf-lib"

import { encodeRgbaPng } from "../print-spec/render-design-template-png"
import { encodeSolidPng } from "../print-spec/raster"
import { buildPostcard5x8PrintSpec } from "../print-spec/postcard-5x8-print-spec"
import { preflightDesignFile, type DesignPreflightIssue } from "./preflight"

const spec = buildPostcard5x8PrintSpec()

test("a 300 pixel-per-inch full-bleed PNG passes", async () => {
  const png = encodeSolidPng(spec.pixelSize.widthPx, spec.pixelSize.heightPx, [255, 255, 255])
  const issues = await preflightDesignFile({
    bytes: png,
    declaredType: "image/png",
    face: "front",
  })
  assert.deepEqual(issues, [])
})

test("a trim-only picture is described as the finished card", async () => {
  const png = encodeSolidPng(2400, 1500, [255, 255, 255])
  const issues = await preflightDesignFile({ bytes: png, declaredType: "image/png", face: "front" })
  const message = only(issues, "page_size").message
  assert.match(message, /8 × 5 inches/)
  assert.match(message, /8\.5 × 5\.5 inches/)
  assert.match(message, /quarter inch/)
  assert.equal(only(issues, "page_size").severity, "error")
  assert.equal(issues.length, 1)
  assertNoJargon(message)
})

test("an eighth-inch bleed picture tells the customer about Canva", async () => {
  const png = encodeSolidPng(2475, 1575, [250, 250, 250])
  const issues = await preflightDesignFile({ bytes: png, declaredType: "image/png", face: "back" })
  const message = only(issues, "page_size").message
  assert.match(message, /8\.25 × 5\.25 inches/)
  assert.match(message, /Canva/)
  assert.match(message, /bleed and crop marks off/)
  assertNoJargon(message)
})

test("a coarse picture is blocked and a soft picture is a warning", async () => {
  const coarse = await preflightDesignFile({
    bytes: encodeSolidPng(612, 396, [255, 255, 255]),
    declaredType: "image/png",
    face: "front",
  })
  const blocked = only(coarse, "resolution")
  assert.equal(blocked.severity, "error")
  assert.match(blocked.message, /too coarse to print/)
  assert.match(blocked.message, /2,550 × 1,650/)

  const soft = await preflightDesignFile({
    bytes: encodeSolidPng(1275, 825, [255, 255, 255]),
    declaredType: "image/png",
    face: "front",
  })
  const warning = only(soft, "resolution")
  assert.equal(warning.severity, "warning")
  assert.match(warning.message, /150 pixels per inch/)
  assert.equal(soft.some((item) => item.severity === "error"), false)
})

test("ink in the address area is a warning, not a block", async () => {
  const width = 850
  const height = 550
  const rgba = new Uint8Array(width * height * 4)
  rgba.fill(255)
  const x = Math.round(4.8 * (width / 8.5))
  const y = Math.round(2.6 * (height / 5.5))
  for (let row = 0; row < 30; row += 1) {
    for (let col = 0; col < 30; col += 1) {
      const index = ((y + row) * width + (x + col)) * 4
      rgba[index] = 180
      rgba[index + 1] = 20
      rgba[index + 2] = 20
      rgba[index + 3] = 255
    }
  }
  const png = encodeRgbaPng(width, height, rgba, 100)
  const issues = await preflightDesignFile({ bytes: png, declaredType: "image/png", face: "back" })
  const keepOut = only(issues, "keep_out")
  assert.equal(keepOut.severity, "warning")
  assert.match(keepOut.message, /address, postage, and barcode/)
  assert.equal(issues.some((item) => item.code === "keep_out" && item.severity === "error"), false)

  const front = await preflightDesignFile({ bytes: png, declaredType: "image/png", face: "front" })
  assert.equal(front.some((item) => item.code === "keep_out"), false)

  const cream = new Uint8Array(width * height * 4)
  for (let index = 0; index < cream.length; index += 4) {
    cream[index] = 248
    cream[index + 1] = 244
    cream[index + 2] = 236
    cream[index + 3] = 255
  }
  const paper = await preflightDesignFile({
    bytes: encodeRgbaPng(width, height, cream, 300),
    declaredType: "image/png",
    face: "back",
  })
  assert.equal(paper.some((item) => item.code === "keep_out"), false)
})

test("a PDF with the wrong page count, trim size, or a missing font is explained in plain language", async () => {
  const trim = await PDFDocument.create()
  trim.addPage([8 * 72, 5 * 72])
  const trimIssues = await preflightDesignFile({
    bytes: await trim.save(),
    declaredType: "application/pdf",
    face: "front",
  })
  assert.match(only(trimIssues, "page_size").message, /8 × 5 inches/)
  assert.match(only(trimIssues, "page_size").message, /8\.5 × 5\.5 inches/)

  const eighth = await PDFDocument.create()
  eighth.addPage([8.25 * 72, 5.25 * 72])
  const eighthIssues = await preflightDesignFile({
    bytes: await eighth.save(),
    declaredType: "application/pdf",
    face: "front",
  })
  assert.match(only(eighthIssues, "page_size").message, /8\.25 × 5\.25/)
  assert.match(only(eighthIssues, "page_size").message, /quarter inch/)

  const two = await PDFDocument.create()
  two.addPage([612, 396])
  two.addPage([612, 396])
  const countIssues = await preflightDesignFile({
    bytes: await two.save(),
    declaredType: "application/pdf",
    face: "front",
  })
  assert.match(only(countIssues, "page_count").message, /2 pages/)
  assert.match(only(countIssues, "page_count").message, /front as one file/)

  const missingFont = await PDFDocument.create()
  const page = missingFont.addPage([612, 396])
  const helvetica = await missingFont.embedFont(StandardFonts.Helvetica)
  page.drawText("Hello", { x: 40, y: 200, size: 18, font: helvetica })
  const fontIssues = await preflightDesignFile({
    bytes: await missingFont.save(),
    declaredType: "application/pdf",
    face: "front",
  })
  assert.match(only(fontIssues, "font").message, /Helvetica/)
  assert.match(only(fontIssues, "font").message, /not included in the file/)
  assert.equal(only(fontIssues, "font").severity, "error")
  assertNoJargon(only(fontIssues, "font").message)
})

test("an embedded font on a full-bleed page passes, and text in the address area warns", async () => {
  const clean = await PDFDocument.create()
  clean.registerFontkit(fontkit)
  const fontBytes = readFileSync(path.join(process.cwd(), "lib/print-spec/fonts/SourceSans3-Regular.ttf"))
  const font = await clean.embedFont(fontBytes, { subset: true })
  const page = clean.addPage([612, 396])
  page.drawText("Northwind", { x: 40, y: 220, size: 18, font })
  const cleanIssues = await preflightDesignFile({
    bytes: await clean.save({ useObjectStreams: false }),
    declaredType: "application/pdf",
    face: "back",
  })
  assert.equal(cleanIssues.some((item) => item.code === "font"), false)
  assert.equal(cleanIssues.some((item) => item.code === "page_size"), false)
  assert.equal(cleanIssues.some((item) => item.code === "keep_out"), false)

  const marked = await PDFDocument.create()
  const markedPage = marked.addPage([612, 396])
  const panel = spec.keepOuts.find((item) => item.id === "mailing_panel")
  assert.ok(panel)
  markedPage.drawText("Secret", {
    x: panel.pdf.xPoints + 12,
    y: panel.pdf.yPoints + 24,
    size: 14,
  })
  const markedIssues = await preflightDesignFile({
    bytes: await marked.save(),
    declaredType: "application/pdf",
    face: "back",
  })
  const keepOut = markedIssues.find((item) => item.code === "keep_out")
  assert.ok(keepOut)
  assert.equal(keepOut.severity, "warning")
})

test("a 6x9 page is named as the other template", async () => {
  const doc = await PDFDocument.create()
  doc.addPage([9.5 * 72, 6.5 * 72])
  const issues = await preflightDesignFile({
    bytes: await doc.save(),
    declaredType: "application/pdf",
    face: "front",
  })
  const message = only(issues, "page_size").message
  assert.match(message, /6×9/)
  assert.match(message, /5×8/)
  assert.match(message, /8\.5 × 5\.5 inches/)
})

test("a file that is not a picture or PDF is refused", async () => {
  const issues = await preflightDesignFile({
    bytes: Buffer.from("hello"),
    declaredType: "text/plain",
    face: "front",
  })
  assert.match(only(issues, "file_type").message, /PDF, PNG, or JPG/)
})

function only(issues: DesignPreflightIssue[], code: string): DesignPreflightIssue {
  const found = issues.filter((item) => item.code === code)
  assert.equal(found.length, 1, `${code}: ${issues.map((item) => item.message).join(" | ")}`)
  return found[0]!
}

function assertNoJargon(message: string): void {
  assert.doesNotMatch(message, /MediaBox|XObject|FontDescriptor|TrimBox|PPI/)
}
