import assert from "node:assert/strict"
import { test } from "node:test"

import { LAYOUT_VARIANTS, type CreativeSpec } from "../../../lib/campaign-creator/types"
import { studioCompositionDerivation } from "./studio-composition-derivation"
import { studioCompositionStructure } from "./studio-composition-structure"

test("omitted jobs preserve family derivation", () => {
  const typePrimary = studioCompositionDerivation({ layoutVariant: "type_primary_split" })
  assert.equal(typePrimary.layoutVariant, "type_primary_split")
  assert.equal(typePrimary.typePresence, "reading")
  assert.equal(typePrimary.imagePlate, "family")
  assert.equal(typePrimary.voidShape, "leftover")

  const typeOnly = studioCompositionDerivation({ layoutVariant: "type_only" })
  assert.equal(typeOnly.typePresence, "reading")
  assert.equal(typeOnly.imagePlate, "none")
  assert.equal(typeOnly.voidShape, "leftover")

  const grounded = studioCompositionDerivation({ layoutVariant: "image_grounded" })
  assert.equal(grounded.typePresence, "reading")
  assert.equal(grounded.imagePlate, "family")
  assert.equal(grounded.voidShape, "leftover")

  const peer = studioCompositionDerivation({ layoutVariant: "peer_split" })
  assert.equal(peer.imagePlate, "family")
  assert.equal(peer.typePresence, "reading")
})

test("explicit copy and field match omission", () => {
  const omitted = studioCompositionDerivation({ layoutVariant: "type_primary_split" })
  const explicit = studioCompositionDerivation({
    layoutVariant: "type_primary_split",
    typeRole: "copy",
    imagePresence: "field",
  })
  assert.deepEqual(explicit, omitted)
})

test("type_only + subject derives object behavior", () => {
  const derived = studioCompositionDerivation({
    layoutVariant: "type_only",
    typeRole: "subject",
  })
  assert.equal(derived.layoutVariant, "type_only")
  assert.equal(derived.typePresence, "object")
  assert.equal(derived.imagePlate, "none")
  assert.equal(derived.voidShape, "shaped")
})

test("type_primary_split + accent derives a small plate", () => {
  const derived = studioCompositionDerivation({
    layoutVariant: "type_primary_split",
    imagePresence: "accent",
  })
  assert.equal(derived.layoutVariant, "type_primary_split")
  assert.equal(derived.imagePlate, "small")
  assert.equal(derived.voidShape, "shaped")
  assert.equal(derived.typePresence, "reading")
})

test("accent does not rewrite layoutVariant", () => {
  const derived = studioCompositionDerivation({
    layoutVariant: "type_primary_split",
    imagePresence: "accent",
  })
  assert.equal(derived.layoutVariant, "type_primary_split")
  assert.notEqual(derived.layoutVariant, "type_only")
  assert.deepEqual(
    studioCompositionStructure("type_primary_split").regions,
    studioCompositionStructure(derived.layoutVariant).regions
  )
})

test("subject does not rewrite layoutVariant", () => {
  const derived = studioCompositionDerivation({
    layoutVariant: "type_only",
    typeRole: "subject",
  })
  assert.equal(derived.layoutVariant, "type_only")
  assert.deepEqual(
    [...studioCompositionStructure("type_only").regions],
    ["type", "field"]
  )
})

test("leadJob offer and $25 in copy do not become subject", () => {
  const spec: CreativeSpec = {
    layoutVariant: "type_only",
    leadJob: "offer",
    headline: "$25 Off This Week",
    offer: "$25 inspection",
    imageryRole: "none",
  }
  const derived = studioCompositionDerivation({
    layoutVariant: spec.layoutVariant,
    typeRole: spec.typeRole,
    imagePresence: spec.imagePresence,
  })
  assert.equal(spec.typeRole, undefined)
  assert.equal(derived.typePresence, "reading")
  assert.notEqual(derived.typePresence, "object")
})

test("imageryRole neighborhood does not become accent", () => {
  const spec: CreativeSpec = {
    layoutVariant: "type_primary_split",
    imageryRole: "neighborhood",
    visualDirection: "Quiet local photography as a small witness",
  }
  const derived = studioCompositionDerivation({
    layoutVariant: spec.layoutVariant,
    typeRole: spec.typeRole,
    imagePresence: spec.imagePresence,
  })
  assert.equal(spec.imagePresence, undefined)
  assert.equal(derived.imagePlate, "family")
  assert.notEqual(derived.imagePlate, "small")
})

test("invalid accent families keep family plate rather than inventing a small plate", () => {
  assert.equal(
    studioCompositionDerivation({
      layoutVariant: "image_grounded",
      imagePresence: "accent",
    }).imagePlate,
    "family"
  )
  assert.equal(
    studioCompositionDerivation({
      layoutVariant: "peer_split",
      imagePresence: "accent",
    }).imagePlate,
    "family"
  )
  assert.equal(
    studioCompositionDerivation({
      layoutVariant: "type_only",
      imagePresence: "accent",
    }).imagePlate,
    "none"
  )
})

test("banded accent stays on the family plate this pass", () => {
  const derived = studioCompositionDerivation({
    layoutVariant: "banded_split",
    imagePresence: "accent",
  })
  assert.equal(derived.layoutVariant, "banded_split")
  assert.equal(derived.imagePlate, "family")
})

test("subject on image_grounded does not become an object", () => {
  const derived = studioCompositionDerivation({
    layoutVariant: "image_grounded",
    typeRole: "subject",
  })
  assert.equal(derived.layoutVariant, "image_grounded")
  assert.equal(derived.typePresence, "reading")
})

test("derivation never changes the five family region graphs", () => {
  for (const layoutVariant of LAYOUT_VARIANTS) {
    const baseline = studioCompositionStructure(layoutVariant)
    const derived = studioCompositionDerivation({
      layoutVariant,
      typeRole: "subject",
      imagePresence: "accent",
    })
    assert.equal(derived.layoutVariant, layoutVariant)
    assert.deepEqual(studioCompositionStructure(derived.layoutVariant), baseline)
  }
})
