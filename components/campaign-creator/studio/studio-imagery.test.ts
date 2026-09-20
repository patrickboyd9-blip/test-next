import assert from "node:assert/strict"
import { test } from "node:test"

import {
  resolveStudioImagery,
  studioCopyHierarchy,
} from "./studio-imagery"

test("undefined imageryRole preserves ImageryKey behavior", () => {
  assert.deepEqual(resolveStudioImagery("stock_generic_local"), {
    src: "/creative-studio/imagery/stock_generic_local.jpg",
    showMonogram: false,
  })
  assert.deepEqual(resolveStudioImagery("stock_hvac"), {
    src: "/creative-studio/imagery/stock_generic_local.jpg",
    showMonogram: false,
  })
  assert.deepEqual(resolveStudioImagery("logo_primary"), {
    src: null,
    showMonogram: true,
  })
  assert.deepEqual(resolveStudioImagery("none"), {
    src: null,
    showMonogram: false,
  })
  assert.deepEqual(resolveStudioImagery(undefined), {
    src: null,
    showMonogram: false,
  })
})

test("imageryRole overrides ImageryKey without inventing missing assets", () => {
  assert.deepEqual(resolveStudioImagery("stock_hvac", "neighborhood"), {
    src: "/creative-studio/imagery/stock_generic_local.jpg",
    showMonogram: false,
  })
  assert.deepEqual(resolveStudioImagery("stock_hvac", "none"), {
    src: null,
    showMonogram: false,
  })
  assert.deepEqual(resolveStudioImagery("none", "logo"), {
    src: null,
    showMonogram: true,
  })
  assert.deepEqual(resolveStudioImagery("stock_generic_local", "consequence"), {
    src: null,
    showMonogram: false,
  })
  assert.deepEqual(resolveStudioImagery("stock_generic_local", "crew"), {
    src: null,
    showMonogram: false,
  })
})

test("leadJob hierarchy is offer-hero, message-hero, or layout default", () => {
  assert.equal(studioCopyHierarchy(undefined), "layout-default")
  assert.equal(studioCopyHierarchy("offer"), "offer-hero")
  assert.equal(studioCopyHierarchy("problem"), "message-hero")
  assert.equal(studioCopyHierarchy("trust"), "message-hero")
  assert.equal(studioCopyHierarchy("urgency"), "message-hero")
})
