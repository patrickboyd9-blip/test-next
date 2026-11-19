import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { test } from "node:test"

import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"

const require = createRequire(import.meta.url)
const spec = require("../../plugins/shared/postcard-spec.js") as {
  POSTCARD_SIZES: Record<string, { page: { width: number; height: number }; address: { x: number; y: number; width: number; height: number }; barcode: { width: number; height: number } }>
  pageMatches: (id: string, w: number, h: number) => boolean
  reservedHits: (id: string, boxes: { x: number; y: number; width: number; height: number; guide?: boolean }[]) => string[]
}

test("plugin page sizes match the print spec, including bleed", () => {
  const five = buildPostcard5x8PrintSpec()
  const six = buildPostcard6x9PrintSpec()
  assert.equal(spec.POSTCARD_SIZES["5x8"].page.width, five.pdfPagePoints.widthPoints)
  assert.equal(spec.POSTCARD_SIZES["5x8"].page.height, five.pdfPagePoints.heightPoints)
  assert.equal(spec.POSTCARD_SIZES["6x9"].page.width, six.pdfPagePoints.widthPoints)
  assert.equal(spec.POSTCARD_SIZES["6x9"].page.height, six.pdfPagePoints.heightPoints)
  assert.equal(spec.pageMatches("5x8", 612, 396), true)
  assert.equal(spec.pageMatches("5x8", 100, 100), false)
  const plugin = readFileSync(new URL("../../plugins/figma/code.js", import.meta.url), "utf8")
  assert.match(plugin, /8\.5, 5\.5/)
  assert.match(plugin, /265\.5, 208/)
  assert.match(plugin, /visible = false/)
})

test("a mark in the address area is flagged and a guide is not", () => {
  const address = spec.POSTCARD_SIZES["5x8"].address
  const hit = spec.reservedHits("5x8", [{ x: address.x + 2, y: address.y + 2, width: 10, height: 10 }])
  assert.match(hit.join(" "), /address area/)
  const guide = spec.reservedHits("5x8", [{ ...address, guide: true }])
  assert.deepEqual(guide, [])
})
