import assert from "node:assert/strict"
import { test } from "node:test"

import { createEmptyCampaignCreative, type Campaign, type UploadedDesign } from "@/lib/campaign-creator/types"

import { applyUploadedDesignApproval } from "./approval"
import {
  DESIGN_REVIEW_QUESTION,
  DESIGN_REVIEW_SYSTEM,
  attachDesignReview,
  declineUploadedDesignReview,
  isDesignReviewAvailable,
  normalizeDesignReview,
  reviewBlocksApproval,
} from "./design-review"

test("a review is optional and skipping it does not block approval or edit the file", () => {
  const design = uploadedDesign()
  const declined = declineUploadedDesignReview(design)
  assert.equal(design.review, undefined)
  assert.equal(declined.review?.declined, true)
  assert.equal(declined.front?.key, design.front?.key)
  assert.equal(declined.back?.key, design.back?.key)
  assert.equal(reviewBlocksApproval(declined), false)

  const campaign = uploadCampaign(declined)
  applyUploadedDesignApproval(campaign, "2026-10-11T00:00:00.000Z", "print.pdf")
  assert.equal(campaign.status, "creative_approved")
  assert.equal(campaign.uploadedDesign?.front?.key, "front.png")
  assert.equal(campaign.uploadedDesign?.review?.declined, true)
})

test("suggestions do not change the uploaded files and drop scores", () => {
  const design = uploadedDesign()
  const suggestions = normalizeDesignReview({
    suggestions: [
      "The headline is clear and the offer is easy to see. Score: A+",
      "Grade: B-. You might consider more contrast on the headline.",
      "You should make the phone number larger.",
      "You might consider leaving the address area empty.",
      "Extra note 8/10",
      "This sixth idea should be dropped.",
    ],
  })
  assert.equal(suggestions.length, 5)
  assert.match(suggestions[0] ?? "", /^The headline is clear/)
  assert.doesNotMatch(suggestions.join(" "), /\bscore\b|\bgrade\b|\bA\+|\bB-|8\/10/i)
  assert.match(suggestions[1] ?? "", /^You might consider/)
  assert.match(suggestions[2] ?? "", /^You might consider you should make the phone/)

  const reviewed = attachDesignReview(design, suggestions, "2026-10-11T00:00:00.000Z")
  assert.equal(design.review, undefined)
  assert.equal(reviewed.front?.key, "front.png")
  assert.equal(reviewed.back?.key, "back.png")
  assert.deepEqual(reviewed.review?.suggestions, suggestions)

  const campaign = uploadCampaign(reviewed)
  applyUploadedDesignApproval(campaign, "2026-10-11T00:00:00.000Z", "print.pdf")
  assert.equal(campaign.status, "creative_approved")
  assert.equal(campaign.uploadedDesign?.front?.key, "front.png")
})

test("a review with fewer than three suggestions is refused", () => {
  assert.throws(() => normalizeDesignReview({ suggestions: ["Nice type.", "Clear offer."] }), /enough suggestions/)
})

test("the review question is hidden without an API key and the prompt forbids scores", () => {
  assert.equal(isDesignReviewAvailable({} as unknown as NodeJS.ProcessEnv), false)
  assert.equal(
    isDesignReviewAvailable({ ANTHROPIC_API_KEY: "test-key", CREATIVE_ENGINE: "mock" } as unknown as NodeJS.ProcessEnv),
    false
  )
  assert.equal(isDesignReviewAvailable({ ANTHROPIC_API_KEY: "test-key" } as unknown as NodeJS.ProcessEnv), true)
  assert.equal(DESIGN_REVIEW_QUESTION, "Do you want our team to review and offer some feedback?")
  assert.match(DESIGN_REVIEW_SYSTEM, /headline/i)
  assert.match(DESIGN_REVIEW_SYSTEM, /offer/i)
  assert.match(DESIGN_REVIEW_SYSTEM, /contrast/i)
  assert.match(DESIGN_REVIEW_SYSTEM, /focal point/i)
  assert.match(DESIGN_REVIEW_SYSTEM, /phone/i)
  assert.match(DESIGN_REVIEW_SYSTEM, /QR/)
  assert.match(DESIGN_REVIEW_SYSTEM, /safe zone/i)
  assert.match(DESIGN_REVIEW_SYSTEM, /address/i)
  assert.match(DESIGN_REVIEW_SYSTEM, /You might consider/)
  assert.match(DESIGN_REVIEW_SYSTEM, /what already works well/i)
  assert.match(DESIGN_REVIEW_SYSTEM, /Do not mention a score/)
  assert.match(DESIGN_REVIEW_SYSTEM, /do not edit their file/i)
})

function uploadedDesign(): UploadedDesign {
  return {
    front: { fileName: "front.png", mediaType: "image/png", byteLength: 10, key: "front.png" },
    back: { fileName: "back.png", mediaType: "image/png", byteLength: 10, key: "back.png" },
    issues: [],
  }
}

function uploadCampaign(design: UploadedDesign): Campaign {
  const now = "2026-10-11T00:00:00.000Z"
  return {
    id: "camp",
    ownerId: "owner",
    entry: "upload",
    name: "Spring postcard",
    status: "strategy_confirmed",
    brief: { businessInfo: { name: "Northwind" } },
    creative: createEmptyCampaignCreative(),
    transcript: [],
    designSource: "upload",
    uploadedDesign: design,
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
