import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { toCreativeCanvas } from "@/lib/campaign-creator/creative-canvas"
import type { CreativeDirection, CreativeSpec } from "@/lib/campaign-creator/types"
import { POSTCARD_5X8_V1 } from "@/lib/mail-catalog/pieces/postcard-5x8"
import { ROOFING_PRO_META, ROOFING_PRO_TEMPLATE_IDS } from "@/lib/roofing-pro/ids"

import { FocusView } from "./FocusView"

const canvas = toCreativeCanvas(POSTCARD_5X8_V1)

function direction(): CreativeDirection {
  const spec: CreativeSpec = {
    layoutVariant: "image_grounded",
    headline: "A roof that stays dry",
    body: "We walk the roof and tell you what can wait.",
    offer: "Free roof inspection",
    callToAction: "Book a free inspection",
    phone: "(619) 555-0148",
    website: "https://northline.example/book",
    visualDirection: "A finished roof in daylight.",
    tone: "Calm",
    palette: ["#12243f", "#f3efe6", "#c4371c"],
    imagery: "stock_generic_local",
    layoutHints: { templateId: "roof_split", verticalPalette: "roofing" },
  }
  return {
    id: "dir-1",
    name: "Dry Roof",
    rationale: "The roof is the hero and the inspection is the offer.",
    designedToDrive: "Inspection bookings",
    tags: ["Local"],
    recommended: true,
    createdAt: "2026-10-27T00:00:00.000Z",
    spec,
  }
}

test("roofing focus offers the ten pro templates and marks the current one", () => {
  const item = direction()
  const html = renderToStaticMarkup(
    createElement(FocusView, {
      canvas,
      direction: item,
      spec: item.spec,
      otherDirections: [],
      brief: { goal: "Book roof inspections" },
      campaignId: "camp-1",
      onCompare: () => undefined,
      onSwitch: () => undefined,
      onStartRefining: () => undefined,
      onApproveAsIs: () => undefined,
      onBlueprintApplied: () => undefined,
    })
  )
  assert.match(html, /Pro templates/)
  assert.match(html, /The layout is already designed/)
  for (const id of ROOFING_PRO_TEMPLATE_IDS) {
    assert.match(html, new RegExp(ROOFING_PRO_META[id].name))
  }
  assert.match(html, /aria-pressed="true"/)
  assert.match(html, /Split photo/)
})

test("a non-roofing focus does not offer the roofing templates", () => {
  const item = direction()
  const html = renderToStaticMarkup(
    createElement(FocusView, {
      canvas,
      direction: item,
      spec: item.spec,
      otherDirections: [],
      brief: { goal: "Need a plumber for a leaking drain" },
      campaignId: "camp-1",
      onCompare: () => undefined,
      onSwitch: () => undefined,
      onStartRefining: () => undefined,
      onApproveAsIs: () => undefined,
      onBlueprintApplied: () => undefined,
    })
  )
  assert.doesNotMatch(html, /Pro templates/)
  assert.doesNotMatch(html, /Full-bleed roof/)
})
