import assert from "node:assert/strict"
import { test } from "node:test"

import { BETA_IMAGERY_LIBRARY } from "./beta-imagery-library"
import { resolveCreativeImage } from "./resolve-creative-image"

const NEIGHBORHOOD_SRC = "/creative-studio/imagery/stock_generic_local.jpg"

test("neighborhood role resolves to the curated local asset", () => {
  const neighborhood = BETA_IMAGERY_LIBRARY.find(
    (asset) => asset.id === "neighborhood-generic-local"
  )
  assert.equal(neighborhood?.eligibleRole, "neighborhood")
  assert.equal(neighborhood?.cluster, "generic")
  assert.equal(neighborhood?.sourceClass, "curated")
  assert.equal(neighborhood?.commercialPrintOk, true)
  assert.equal(neighborhood?.previewSrc, NEIGHBORHOOD_SRC)
  assert.deepEqual(resolveCreativeImage(undefined, "neighborhood"), {
    src: NEIGHBORHOOD_SRC,
    showMonogram: false,
  })
})

test("crew and consequence stay empty because no real assets exist", () => {
  assert.equal(
    BETA_IMAGERY_LIBRARY.some(
      (asset) => asset.eligibleRole === "crew" && asset.previewSrc
    ),
    false
  )
  assert.equal(
    BETA_IMAGERY_LIBRARY.some(
      (asset) => asset.eligibleRole === "consequence" && asset.previewSrc
    ),
    false
  )
  assert.deepEqual(resolveCreativeImage(undefined, "crew"), {
    src: null,
    showMonogram: false,
  })
  assert.deepEqual(resolveCreativeImage(undefined, "consequence"), {
    src: null,
    showMonogram: false,
  })
})

test("undefined imageryRole preserves ImageryKey behavior", () => {
  assert.deepEqual(resolveCreativeImage("stock_generic_local"), {
    src: NEIGHBORHOOD_SRC,
    showMonogram: false,
  })
  assert.deepEqual(resolveCreativeImage("stock_hvac"), {
    src: NEIGHBORHOOD_SRC,
    showMonogram: false,
  })
  assert.deepEqual(resolveCreativeImage("logo_primary"), {
    src: null,
    showMonogram: true,
  })
  assert.deepEqual(resolveCreativeImage("none"), {
    src: null,
    showMonogram: false,
  })
  assert.deepEqual(resolveCreativeImage(undefined), {
    src: null,
    showMonogram: false,
  })
})

test("imageryRole overrides ImageryKey without inventing missing assets", () => {
  assert.deepEqual(resolveCreativeImage("stock_hvac", "neighborhood"), {
    src: NEIGHBORHOOD_SRC,
    showMonogram: false,
  })
  assert.deepEqual(resolveCreativeImage("stock_hvac", "none"), {
    src: null,
    showMonogram: false,
  })
  assert.deepEqual(resolveCreativeImage("none", "logo"), {
    src: null,
    showMonogram: true,
  })
  assert.deepEqual(resolveCreativeImage("stock_generic_local", "consequence"), {
    src: null,
    showMonogram: false,
  })
  assert.deepEqual(resolveCreativeImage("stock_generic_local", "crew"), {
    src: null,
    showMonogram: false,
  })
})
