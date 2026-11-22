import assert from "node:assert/strict"
import test from "node:test"

import { click2MailKeepOuts } from "@/lib/print-spec/click2mail-keep-outs"

import {
  addQrCode,
  clampQrSize,
  initialQrPlacement,
  moveQr,
  placeQr,
  QR_MAX_COUNT,
  QR_MAX_INCHES,
  QR_MIN_INCHES,
  qrHitsReserved,
  removeQrCode,
  sanitizePlacedQrs,
  scanDestinationLine,
  setQrChoice,
} from "./model"

test("a QR on the back cannot sit in the postage block or the barcode zone", () => {
  for (const size of ["5x8", "6x9"] as const) {
    const trim = size === "6x9" ? { widthInches: 9, heightInches: 6 } : { widthInches: 8, heightInches: 5 }
    const boxes = click2MailKeepOuts(size, trim.widthInches, trim.heightInches)
    for (const box of boxes) {
      const inside = placeQr(size, "back", {
        xInches: box.xInches + 0.1,
        yInches: box.yInches + 0.05,
        sizeInches: 1,
      })
      assert.equal(inside.legal, true, `${size} ${box.id}`)
      assert.equal(inside.blocked, true, `${size} ${box.id}`)
      assert.equal(qrHitsReserved(size, "back", inside), false, `${size} ${box.id}`)
    }
    const safe = placeQr(size, "back", { xInches: 0.35, yInches: 0.4, sizeInches: 1 })
    assert.equal(safe.blocked, false)
    assert.equal(qrHitsReserved(size, "back", safe), false)
    const front = placeQr(size, "front", {
      xInches: boxes[0]!.xInches,
      yInches: boxes[0]!.yInches,
      sizeInches: 1,
    })
    assert.equal(front.blocked, false)
    assert.equal(qrHitsReserved(size, "front", front), false)
  }
})

test("moving onto the postage block snaps out and says why", () => {
  const panel = click2MailKeepOuts("5x8", 8, 5).find((box) => box.id === "mailing_panel")
  assert.ok(panel)
  const value = initialQrPlacement("5x8", "harbor.example")
  const moved = moveQr(value, "5x8", value.codes[0]!.id, panel.xInches + 0.2, panel.yInches + 0.2)
  const qr = moved.codes[0]!
  assert.equal(qr.side, "front")
  const onBack = moveQr(
    { ...moved, codes: [{ ...qr, side: "back" }] },
    "5x8",
    qr.id,
    panel.xInches + 0.2,
    panel.yInches + 0.2
  )
  assert.equal(onBack.blockedMessage, "That spot is saved for the postage and address.")
  assert.equal(qrHitsReserved("5x8", "back", onBack.codes[0]!), false)
})

test("a card holds two QR codes and each keeps its own destination", () => {
  let value = initialQrPlacement("5x8", "harbor.example", "(619) 555-0148")
  assert.equal(value.enabled, true)
  assert.equal(value.codes.length, 1)
  value = addQrCode(value, "5x8", "harbor.example", "(619) 555-0148")
  assert.equal(value.codes.length, QR_MAX_COUNT)
  value = addQrCode(value, "5x8", "harbor.example")
  assert.equal(value.codes.length, 2)
  value = setQrChoice(value, value.codes[0]!.id, "page", "harbor.example", value.codes[0]!.parts, "(619) 555-0148")
  value = setQrChoice(value, value.codes[1]!.id, "website", "https://harbor.example/offer", value.codes[1]!.parts, "")
  assert.equal(scanDestinationLine(value.codes[0]!), "When someone scans this code, they'll go to: a page we make for you")
  assert.equal(scanDestinationLine(value.codes[1]!), "When someone scans this code, they'll go to: https://harbor.example/offer")
  assert.notEqual(value.codes[0]!.destination, value.codes[1]!.destination)
  const removed = removeQrCode(value, value.codes[0]!.id)
  assert.equal(removed.codes.length, 1)
  assert.equal(removeQrCode(removed, removed.codes[0]!.id).enabled, false)
})

test("QR size stays between 0.75 and 2.5 inches", () => {
  assert.equal(clampQrSize(0.2), QR_MIN_INCHES)
  assert.equal(clampQrSize(4), QR_MAX_INCHES)
  assert.equal(clampQrSize(1.2), 1.2)
  for (const size of ["5x8", "6x9"] as const) {
    const tiny = placeQr(size, "back", { xInches: 0.2, yInches: 0.2, sizeInches: 0.2 })
    const huge = placeQr(size, "front", { xInches: 0, yInches: 0, sizeInches: 9 })
    assert.equal(tiny.sizeInches, QR_MIN_INCHES)
    assert.equal(huge.sizeInches, QR_MAX_INCHES)
    assert.equal(huge.legal, true)
    assert.ok(huge.xInches >= 0)
    assert.ok(huge.yInches >= 0)
    assert.equal(qrHitsReserved(size, "back", placeQr(size, "back", { xInches: 0, yInches: 0, sizeInches: QR_MAX_INCHES })), false)
  }
})

test("a third code and a website with no address are refused", () => {
  const one = {
    side: "front",
    xInches: 0.4,
    yInches: 0.4,
    sizeInches: 1,
    destination: "page",
    website: "",
    code: "abcdefgh",
  }
  const tooMany = sanitizePlacedQrs("5x8", [one, { ...one, side: "back", code: "bbbbbbbb" }, { ...one, code: "cccccccc" }])
  assert.equal(tooMany.ok, false)
  const missing = sanitizePlacedQrs("5x8", [{ ...one, destination: "website", website: "not a site" }])
  assert.equal(missing.ok, false)
  if (missing.ok) return
  assert.match(missing.message, /website/i)
})
