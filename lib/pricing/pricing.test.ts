import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"

import { ownerCookieMatches, ownerKeyMatches, ownerSessionToken } from "./owner-gate"
import { createFilePricingStore } from "./store"
import type { PricingConfig } from "./types"
import { DEFAULT_PRICING_CONFIG } from "./defaults"

test("the owner key matches only the configured password", () => {
  const env = { PRICING_OWNER_KEY: "patrick-key", NODE_ENV: "test" } as NodeJS.ProcessEnv
  assert.equal(ownerKeyMatches("patrick-key", env), true)
  assert.equal(ownerKeyMatches("someone-else", env), false)
  assert.equal(ownerKeyMatches("patrick-key", { NODE_ENV: "test" }), false)
  const token = ownerSessionToken("patrick-key")
  assert.equal(ownerCookieMatches(token, env), true)
  assert.equal(ownerCookieMatches(ownerSessionToken("other"), env), false)
  assert.notEqual(token, "patrick-key")
})

test("pricing settings round-trip in the settings file", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mm-pricing-"))
  try {
    const store = createFilePricingStore(dir)
    assert.equal((await store.get()).pricesArePlaceholders, true)
    const next: PricingConfig = {
      ...DEFAULT_PRICING_CONFIG,
      markupPercent: 12,
      products: {
        ...DEFAULT_PRICING_CONFIG.products,
        postcard_5x8: {
          ...DEFAULT_PRICING_CONFIG.products.postcard_5x8,
          printCostDollars: 0.33,
          printCostIsPlaceholder: false,
        },
      },
    }
    await store.put(next)
    const saved = await store.get()
    assert.equal(saved.markupPercent, 12)
    assert.equal(saved.products.postcard_5x8.printCostDollars, 0.33)
    assert.equal(saved.products.eddm_6_5x9.printCostDollars, null)
    assert.equal(saved.products.eddm_6_25x11.postage.eddm?.dollars, 0.26)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
