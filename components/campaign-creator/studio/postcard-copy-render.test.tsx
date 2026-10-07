import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { toCreativeCanvas } from "@/lib/campaign-creator/creative-canvas"
import { POSTCARD_5X8_V1 } from "@/lib/mail-catalog/pieces/postcard-5x8"
import type { CreativeSpec } from "@/lib/campaign-creator/types"

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
  assert.doesNotMatch(visible, /No Catch/)
})

test("a distinct headline still sits under the offer", () => {
  const html = htmlFor(
    spec({ headline: "Neighbors trust this crew" })
  )
  assert.match(html, /Free roofing inspection/)
  assert.match(html, /Neighbors trust this crew/)
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
