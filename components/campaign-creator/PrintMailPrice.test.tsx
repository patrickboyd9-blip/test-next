import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type { PrintMailMode } from "@/lib/click2mail/mode"
import { createEmptyCampaignCreative, type Campaign } from "@/lib/campaign-creator/types"
import { DEFAULT_PRICING_CONFIG, REVIEW_MAIL_CLASS, REVIEW_PRODUCT_ID } from "@/lib/pricing/defaults"
import { customerRate } from "@/lib/pricing/quote"

import { PrintMailTestStage } from "./PrintMailTestStage"

const mode: PrintMailMode = {
  environment: "stage",
  productionEnabled: false,
  credentialsConfigured: true,
  postage: { standardFirstClassDollars: 0.495, nonstandardFirstClassDollars: 0.82 },
}

test("the review step shows one price and the compliance hook before payment", () => {
  const rate = customerRate(DEFAULT_PRICING_CONFIG, REVIEW_PRODUCT_ID, REVIEW_MAIL_CLASS)
  assert.ok(rate)
  const html = renderToStaticMarkup(
    createElement(PrintMailTestStage, {
      campaign: campaign(),
      mode,
      onCampaign() {},
      rate,
      showPricingBanner: true,
      checkout: { enabled: false, message: "Card payment is not set up yet. Nothing is sent until then." },
    })
  )
  assert.match(html, /Price per card/)
  assert.match(html, /\$0\.495/)
  assert.match(html, /Pricing not final/)
  assert.match(html, /data-compliance-hook="before-payment"/)
  assert.match(html, /Pay and send/)
  assert.match(html, /Card payment is not set up yet/)
  assert.doesNotMatch(html, /Estimated postage/)
  assert.doesNotMatch(html, /Postage estimate/)
  assert.doesNotMatch(html, /Send staging test/)
})

function campaign(): Campaign {
  const now = "2026-10-22T00:00:00.000Z"
  return {
    id: "camp-1",
    ownerId: "owner",
    status: "creative_approved",
    brief: {},
    creative: createEmptyCampaignCreative(),
    transcript: [],
    readyForBriefReview: false,
    createdAt: now,
    updatedAt: now,
  }
}
