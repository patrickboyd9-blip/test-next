import assert from "node:assert/strict"
import { test } from "node:test"

import jsQR from "jsqr"

import { resolveStudioContact } from "./studio-contact"
import { buildQrMatrix, paintQr, qrPaintDecodes } from "./studio-qr"

test("QR encodes the brief URL when the spec still has toy contact", () => {
  const contact = resolveStudioContact(
    {
      phone: "111-222-3344",
      website: "www.abc.com",
      qrDestination: "www.abc.com",
    },
    {
      businessName: "Summit Roofing",
      phone: "(619) 555-0148",
      website: "https://summitroofing.com/inspect",
      qrDestination: "Book a roof inspection",
    }
  )

  assert.equal(contact.qrPayload, "https://summitroofing.com/inspect")
  assert.equal(contact.phone, "(619) 555-0148")
  assert.equal(contact.website, "https://summitroofing.com/inspect")
  assert.equal(decodeQr(contact.qrPayload!), contact.qrPayload)
})

test("QR encodes a tel link when the brief only has a phone", () => {
  const contact = resolveStudioContact(
    { phone: "111-222-3344", website: "www.abc.com" },
    { phone: "619-555-0148" }
  )

  assert.equal(contact.qrPayload, "tel:6195550148")
  assert.equal(contact.website, undefined)
  assert.equal(decodeQr(contact.qrPayload!), "tel:6195550148")
})

test("a real spec URL wins over the brief, and toy chrome is not encoded", () => {
  const contact = resolveStudioContact(
    {
      phone: "(619) 555-0199",
      website: "summitroofing.com/book",
      qrDestination: "https://summitroofing.com/book",
    },
    {
      phone: "111-222-3344",
      website: "www.abc.com",
      qrDestination: "www.abc.com",
    }
  )

  assert.equal(contact.qrPayload, "https://summitroofing.com/book")
  assert.equal(contact.phone, "(619) 555-0199")
  assert.notEqual(contact.qrPayload, "https://www.abc.com")
  assert.equal(decodeQr(contact.qrPayload!), contact.qrPayload)
})

test("no scannable target produces no matrix", () => {
  const contact = resolveStudioContact({
    phone: "111-222-3344",
    website: "www.abc.com",
    qrDestination: "a sentence is not a URL",
  })
  assert.equal(contact.qrPayload, null)
  assert.equal(buildQrMatrix(""), null)
  assert.equal(buildQrMatrix("   "), null)
})

test("the painted symbol decodes, and a blank payload does not", () => {
  const payload = "https://summitroofing.com/inspect"
  const painted = paintQr(payload)
  assert.ok(painted)
  assert.ok(painted.dark.length > 20)
  assert.equal(painted.quiet, 4)
  assert.equal(qrPaintDecodes(payload), true)
  assert.equal(qrPaintDecodes(""), false)
  assert.equal(qrPaintDecodes("   "), false)
})

test("different payloads produce different matrices", () => {
  const phone = buildQrMatrix("tel:6195550148")
  const url = buildQrMatrix("https://summitroofing.com/inspect")
  assert.ok(phone)
  assert.ok(url)
  assert.notDeepEqual(phone, url)
  assert.ok(phone.length >= 21)
  assert.equal(phone.length, phone[0]?.length)
})

function decodeQr(payload: string): string | null {
  const matrix = buildQrMatrix(payload)
  assert.ok(matrix)
  const { data, size } = rasterize(matrix)
  return jsQR(data, size, size)?.data ?? null
}

function rasterize(matrix: boolean[][]): { data: Uint8ClampedArray; size: number } {
  const quiet = 4
  const scale = 6
  const modules = matrix.length
  const size = (modules + quiet * 2) * scale
  const data = new Uint8ClampedArray(size * size * 4)
  data.fill(255)

  for (let row = 0; row < modules; row += 1) {
    for (let col = 0; col < modules; col += 1) {
      if (!matrix[row]?.[col]) continue
      for (let y = 0; y < scale; y += 1) {
        for (let x = 0; x < scale; x += 1) {
          const pixelX = (quiet + col) * scale + x
          const pixelY = (quiet + row) * scale + y
          const index = (pixelY * size + pixelX) * 4
          data[index] = 0
          data[index + 1] = 0
          data[index + 2] = 0
          data[index + 3] = 255
        }
      }
    }
  }

  return { data, size }
}
