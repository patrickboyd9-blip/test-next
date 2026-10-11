import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { DESIGN_REVIEW_QUESTION } from "@/lib/bring-your-own-design/design-review"
import { createEmptyCampaignCreative, type Campaign } from "@/lib/campaign-creator/types"

import { UploadDesign } from "./UploadDesign"

test("the review prompt is optional and approval stays available", () => {
  const html = render(true)
  assert.match(html, new RegExp(DESIGN_REVIEW_QUESTION))
  assert.match(html, />Yes</)
  assert.match(html, />No</)
  assert.match(html, /Approve this proof/)
})

test("the review prompt is hidden when the creative engine has no API key", () => {
  const html = render(false)
  assert.doesNotMatch(html, new RegExp(DESIGN_REVIEW_QUESTION))
  assert.match(html, /Approve this proof/)
})

test("a declined review leaves approval in place", () => {
  const campaign = readyCampaign()
  campaign.uploadedDesign = {
    ...campaign.uploadedDesign!,
    review: { declined: true },
  }
  const html = renderToStaticMarkup(
    createElement(UploadDesign, { campaign, onCampaign() {}, reviewAvailable: true })
  )
  assert.doesNotMatch(html, new RegExp(DESIGN_REVIEW_QUESTION))
  assert.match(html, /Approve this proof/)
})

test("saved suggestions render without a score and do not replace approval", () => {
  const campaign = readyCampaign()
  campaign.uploadedDesign = {
    ...campaign.uploadedDesign!,
    review: {
      suggestions: [
        "The headline is clear and the offer is easy to see.",
        "You might consider a larger phone number.",
        "You might consider leaving the address area empty.",
      ],
    },
  }
  const html = renderToStaticMarkup(
    createElement(UploadDesign, { campaign, onCampaign() {}, reviewAvailable: true })
  )
  assert.doesNotMatch(html, new RegExp(DESIGN_REVIEW_QUESTION))
  assert.match(html, /The headline is clear/)
  assert.match(html, /You might consider a larger phone number/)
  assert.doesNotMatch(html, /score|grade/i)
  assert.match(html, /Approve this proof/)
  assert.match(html, /Your files stay as you uploaded them/)
})

function render(reviewAvailable: boolean): string {
  return renderToStaticMarkup(
    createElement(UploadDesign, {
      campaign: readyCampaign(),
      onCampaign() {},
      reviewAvailable,
    })
  )
}

function readyCampaign(): Campaign {
  const now = "2026-10-11T00:00:00.000Z"
  return {
    id: "camp",
    ownerId: "owner",
    entry: "upload",
    name: "Spring postcard",
    status: "strategy_confirmed",
    brief: {
      businessInfo: {
        name: "Northwind HVAC",
        street: "100 Main St",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
      },
    },
    creative: createEmptyCampaignCreative(),
    transcript: [],
    designSource: "upload",
    uploadedDesign: {
      front: { fileName: "front.png", mediaType: "image/png", byteLength: 10, key: "front.png" },
      back: { fileName: "back.png", mediaType: "image/png", byteLength: 10, key: "back.png" },
      issues: [],
    },
    mailPieceSpec: {
      recommendedCatalogId: "postcard_5x8",
      recommendedCatalogVersion: 1,
      selectedCatalogId: "postcard_5x8",
      selectedCatalogVersion: 1,
      customerOverride: false,
      decidedAt: now,
      decidedBy: "owner",
      addressFaceAuthorship: "fulfillment",
    },
    readyForBriefReview: false,
    createdAt: now,
    updatedAt: now,
  }
}
