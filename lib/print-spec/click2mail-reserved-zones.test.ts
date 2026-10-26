import assert from "node:assert/strict"
import { test } from "node:test"

import { POSTCARD_5X8_V1 } from "@/lib/mail-catalog/pieces/postcard-5x8"
import { eddmKeepOuts, eddmTrim } from "@/lib/eddm/geometry"

import {
  CLICK2MAIL_EDDM_ADDRESS_BLOCK,
  CLICK2MAIL_POSTCARD_5X8_RESERVED,
  CLICK2MAIL_POSTCARD_6X9_RESERVED,
} from "./click2mail-reserved-zones"
import { buildPostcard6x9PrintSpec } from "./postcard-6x9-print-spec"

test("Every Door reserved zones match the measured Click2Mail templates", () => {
  // Source: Click2Mail Word templates downloaded Oct 26, 2026.
  // https://templates.click2mail.com/every-door-direct-mail/6.5x9
  // https://templates.click2mail.com/every-door-direct-mail/6.25x11
  // The white block on both backs is 4.00 in by 2.00 in, flush to the
  // bottom-right trim. Page size confirms 0.25 in bleed.
  assert.equal(CLICK2MAIL_EDDM_ADDRESS_BLOCK.widthInches, 4)
  assert.equal(CLICK2MAIL_EDDM_ADDRESS_BLOCK.heightInches, 2)

  const wide = eddmKeepOuts(eddmTrim("6.5x9"))[0]
  assert.deepEqual(
    { x: wide?.xInches, y: wide?.yInches, w: wide?.widthInches, h: wide?.heightInches },
    { x: 5, y: 4.5, w: 4, h: 2 }
  )
  const jumbo = eddmKeepOuts(eddmTrim("6.25x11"))[0]
  assert.deepEqual(
    { x: jumbo?.xInches, y: jumbo?.yInches, w: jumbo?.widthInches, h: jumbo?.heightInches },
    { x: 7, y: 4.25, w: 4, h: 2 }
  )
})

test("5×8 and 6×9 reserved boxes stay in one config until David confirms them", () => {
  const catalog = POSTCARD_5X8_V1.creativeCanvas.reservedKeepOut.rectangles
  const panel = catalog.find((rect) => rect.id === "mailing_panel")
  const strip = catalog.find((rect) => rect.id === "barcode_strip")
  assert.deepEqual(panel, {
    id: "mailing_panel",
    ...CLICK2MAIL_POSTCARD_5X8_RESERVED.mailingPanel,
  })
  assert.deepEqual(strip, {
    id: "barcode_strip",
    ...CLICK2MAIL_POSTCARD_5X8_RESERVED.barcodeStrip,
  })

  // These are the current unconfirmed 6×9 figures. Change the config and this
  // expectation together when David sends the template boxes.
  assert.equal(CLICK2MAIL_POSTCARD_6X9_RESERVED.mailingPanel.widthInches, 3.656)
  assert.equal(CLICK2MAIL_POSTCARD_6X9_RESERVED.mailingPanel.heightInches, 2.948)
  assert.equal(CLICK2MAIL_POSTCARD_6X9_RESERVED.barcodeStrip.widthInches, 6)
  assert.equal(CLICK2MAIL_POSTCARD_6X9_RESERVED.barcodeStrip.heightInches, 0.625)

  const spec = buildPostcard6x9PrintSpec()
  const specPanel = spec.keepOuts.find((rect) => rect.id === "mailing_panel")
  const specStrip = spec.keepOuts.find((rect) => rect.id === "barcode_strip")
  assert.equal(specPanel?.trim.widthInches, 3.656)
  assert.equal(specPanel?.trim.heightInches, 2.948)
  assert.equal(specPanel?.trim.xInches, 9 - 3.656)
  assert.equal(specPanel?.trim.yInches, 6 - 2.948)
  assert.equal(specStrip?.trim.widthInches, 6)
  assert.equal(specStrip?.trim.heightInches, 0.625)
})
