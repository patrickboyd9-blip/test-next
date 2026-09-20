import assert from "node:assert/strict"
import { test } from "node:test"

import { resolveCreativeImage } from "./resolve-creative-image"

test("undefined imageryRole preserves ImageryKey behavior", () => {
  assert.deepEqual(resolveCreativeImage("stock_generic_local"), {
    src: "/creative-studio/imagery/stock_generic_local.jpg",
    showMonogram: false,
  })
  assert.deepEqual(resolveCreativeImage("stock_hvac"), {
    src: "/creative-studio/imagery/stock_generic_local.jpg",
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
    src: "/creative-studio/imagery/stock_generic_local.jpg",
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
