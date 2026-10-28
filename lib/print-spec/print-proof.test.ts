import test from "node:test"
import assert from "node:assert/strict"
import { PDFDocument, rgb } from "pdf-lib"

import { composeRoofingProCard } from "@/lib/roofing-pro/compose"
import { geometryFor } from "@/lib/postcard-layouts/compose"
import { renderStudioDesignPdf } from "./render-template-postcard-pdf"
import { printFileKeepOutIssues, printFilePage } from "./print-proof"

async function aiPrintFile() {
  const card = composeRoofingProCard({
    templateId: "roof_fade_offer",
    size: "5x8",
    spec: { headline: "Stay cool all summer.", offer: "$89 AC tune-up", body: "A spring tune-up catches weak parts early.", phone: "(916) 555-0142", website: "polarair.example" },
    businessName: "Polar Air Heating & Cooling",
    qrPayload: "https://polarair.example",
  })
  const copy = { businessName: "Polar Air Heating & Cooling", phone: "(916) 555-0142", website: "polarair.example", qrPayload: "https://polarair.example" }
  return (await renderStudioDesignPdf({ card, copy })).bytes
}

test("the AI proof splits the print file into a one-page front and back", async () => {
  const bytes = await aiPrintFile()
  for (const face of ["front", "back"] as const) {
    const page = await PDFDocument.load(await printFilePage(bytes, face))
    assert.equal(page.getPageCount(), 1)
    const geometry = geometryFor("5x8")
    const { width, height } = page.getPage(0).getSize()
    assert.ok(Math.abs(width - geometry.pdfPagePoints.widthPoints) < 0.5)
    assert.ok(Math.abs(height - geometry.pdfPagePoints.heightPoints) < 0.5)
  }
})

test("a clean AI back passes the upload flow's address-area check", async () => {
  assert.deepEqual(await printFileKeepOutIssues(await aiPrintFile(), "5x8"), [])
})

test("ink in the address area of an AI back is flagged like an upload", async () => {
  const doc = await PDFDocument.load(await aiPrintFile())
  const back = doc.getPage(1)
  const panel = geometryFor("5x8").keepOuts.find((item) => item.id === "mailing_panel")
  assert.ok(panel)
  back.drawText("Call today", { x: panel.pdf.xPoints + 12, y: panel.pdf.yPoints + 24, size: 14, color: rgb(0.1, 0.1, 0.1) })
  const issues = await printFileKeepOutIssues(await doc.save(), "5x8")
  assert.equal(issues.length, 1)
  assert.equal(issues[0]!.code, "keep_out")
  assert.equal(issues[0]!.face, "back")
})
