import assert from "node:assert/strict"
import { test } from "node:test"

import { BETA_IMAGERY_LIBRARY } from "./beta-imagery-library"
import {
  GENERATED_ASSET_SOURCE_CLASS,
  type GeneratedAsset,
} from "./image-generation"
import { resolveCreativeImage } from "./resolve-creative-image"

const NEIGHBORHOOD_SRC = "/creative-studio/imagery/stock_generic_local.jpg"
const CREW_SRC = "/creative-studio/imagery/crew_trades_handshake.jpg"
const CONSEQUENCE_SRC = "/creative-studio/imagery/consequence_ruined_kitchen.jpg"

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

test("crew role resolves to the first crew beta asset", () => {
  const crew = BETA_IMAGERY_LIBRARY.filter(
    (asset) => asset.eligibleRole === "crew" && asset.previewSrc
  )
  assert.equal(crew[0]?.id, "crew-trades-handshake")
  assert.equal(crew[0]?.previewSrc, CREW_SRC)
  assert.deepEqual(resolveCreativeImage(undefined, "crew"), {
    src: CREW_SRC,
    showMonogram: false,
  })
})

test("consequence role resolves to the first consequence beta asset", () => {
  const consequence = BETA_IMAGERY_LIBRARY.filter(
    (asset) => asset.eligibleRole === "consequence" && asset.previewSrc
  )
  assert.equal(consequence[0]?.id, "consequence-ruined-kitchen")
  assert.equal(consequence[0]?.previewSrc, CONSEQUENCE_SRC)
  assert.deepEqual(resolveCreativeImage(undefined, "consequence"), {
    src: CONSEQUENCE_SRC,
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
  assert.deepEqual(resolveCreativeImage("stock_generic_local", "crew"), {
    src: CREW_SRC,
    showMonogram: false,
  })
  assert.deepEqual(resolveCreativeImage("stock_generic_local", "consequence"), {
    src: CONSEQUENCE_SRC,
    showMonogram: false,
  })
})

const GENERATED: GeneratedAsset = {
  id: "gen-render-1",
  src: "/tmp/generated-render.png",
  sourceClass: GENERATED_ASSET_SOURCE_CLASS,
  provider: "test",
  model: "test-model",
  generatedAt: "2026-09-24T05:00:00.000Z",
}

test("generated asset is used for an image-bearing role", () => {
  assert.deepEqual(resolveCreativeImage("stock_hvac", "crew", GENERATED), {
    src: GENERATED.src,
    showMonogram: false,
  })
  assert.deepEqual(
    resolveCreativeImage(undefined, "consequence", GENERATED),
    {
      src: GENERATED.src,
      showMonogram: false,
    }
  )
  assert.deepEqual(
    resolveCreativeImage("stock_generic_local", "neighborhood", GENERATED),
    {
      src: GENERATED.src,
      showMonogram: false,
    }
  )
})

test("generated asset produces showMonogram false", () => {
  const resolved = resolveCreativeImage(undefined, "crew", GENERATED)
  assert.equal(resolved.src, GENERATED.src)
  assert.equal(resolved.showMonogram, false)
})

test("generated asset is ignored for imageryRole none", () => {
  assert.deepEqual(resolveCreativeImage("stock_hvac", "none", GENERATED), {
    src: null,
    showMonogram: false,
  })
})

test("generated asset is ignored for imageryRole logo", () => {
  assert.deepEqual(resolveCreativeImage("none", "logo", GENERATED), {
    src: null,
    showMonogram: true,
  })
})

test("existing curated fallback still works when generated is omitted", () => {
  assert.deepEqual(resolveCreativeImage(undefined, "neighborhood"), {
    src: NEIGHBORHOOD_SRC,
    showMonogram: false,
  })
  assert.deepEqual(resolveCreativeImage(undefined, "crew", null), {
    src: CREW_SRC,
    showMonogram: false,
  })
  assert.deepEqual(resolveCreativeImage("stock_generic_local"), {
    src: NEIGHBORHOOD_SRC,
    showMonogram: false,
  })
})

test("existing missing-role behavior remains unchanged", () => {
  assert.deepEqual(resolveCreativeImage("stock_hvac", "none"), {
    src: null,
    showMonogram: false,
  })
  assert.deepEqual(resolveCreativeImage("stock_generic_local", "crew"), {
    src: CREW_SRC,
    showMonogram: false,
  })
})
