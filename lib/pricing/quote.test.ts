import assert from "node:assert/strict"
import { test } from "node:test"

import { DEFAULT_PRICING_CONFIG } from "./defaults"
import {
  customerRate,
  formatCents,
  ownerPreviewLine,
  priceForCount,
  pricingConfigFromForm,
  quoteMailing,
  showPricingNotFinalBanner,
} from "./quote"
import type { PricingConfig } from "./types"

test("5×8 all-in price is postage when print and markup are still placeholders", () => {
  const price = quoteMailing(DEFAULT_PRICING_CONFIG, {
    productId: "postcard_5x8",
    mailClass: "first_class",
    pieceCount: 1,
  })
  assert.ok(price)
  assert.equal(price.perCardLabel, "$0.495")
  assert.equal(price.totalCents, 50)
  assert.equal(price.totalLabel, "$0.50")

  const hundred = quoteMailing(DEFAULT_PRICING_CONFIG, {
    productId: "postcard_5x8",
    mailClass: "first_class",
    pieceCount: 100,
  })
  assert.ok(hundred)
  assert.equal(hundred.perCardLabel, "$0.495")
  assert.equal(hundred.totalCents, 4950)
  assert.equal(hundred.totalLabel, "$49.50")
  assert.equal(price.pricingNotFinal, true)
})

test("markup percent and per piece both apply, then the minimum order can raise the total", () => {
  const config: PricingConfig = {
    ...DEFAULT_PRICING_CONFIG,
    pricesArePlaceholders: false,
    markupPercent: 20,
    markupPerPieceDollars: 0.05,
    minimumOrderDollars: 5,
    products: {
      ...DEFAULT_PRICING_CONFIG.products,
      postcard_5x8: {
        ...DEFAULT_PRICING_CONFIG.products.postcard_5x8,
        printCostDollars: 0.3,
        printCostIsPlaceholder: false,
      },
    },
  }
  const ten = quoteMailing(config, { productId: "postcard_5x8", mailClass: "first_class", pieceCount: 10 })
  assert.ok(ten)
  assert.equal(ten.perCardLabel, "$1.004")
  assert.equal(ten.totalCents, 1004)
  assert.equal(ten.totalLabel, "$10.04")
  assert.equal(ten.minimumApplied, false)

  const one = quoteMailing(config, { productId: "postcard_5x8", mailClass: "first_class", pieceCount: 1 })
  assert.ok(one)
  assert.equal(one.minimumApplied, true)
  assert.equal(one.totalCents, 500)
  assert.equal(one.totalLabel, "$5.00")
  assert.equal(one.perCardLabel, "$5.00")
})

test("EDDM sizes use the estimate and stay marked as placeholders", () => {
  for (const productId of ["eddm_6_5x9", "eddm_6_25x11"] as const) {
    const price = quoteMailing(DEFAULT_PRICING_CONFIG, { productId, mailClass: "eddm", pieceCount: 1000 })
    assert.ok(price)
    assert.equal(price.perCardLabel, "$0.26")
    assert.equal(price.totalLabel, "$260.00")
    assert.match(ownerPreviewLine(DEFAULT_PRICING_CONFIG, productId) ?? "", /PLACEHOLDER/)
  }
  assert.match(ownerPreviewLine(DEFAULT_PRICING_CONFIG, "postcard_6x9") ?? "", /PLACEHOLDER/)
  assert.equal(DEFAULT_PRICING_CONFIG.products.postcard_6x9.postage.first_class?.dollars, null)
  assert.equal(DEFAULT_PRICING_CONFIG.products.eddm_6_5x9.printCostDollars, null)
  assert.equal(DEFAULT_PRICING_CONFIG.products.eddm_6_25x11.printCostDollars, null)
})

test("the pricing banner shows only outside production while prices are placeholders", () => {
  assert.equal(showPricingNotFinalBanner(DEFAULT_PRICING_CONFIG, { NODE_ENV: "development" } as NodeJS.ProcessEnv), true)
  assert.equal(showPricingNotFinalBanner(DEFAULT_PRICING_CONFIG, { NODE_ENV: "test" } as NodeJS.ProcessEnv), true)
  assert.equal(
    showPricingNotFinalBanner(DEFAULT_PRICING_CONFIG, { NODE_ENV: "production", VERCEL_ENV: "preview" } as NodeJS.ProcessEnv),
    true
  )
  assert.equal(
    showPricingNotFinalBanner(DEFAULT_PRICING_CONFIG, { NODE_ENV: "production", VERCEL_ENV: "production" } as NodeJS.ProcessEnv),
    false
  )
  assert.equal(
    showPricingNotFinalBanner(DEFAULT_PRICING_CONFIG, { NODE_ENV: "production" } as NodeJS.ProcessEnv),
    false
  )
  const confirmed = { ...DEFAULT_PRICING_CONFIG, pricesArePlaceholders: false }
  assert.equal(showPricingNotFinalBanner(confirmed, { NODE_ENV: "development" } as NodeJS.ProcessEnv), false)
})

test("a zero piece count has a per-card price and no total", () => {
  const rate = customerRate(DEFAULT_PRICING_CONFIG, "postcard_5x8", "first_class")
  assert.ok(rate)
  const price = priceForCount(rate, 0)
  assert.equal(price.perCardLabel, "$0.495")
  assert.equal(price.totalLabel, "—")
  assert.equal(price.totalCents, 0)
})

test("the owner form keeps confirmed postage and blank print costs", () => {
  const form = new FormData()
  form.set("pricesArePlaceholders", "on")
  form.set("markupPercent", "10")
  form.set("markupPerPieceDollars", "0.02")
  form.set("minimumOrderDollars", "15")
  form.set("print__postcard_5x8", "0.40")
  form.set("postage__postcard_5x8__first_class", "0.495")
  form.set("postage__postcard_6x9__first_class", "")
  form.set("print__eddm_6_5x9", "")
  form.set("postage__eddm_6_5x9__eddm", "0.26")
  form.set("print__eddm_6_25x11", "")
  form.set("postage__eddm_6_25x11__eddm", "0.30")
  const saved = pricingConfigFromForm(form)
  assert.equal(saved.markupPercent, 10)
  assert.equal(saved.markupPerPieceDollars, 0.02)
  assert.equal(saved.minimumOrderDollars, 15)
  assert.equal(saved.products.postcard_5x8.printCostDollars, 0.4)
  assert.equal(saved.products.postcard_5x8.printCostIsPlaceholder, false)
  assert.equal(saved.products.postcard_5x8.postage.first_class?.isPlaceholder, false)
  assert.equal(saved.products.postcard_6x9.postage.first_class?.dollars, null)
  assert.equal(saved.products.postcard_6x9.postage.first_class?.isPlaceholder, true)
  assert.equal(saved.products.eddm_6_5x9.printCostDollars, null)
  assert.equal(saved.products.eddm_6_5x9.postage.eddm?.isPlaceholder, true)
  assert.equal(saved.products.eddm_6_25x11.postage.eddm?.dollars, 0.3)
  assert.equal(saved.products.eddm_6_25x11.postage.eddm?.isPlaceholder, false)
  assert.equal(formatCents(15), "$0.15")
})
