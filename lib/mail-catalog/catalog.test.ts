import assert from "node:assert/strict"
import { test } from "node:test"

import { getMailPiece, MAIL_PIECE_CATALOG } from "./catalog"
import { POSTCARD_5X8_V1 } from "./pieces/postcard-5x8"

const EIGHTH_INCH = 0.125
const EIGHTH_INCH_ARTBOARD_WIDTH = 8.25
const EIGHTH_INCH_ARTBOARD_HEIGHT = 5.25

test("postcard_5x8 v1 is the explicit catalog lookup", () => {
  const entry = getMailPiece("postcard_5x8", 1)
  assert.equal(entry.id, "postcard_5x8")
  assert.equal(entry.version, 1)
  assert.equal(entry, POSTCARD_5X8_V1)
  assert.equal(MAIL_PIECE_CATALOG.postcard_5x8[1], POSTCARD_5X8_V1)
  assert.equal("latest" in MAIL_PIECE_CATALOG.postcard_5x8, false)
})

test("postcard_5x8 v1 encodes verified finished trim, landscape, canvas, and bleed", () => {
  const { physical } = getMailPiece("postcard_5x8", 1)

  assert.deepEqual(physical.trimSizeInches, { shortInches: 5, longInches: 8 })
  assert.equal(physical.orientation, "landscape")
  assert.deepEqual(physical.finishedTrimInches, {
    widthInches: 8,
    heightInches: 5,
  })
  assert.deepEqual(physical.artworkCanvasInches, {
    widthInches: 8.5,
    heightInches: 5.5,
  })
  assert.equal(physical.bleedInchesPerSide, 0.25)
  assert.equal(physical.imageBleedExtensionMinimumInches, EIGHTH_INCH)
  assert.equal(physical.fullBleedExpected, true)
  assert.deepEqual(physical.faces, ["front", "back"])

  assert.notEqual(physical.bleedInchesPerSide, EIGHTH_INCH)
  assert.notEqual(physical.artworkCanvasInches.widthInches, EIGHTH_INCH_ARTBOARD_WIDTH)
  assert.notEqual(physical.artworkCanvasInches.heightInches, EIGHTH_INCH_ARTBOARD_HEIGHT)
  assert.notEqual(
    physical.bleedInchesPerSide,
    physical.imageBleedExtensionMinimumInches
  )
})

test("postcard_5x8 v1 keep-out is trim-origin double-sided address-face geometry", () => {
  const entry = getMailPiece("postcard_5x8", 1)
  const keepOut = entry.creativeCanvas.reservedKeepOut

  assert.equal(entry.creativeCanvas.addressFace, "back")
  assert.equal(entry.creativeCanvas.recommendedSafeTextInsetInches, 0.25)
  assert.equal(keepOut.origin, "trim_top_left")
  assert.deepEqual(keepOut.rectangles, [
    {
      id: "mailing_panel",
      xInches: 4.3125,
      yInches: 2.125,
      widthInches: 3.6875,
      heightInches: 2.875,
    },
    {
      id: "barcode_strip",
      xInches: 2.0,
      yInches: 4.375,
      widthInches: 6.0,
      heightInches: 0.625,
    },
  ])

  const mailingPanel = keepOut.rectangles.find((rect) => rect.id === "mailing_panel")
  const barcodeStrip = keepOut.rectangles.find((rect) => rect.id === "barcode_strip")
  assert.ok(mailingPanel)
  assert.ok(barcodeStrip)
  assert.equal(mailingPanel.xInches + mailingPanel.widthInches, 8)
  assert.equal(mailingPanel.yInches + mailingPanel.heightInches, 5)
  assert.equal(barcodeStrip.xInches + barcodeStrip.widthInches, 8)
  assert.equal(barcodeStrip.yInches + barcodeStrip.heightInches, 5)
})

test("postcard_5x8 v1 does not encode vendor APIs, layout architecture, or invented geometry", () => {
  const entry = getMailPiece("postcard_5x8", 1)
  const serialized = JSON.stringify(entry)

  assert.equal("layouts" in entry, false)
  assert.equal("documentClass" in entry, false)
  assert.equal("paperType" in entry, false)
  assert.equal("printOption" in entry, false)
  assert.equal("providerId" in entry, false)
  assert.equal("dpi" in entry.physical, false)
  assert.equal("colorSpace" in entry.physical, false)
  assert.doesNotMatch(serialized, /documentClass/)
  assert.doesNotMatch(serialized, /paperType/)
  assert.doesNotMatch(serialized, /printOption/)
  assert.doesNotMatch(serialized, /Single Sided Postcard/)
  assert.doesNotMatch(serialized, /Double Sided Postcard/)
  assert.doesNotMatch(serialized, /indiciaRect/)
  assert.doesNotMatch(serialized, /returnAddressBox/)
})
