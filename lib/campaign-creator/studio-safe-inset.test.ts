import assert from "node:assert/strict"
import { test } from "node:test"

import { POSTCARD_5X8_V1 } from "../mail-catalog/pieces/postcard-5x8"
import { buildPostcard5x8PrintSpec } from "../print-spec/postcard-5x8-print-spec"

import { postcard5x8SafeInset } from "./studio-safe-inset"

test("Studio type inset matches the 5x8 print spec", () => {
  const printSpec = buildPostcard5x8PrintSpec()
  const inset = postcard5x8SafeInset()

  assert.equal(inset.insetInches, POSTCARD_5X8_V1.creativeCanvas.recommendedSafeTextInsetInches)
  assert.equal(inset.insetInches, printSpec.recommendedSafeTextInsetInches)
  assert.equal(inset.insetInches, 0.25)
  assert.equal(inset.trimWidthInches, printSpec.finishedTrimInches.widthInches)
  assert.equal(inset.trimHeightInches, printSpec.finishedTrimInches.heightInches)
  assert.equal(inset.trimWidthInches, 8)
  assert.equal(inset.trimHeightInches, 5)
  assert.ok(Math.abs(inset.xPercent - (0.25 / 8) * 100) < 0.0001)
  assert.ok(Math.abs(inset.yPercent - (0.25 / 5) * 100) < 0.0001)
  assert.equal(printSpec.bleedInchesPerSide, POSTCARD_5X8_V1.physical.bleedInchesPerSide)
})
