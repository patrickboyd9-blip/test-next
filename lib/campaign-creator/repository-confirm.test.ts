import assert from "node:assert/strict"
import { test } from "node:test"

import {
  applyAudienceConfirmation,
  applyQuantityConfirmation,
} from "./repository"
import type { Campaign, CreativeSpec, MailPiece, MailPieceSpec } from "./types"
import { createEmptyCampaignCreative } from "./types"

function baseSpec(): CreativeSpec {
  return {
    layoutVariant: "offer_hero",
    headline: "Free Inspection Now",
    body: "Licensed local crew ready to inspect.",
    callToAction: "Call to book",
    visualDirection: "Neighborhood photography",
    tone: "Trustworthy",
    palette: ["#1e3a5f", "#4a90a4", "#f5f5f0"],
    imagery: "stock_generic_local",
    offer: "Free roof inspection",
    leadJob: "offer",
    imageryRole: "neighborhood",
  }
}

function mailPieceSpec(): MailPieceSpec {
  return {
    recommendedCatalogId: "postcard_5x8",
    recommendedCatalogVersion: 1,
    selectedCatalogId: "postcard_5x8",
    selectedCatalogVersion: 1,
    customerOverride: false,
    decidedAt: "2026-09-19T20:00:00.000Z",
    decidedBy: "owner@example.com",
    addressFaceAuthorship: "fulfillment",
  }
}

function mailPiece(overrides: Partial<MailPiece> = {}): MailPiece {
  return {
    id: "mail-piece-1",
    version: 1,
    approvedAt: "2026-09-19T21:00:00.000Z",
    directionId: "dir-lead",
    revisionId: "rev-1",
    catalogId: "postcard_5x8",
    catalogVersion: 1,
    spec: baseSpec(),
    ...overrides,
  }
}

function campaignWithCurrentMailPiece(
  status: Campaign["status"]
): Campaign {
  const piece = mailPiece()
  return {
    id: "campaign-1",
    ownerId: "owner@example.com",
    status,
    brief: { offer: "Free roof inspection" },
    creative: {
      ...createEmptyCampaignCreative(),
      approvedRevisionId: "rev-1",
      approvedSpec: baseSpec(),
    },
    transcript: [],
    mailPieceSpec: mailPieceSpec(),
    mailPiece: piece,
    mailPieceVersions: [piece],
    readyForBriefReview: true,
    createdAt: "2026-09-19T19:00:00.000Z",
    updatedAt: "2026-09-19T21:00:00.000Z",
  }
}

function campaignWithoutCurrentMailPiece(
  status: Campaign["status"],
  history: MailPiece[] | undefined = undefined
): Campaign {
  return {
    id: "campaign-1",
    ownerId: "owner@example.com",
    status,
    brief: { offer: "Free roof inspection" },
    creative: {
      ...createEmptyCampaignCreative(),
      approvedRevisionId: "rev-1",
      approvedSpec: baseSpec(),
    },
    transcript: [],
    mailPieceSpec: mailPieceSpec(),
    mailPieceVersions: history,
    readyForBriefReview: true,
    createdAt: "2026-09-19T19:00:00.000Z",
    updatedAt: "2026-09-19T21:00:00.000Z",
  }
}

test("confirmAudience succeeds when a current MailPiece exists", () => {
  const campaign = campaignWithCurrentMailPiece("creative_approved")
  const piece = campaign.mailPiece
  const history = campaign.mailPieceVersions
  const now = "2026-09-20T18:00:00.000Z"

  applyAudienceConfirmation(campaign, now)

  assert.equal(campaign.status, "audience_confirmed")
  assert.equal(campaign.updatedAt, now)
  assert.equal(campaign.mailPiece, piece)
  assert.equal(campaign.mailPieceVersions, history)
  assert.deepEqual(campaign.creative.approvedSpec, baseSpec())
  assert.equal(campaign.creative.approvedRevisionId, "rev-1")
})

test("confirmAudience fails when no current MailPiece exists", () => {
  const campaign = campaignWithoutCurrentMailPiece("creative_approved")

  assert.throws(
    () => applyAudienceConfirmation(campaign, "2026-09-20T18:00:00.000Z"),
    /current mail piece/i
  )
})

test("failed confirmAudience does not change the campaign status", () => {
  const campaign = campaignWithoutCurrentMailPiece("creative_approved")
  const before = structuredClone(campaign)

  assert.throws(
    () => applyAudienceConfirmation(campaign, "2026-09-20T18:00:00.000Z"),
    /current mail piece/i
  )
  assert.deepEqual(campaign, before)
})

test("confirmQuantity succeeds when a current MailPiece exists", () => {
  const campaign = campaignWithCurrentMailPiece("audience_confirmed")
  const piece = campaign.mailPiece
  const history = campaign.mailPieceVersions
  const now = "2026-09-20T18:05:00.000Z"

  applyQuantityConfirmation(campaign, now)

  assert.equal(campaign.status, "quantity_confirmed")
  assert.equal(campaign.updatedAt, now)
  assert.equal(campaign.mailPiece, piece)
  assert.equal(campaign.mailPieceVersions, history)
  assert.deepEqual(campaign.creative.approvedSpec, baseSpec())
  assert.equal(campaign.creative.approvedRevisionId, "rev-1")
})

test("confirmQuantity fails when no current MailPiece exists", () => {
  const campaign = campaignWithoutCurrentMailPiece("audience_confirmed")

  assert.throws(
    () => applyQuantityConfirmation(campaign, "2026-09-20T18:05:00.000Z"),
    /current mail piece/i
  )
})

test("failed confirmQuantity does not change the campaign status", () => {
  const campaign = campaignWithoutCurrentMailPiece("audience_confirmed")
  const before = structuredClone(campaign)

  assert.throws(
    () => applyQuantityConfirmation(campaign, "2026-09-20T18:05:00.000Z"),
    /current mail piece/i
  )
  assert.deepEqual(campaign, before)
})

test("MailPiece history alone does not satisfy confirmAudience or confirmQuantity", () => {
  const history = [mailPiece({ id: "mail-piece-historical", version: 1 })]
  const audienceCampaign = campaignWithoutCurrentMailPiece(
    "creative_approved",
    history
  )
  const quantityCampaign = campaignWithoutCurrentMailPiece(
    "audience_confirmed",
    history
  )
  const audienceBefore = structuredClone(audienceCampaign)
  const quantityBefore = structuredClone(quantityCampaign)

  assert.equal(audienceCampaign.mailPiece, undefined)
  assert.equal((audienceCampaign.mailPieceVersions ?? []).length, 1)
  assert.throws(
    () => applyAudienceConfirmation(audienceCampaign, "2026-09-20T18:00:00.000Z"),
    /current mail piece/i
  )
  assert.deepEqual(audienceCampaign, audienceBefore)

  assert.throws(
    () => applyQuantityConfirmation(quantityCampaign, "2026-09-20T18:05:00.000Z"),
    /current mail piece/i
  )
  assert.deepEqual(quantityCampaign, quantityBefore)
})
