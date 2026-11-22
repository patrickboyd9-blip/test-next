import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { addQrCode, initialQrPlacement, setQrChoice } from "@/lib/qr-placement/model"

import { QrPlacementPanel } from "./QrPlacementPanel"

test("the QR option is on, recommended, and says where a scan goes", () => {
  let value = initialQrPlacement("5x8", "harbor.example", "(619) 555-0148")
  value = setQrChoice(value, value.codes[0]!.id, "page", "harbor.example", value.codes[0]!.parts, "(619) 555-0148")
  const html = renderToStaticMarkup(
    createElement(QrPlacementPanel, {
      value,
      size: "5x8",
      businessName: "Harbor Roofing",
      headline: "Free roof inspection",
      offer: "Call to book a visit",
      onChange: () => undefined,
    })
  )
  assert.match(html, /Recommended: QR codes let you track who responds/)
  assert.match(html, /Add a QR code/)
  assert.match(html, /Add a second QR code/)
  assert.match(html, /When someone scans this code, they(?:'|&#x27;)ll go to: a page we make for you/)
  assert.match(html, /data-offer-preview/)
  assert.match(html, /Free roof inspection/)
  assert.match(html, /Send scans to a simple page we make for you/)
  assert.match(html, /Send scans to my own website/)
  assert.doesNotMatch(html, /landing page|hosted|redirect|click2mail|gemini|\$\d/i)

  const two = addQrCode(value, "5x8", "harbor.example", "(619) 555-0148")
  const withSite = setQrChoice(two, two.codes[1]!.id, "website", "https://harbor.example/offer", two.codes[1]!.parts, "")
  const both = renderToStaticMarkup(
    createElement(QrPlacementPanel, {
      value: withSite,
      size: "5x8",
      businessName: "Harbor Roofing",
      headline: "Free roof inspection",
      offer: "Call to book a visit",
      onChange: () => undefined,
    })
  )
  assert.match(both, /https:\/\/harbor\.example\/offer/)
  assert.doesNotMatch(both, /Add a second QR code/)
})
