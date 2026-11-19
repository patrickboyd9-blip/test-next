import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { test } from "node:test"

import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"

const require = createRequire(import.meta.url)
const spec = require("../../plugins/canva/spec.js") as {
  PIXELS_PER_INCH: number
  POSTCARD_SIZES: Record<string, { page: { width: number; height: number }; address: { x: number; y: number; width: number; height: number } }>
  pageMatches: (id: string, w: number, h: number) => boolean
  reservedHits: (id: string, boxes: { x: number; y: number; width: number; height: number; guide?: boolean }[]) => string[]
}

test("Canva pages match the print file at 300 pixels per inch", () => {
  const five = buildPostcard5x8PrintSpec()
  const six = buildPostcard6x9PrintSpec()
  const scale = spec.PIXELS_PER_INCH / 72
  assert.ok(Math.abs(spec.POSTCARD_SIZES["5x8"].page.width - five.pdfPagePoints.widthPoints * scale) < 0.01)
  assert.ok(Math.abs(spec.POSTCARD_SIZES["5x8"].page.height - five.pdfPagePoints.heightPoints * scale) < 0.01)
  assert.ok(Math.abs(spec.POSTCARD_SIZES["6x9"].page.width - six.pdfPagePoints.widthPoints * scale) < 0.01)
  assert.ok(Math.abs(spec.POSTCARD_SIZES["6x9"].page.height - six.pdfPagePoints.heightPoints * scale) < 0.01)
  assert.equal(spec.pageMatches("5x8", 2550, 1650), true)
  assert.equal(spec.POSTCARD_SIZES["5x8"].address.width, 265.5 * scale)
  const host = readFileSync(new URL("../../plugins/canva/src/host.js", import.meta.url), "utf8")
  assert.match(host, /requestExport/)
  assert.match(host, /pdf_standard/)
  assert.match(host, /elements\.delete/)
})

test("a Canva mark in the address area is flagged and a guide is not", () => {
  const address = spec.POSTCARD_SIZES["5x8"].address
  const hit = spec.reservedHits("5x8", [{ x: address.x + 2, y: address.y + 2, width: 10, height: 10 }])
  assert.match(hit.join(" "), /address area/)
  assert.deepEqual(spec.reservedHits("5x8", [{ ...address, guide: true }]), [])
})
