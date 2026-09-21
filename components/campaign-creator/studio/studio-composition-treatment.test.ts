import assert from "node:assert/strict"
import { test } from "node:test"

import {
  GENERATED_SPEC_TOOL_REQUIRED,
  type CreativeSpec,
} from "../../../lib/campaign-creator/types"
import {
  studioCompositionTreatment,
  type StudioCompositionTreatment,
} from "./studio-composition-treatment"

test("offer-led neighborhood differs from trust-led crew", () => {
  const offerLed = studioCompositionTreatment({
    leadJob: "offer",
    imageryRole: "neighborhood",
    layoutVariant: "type_primary_split",
  })
  const trustLed = studioCompositionTreatment({
    leadJob: "trust",
    imageryRole: "crew",
    layoutVariant: "peer_split",
  })

  assert.notDeepEqual(offerLed, trustLed)
  assert.equal(offerLed.photoWeight, "subordinate")
  assert.equal(offerLed.cropPreset, "tight")
  assert.equal(offerLed.typeEmphasis, "aggressive")
  assert.equal(offerLed.ctaWeight, "strong")
  assert.equal(offerLed.paletteMode, "field")
  assert.equal(trustLed.photoWeight, "balanced")
  assert.equal(trustLed.cropPreset, "open")
  assert.equal(trustLed.typeEmphasis, "quiet")
  assert.equal(trustLed.ctaWeight, "quiet")
  assert.equal(trustLed.paletteMode, "ink")
})

test("treatment is derived from existing CreativeSpec jobs only", () => {
  const spec: CreativeSpec = {
    layoutVariant: "type_primary_split",
    leadJob: "offer",
    imageryRole: "neighborhood",
    headline: "Free Inspection",
    body: "Licensed local crew.",
    callToAction: "Call today",
    visualDirection: "Local street photography",
    tone: "urgent",
    palette: ["#1e3a5f", "#4a90a4", "#f5f5f0"],
    imagery: "stock_generic_local",
  }

  const treatment = studioCompositionTreatment({
    leadJob: spec.leadJob,
    imageryRole: spec.imageryRole,
    layoutVariant: spec.layoutVariant,
  })

  assert.equal("photoWeight" in spec, false)
  assert.equal("cropPreset" in spec, false)
  assert.equal("ctaWeight" in spec, false)
  assert.equal(treatment.paletteMode, "field")
})

test("type_only never claims a photo weight", () => {
  const treatment = studioCompositionTreatment({
    leadJob: "trust",
    imageryRole: "crew",
    layoutVariant: "type_only",
  })
  assert.equal(treatment.photoWeight, "none")
  assert.equal(treatment.typeEmphasis, "quiet")
  assert.equal(treatment.paletteMode, "ink")
})

test("image_grounded keeps the image as ground even when offer wants a smaller photo", () => {
  const treatment = studioCompositionTreatment({
    leadJob: "offer",
    imageryRole: "neighborhood",
    layoutVariant: "image_grounded",
  })
  assert.notEqual(treatment.photoWeight, "none")
  assert.equal(treatment.ctaWeight, "strong")
  assert.equal(treatment.paletteMode, "field")
})

test("missing jobs fall back to a balanced ink treatment", () => {
  const treatment: StudioCompositionTreatment = studioCompositionTreatment({})
  assert.deepEqual(treatment, {
    photoWeight: "balanced",
    cropPreset: "default",
    typeEmphasis: "default",
    ctaWeight: "default",
    paletteMode: "ink",
  })
})

test("treatment output is renderer-owned visual knobs only", () => {
  const treatment = studioCompositionTreatment({
    leadJob: "offer",
    imageryRole: "neighborhood",
    layoutVariant: "type_primary_split",
  })
  assert.deepEqual(Object.keys(treatment).sort(), [
    "cropPreset",
    "ctaWeight",
    "paletteMode",
    "photoWeight",
    "typeEmphasis",
  ])
  assert.equal(
    GENERATED_SPEC_TOOL_REQUIRED.includes("photoWeight" as never),
    false
  )
  assert.equal(
    GENERATED_SPEC_TOOL_REQUIRED.includes("cropPreset" as never),
    false
  )
})

test("legacy layoutVariant tokens still constrain treatment", () => {
  const typeOnly = studioCompositionTreatment({
    leadJob: "trust",
    imageryRole: "crew",
    layoutVariant: "minimal_cta" as never,
  })
  assert.equal(typeOnly.photoWeight, "none")

  const grounded = studioCompositionTreatment({
    leadJob: "offer",
    imageryRole: "neighborhood",
    layoutVariant: "photo_led" as never,
  })
  assert.notEqual(grounded.photoWeight, "none")
})

test("all layout variants still resolve a treatment", () => {
  const layouts = [
    "type_primary_split",
    "peer_split",
    "banded_split",
    "image_grounded",
    "type_only",
  ] as const

  for (const layoutVariant of layouts) {
    const treatment = studioCompositionTreatment({
      leadJob: "trust",
      imageryRole: "crew",
      layoutVariant,
    })
    assert.ok(treatment.photoWeight)
    assert.ok(treatment.cropPreset)
    assert.ok(treatment.typeEmphasis)
    assert.ok(treatment.ctaWeight)
    assert.ok(treatment.paletteMode)
  }
})
