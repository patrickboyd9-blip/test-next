import assert from "node:assert/strict"
import test from "node:test"

import { encodeSolidPng, readRasterSize } from "@/lib/print-spec/raster"

import { PRINT_JPEG_QUALITY, PRINT_LONG_SIDE, toPrintJpeg } from "./print-jpeg"

test("a small photo stays small and becomes a jpeg", async () => {
  const jpeg = await toPrintJpeg(encodeSolidPng(8, 8, [20, 40, 60]))
  const size = readRasterSize(jpeg)
  assert.equal(size.kind, "jpeg")
  assert.equal(size.width, 8)
  assert.equal(size.height, 8)
  assert.equal(PRINT_JPEG_QUALITY, 85)
})

test("a wide photo is capped at the 6x9 print long side", async () => {
  const jpeg = await toPrintJpeg(encodeSolidPng(3000, 20, [30, 30, 30]))
  const size = readRasterSize(jpeg)
  assert.equal(size.kind, "jpeg")
  assert.equal(size.width, PRINT_LONG_SIDE)
  assert.ok(size.height < 20)
  assert.equal(PRINT_LONG_SIDE, 2775)
})
