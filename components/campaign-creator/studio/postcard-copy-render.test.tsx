import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { toCreativeCanvas } from "@/lib/campaign-creator/creative-canvas"
import { POSTCARD_5X8_V1 } from "@/lib/mail-catalog/pieces/postcard-5x8"
import type { CreativeSpec } from "@/lib/campaign-creator/types"

import jsQR from "jsqr"

import { PostcardPreview } from "./PostcardPreview"

const canvas = toCreativeCanvas(POSTCARD_5X8_V1)

function spec(overrides: Partial<CreativeSpec> = {}): CreativeSpec {
  return {
    layoutVariant: "type_only",
    headline: "Free Roofing Inspection. No Catch.",
    body: "Licensed local crew.",
    callToAction: "Call to book",
    visualDirection: "Type only. No photograph.",
    tone: "Direct",
    palette: ["#1e3a5f", "#F5C518", "#f5f5f0"],
    imagery: "none",
    offer: "Free roofing inspection",
    leadJob: "offer",
    imageryRole: "none",
    ...overrides,
  }
}

function decodeRenderedQr(html: string): string | null {
  const svg = html.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/)
  if (!svg) return null
  const modules = Number(svg[1].match(/data-qr-modules="(\d+)"/)?.[1])
  const quiet = Number(svg[1].match(/data-qr-quiet-modules="(\d+)"/)?.[1])
  if (!modules || !quiet) return null
  const dark: Array<[number, number]> = []
  for (const rect of svg[2].matchAll(/<rect\b([^>]*)\/?>/g)) {
    const attrs = rect[1]
    const width = Number(attrs.match(/\bwidth="([\d.]+)"/)?.[1])
    const height = Number(attrs.match(/\bheight="([\d.]+)"/)?.[1])
    if (width !== 1 || height !== 1) continue
    const x = Number(attrs.match(/\bx="([\d.]+)"/)?.[1])
    const y = Number(attrs.match(/\by="([\d.]+)"/)?.[1])
    dark.push([x - quiet, y - quiet])
  }
  if (dark.length === 0) return null
  const scale = 6
  const total = modules + quiet * 2
  const size = total * scale
  const data = new Uint8ClampedArray(size * size * 4)
  data.fill(255)
  for (const [col, row] of dark) {
    for (let y = 0; y < scale; y += 1) {
      for (let x = 0; x < scale; x += 1) {
        const pixelX = (quiet + col) * scale + x
        const pixelY = (quiet + row) * scale + y
        const index = (pixelY * size + pixelX) * 4
        data[index] = 0x11
        data[index + 1] = 0x11
        data[index + 2] = 0x11
        data[index + 3] = 255
      }
    }
  }
  return jsQR(data, size, size)?.data ?? null
}

function htmlFor(next: CreativeSpec): string {
  return renderToStaticMarkup(
    createElement(PostcardPreview, {
      canvas,
      spec: next,
      side: "front",
      size: "hero",
      enableHoverTilt: false,
    })
  )
}

test("an offer-led card does not repeat a headline that restates the offer", () => {
  const html = htmlFor(spec())
  const visible = html.replace(/aria-label="[^"]*"/g, "")
  assert.match(visible, /Free roofing inspection/)
  assert.doesNotMatch(visible, /Free Roofing Inspection\. No Catch/)
  assert.equal(visible.match(/Free roofing inspection/g)?.length, 1)
})

test("a distinct headline still sits under the offer", () => {
  const html = htmlFor(
    spec({ headline: "Neighbors trust this crew" })
  )
  assert.match(html, /Free roofing inspection/)
  assert.match(html, /Neighbors trust this crew/)
})

test("a long roofing headline is shortened, the photo takes half the card, and the phone stays", () => {
  const html = htmlFor(
    spec({
      layoutVariant: "type_primary_split",
      headline: "Your roof may already be letting water in after last week's storm",
      palette: ["#1b4332", "#d8f3dc", "#fefae0"],
      imagery: "stock_generic_local",
      imageryRole: "consequence",
      phone: "(619) 555-0148",
      website: "https://abcroofers.com/inspect",
      qrDestination: "https://abcroofers.com/inspect",
    })
  )
  const visible = html.replace(/aria-label="Postcard preview:[^"]*"/g, "")
  assert.match(visible, /font-family:var\(--font-display-family\)/)
  assert.match(visible, /\(619\) 555-0148/)
  assert.match(visible, /QR code for/)
  assert.match(visible, /Your roof may already be letting/)
  assert.doesNotMatch(visible, /letting water in after/)
  const share = Number(html.match(/data-photo-share="([0-9.]+)"/)?.[1])
  assert.ok(share >= 0.5, `photo share ${share}`)
  assert.match(html, /data-layout-family="split"/)
  assert.match(html, /data-layout-issues="none"/)
})

test("a type-led navy card paints a scannable QR tile instead of an empty square", () => {
  const html = htmlFor(
    spec({
      headline: "Book In Seconds",
      subheadline: "A free roof inspection, on your schedule.",
      callToAction: "Book a time",
      palette: ["#1e3a5f", "#F5C518", "#f4f1ea"],
      phone: "(619) 555-0148",
      website: "https://summitroofing.com/inspect",
      qrDestination: "https://summitroofing.com/inspect",
    })
  )
  assert.match(html, /data-qr-tile="rounded"/)
  assert.match(html, /Scan to book/)
  assert.match(html, /border-radius:/)
  assert.doesNotMatch(html, /grid-template-columns:repeat/)
  assert.equal(decodeRenderedQr(html), "https://summitroofing.com/inspect")
})

test("a photo-led card fades type into the photograph instead of boxing it", () => {
  const html = htmlFor(
    spec({
      layoutVariant: "image_grounded",
      imagery: "stock_generic_local",
      imageryRole: "neighborhood",
      palette: ["#3d4450", "#d9d6d0", "#f4f1ea"],
    })
  )
  assert.match(html, /data-scrim="gradient"/)
  assert.match(html, /linear-gradient\(90deg/)
  assert.match(html, /data-region="inscription"[^>]*background-color:transparent/)
})

test("a split card uses display type at full weight on a palette panel", () => {
  const html = htmlFor(
    spec({
      layoutVariant: "peer_split",
      headline: "See The Transformation",
      palette: ["#1e3a5f", "#8aa4b5", "#f6f1e7"],
      imagery: "stock_generic_local",
      imageryRole: "neighborhood",
      leadJob: "trust",
      phone: "(619) 555-0148",
      website: "https://summitroofing.com/inspect",
      qrDestination: "https://summitroofing.com/inspect",
    })
  )
  assert.match(html, /data-headline-weight="800"/)
  assert.match(html, /font-weight:800/)
  assert.match(html, /font-family:var\(--font-display-family\)/)
  assert.match(html, /background-color:#1e3a5f/i)
  const share = Number(html.match(/data-photo-share="([0-9.]+)"/)?.[1])
  assert.ok(share >= 0.55, `photo share ${share}`)
})

test("a card with no photo does not paint an empty color block", () => {
  const typeOnly = htmlFor(spec())
  const split = htmlFor(
    spec({
      layoutVariant: "type_primary_split",
      imagery: "none",
      imageryRole: "neighborhood",
    })
  )
  const emptyWell = /<div class="h-full w-full"[^>]*background-color:#F5C518/i
  assert.doesNotMatch(typeOnly, emptyWell)
  assert.doesNotMatch(split, emptyWell)
  assert.doesNotMatch(typeOnly, /data-region="field"/)
  assert.match(split, /data-region="supporting-image"/)
})
