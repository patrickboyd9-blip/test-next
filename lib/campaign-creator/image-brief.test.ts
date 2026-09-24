import assert from "node:assert/strict"
import { test } from "node:test"

import { getMockCreativeDirections } from "./mock-creative-data"
import {
  IMAGE_BRIEF_DO_NOT_INVENT,
  toImageBrief,
  type ImageBrief,
} from "./image-brief"
import type { CreativeSpec, LayoutVariant } from "./types"

function spec(overrides: Partial<CreativeSpec> = {}): CreativeSpec {
  return {
    layoutVariant: "type_primary_split",
    headline: "Free Inspection Now",
    body: "Licensed local crew ready to inspect.",
    callToAction: "Call to book",
    visualDirection: "Professional technician at work, warm and trustworthy",
    tone: "Trustworthy, professional, local",
    palette: ["#1e3a5f", "#4a90a4", "#f5f5f0"],
    imagery: "stock_hvac",
    leadJob: "trust",
    imageryRole: "crew",
    ...overrides,
  }
}

function briefKeys(brief: ImageBrief): string[] {
  return Object.keys(brief).sort()
}

test("existing crew direction produces an ImageBrief", () => {
  const crewSpec = getMockCreativeDirections()[0]?.spec
  assert.ok(crewSpec)
  assert.equal(crewSpec.imageryRole, "crew")

  const brief = toImageBrief(crewSpec)
  assert.ok(brief)
  assert.equal(brief.imageryRole, "crew")
  assert.equal(
    brief.visualDirection,
    "Professional technician at work, warm and trustworthy"
  )
  assert.equal(brief.occupancy, "supporting")
  assert.equal(brief.leadJob, "trust")
  assert.equal(brief.tone, crewSpec.tone)
  assert.deepEqual(brief.doNotInvent, IMAGE_BRIEF_DO_NOT_INVENT)
  assert.match(brief.doNotInvent.join(" "), /invented crew or personnel/)
  assert.match(brief.doNotInvent.join(" "), /invented property damage/)
  assert.match(brief.doNotInvent.join(" "), /recipient-specific/)
  assert.match(brief.doNotInvent.join(" "), /interchangeable stock/)
})

test("imageryRole none returns null", () => {
  assert.equal(toImageBrief(spec({ imageryRole: "none" })), null)
})

test("imageryRole logo returns null", () => {
  assert.equal(toImageBrief(spec({ imageryRole: "logo" })), null)
})

test("type_only with no image job returns null", () => {
  assert.equal(
    toImageBrief(
      spec({
        layoutVariant: "type_only",
        imageryRole: "none",
        visualDirection: "Type carries the piece",
      })
    ),
    null
  )
})

test("image_grounded derives occupancy field", () => {
  const brief = toImageBrief(
    spec({
      layoutVariant: "image_grounded",
      imageryRole: "neighborhood",
      visualDirection: "Warm neighborhood photography, approachable and local",
      leadJob: "offer",
    })
  )
  assert.ok(brief)
  assert.equal(brief.occupancy, "field")
  assert.equal(brief.imageryRole, "neighborhood")
})

test("imagePresence accent derives occupancy witness", () => {
  const brief = toImageBrief(
    spec({
      layoutVariant: "type_primary_split",
      imagePresence: "accent",
      imageryRole: "neighborhood",
    })
  )
  assert.ok(brief)
  assert.equal(brief.occupancy, "witness")
})

test("split layouts derive occupancy supporting", () => {
  const splits = [
    "type_primary_split",
    "peer_split",
    "banded_split",
  ] as const satisfies readonly LayoutVariant[]

  for (const layoutVariant of splits) {
    const brief = toImageBrief(spec({ layoutVariant }))
    assert.ok(brief, layoutVariant)
    assert.equal(brief.occupancy, "supporting", layoutVariant)
  }
})

test("returned brief keeps conceived visualDirection unchanged", () => {
  const visualDirection = "Documentary install photography, type-safe sky"
  const brief = toImageBrief(spec({ visualDirection }))
  assert.ok(brief)
  assert.equal(brief.visualDirection, visualDirection)
})

test("returned brief has no provider, model, prompt, layout, crop, or position fields", () => {
  const brief = toImageBrief(spec())
  assert.ok(brief)
  assert.deepEqual(briefKeys(brief), [
    "doNotInvent",
    "imageryRole",
    "leadJob",
    "occupancy",
    "tone",
    "visualDirection",
  ])
  assert.equal("provider" in brief, false)
  assert.equal("model" in brief, false)
  assert.equal("prompt" in brief, false)
  assert.equal("layoutVariant" in brief, false)
  assert.equal("layout" in brief, false)
  assert.equal("crop" in brief, false)
  assert.equal("position" in brief, false)
  assert.equal("imagePresence" in brief, false)
})
