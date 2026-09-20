import assert from "node:assert/strict"
import { test } from "node:test"

import { applyLaunch } from "./repository"
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

test("Launch succeeds from quantity_confirmed with a current MailPiece", () => {
  const campaign = campaignWithCurrentMailPiece("quantity_confirmed")
  const piece = campaign.mailPiece
  const pieceSnapshot = structuredClone(piece)
  const history = campaign.mailPieceVersions
  const historySnapshot = structuredClone(history)
  const now = "2026-09-20T18:10:00.000Z"

  applyLaunch(campaign, now)

  assert.equal(campaign.status, "launched")
  assert.equal(campaign.updatedAt, now)
  assert.equal(campaign.mailPiece, piece)
  assert.deepEqual(campaign.mailPiece, pieceSnapshot)
  assert.equal(campaign.mailPieceVersions, history)
  assert.deepEqual(campaign.mailPieceVersions, historySnapshot)
  assert.equal("productionDocument" in campaign, false)
})

test("Launch fails when no current MailPiece exists", () => {
  const campaign = campaignWithoutCurrentMailPiece("quantity_confirmed")
  const before = structuredClone(campaign)

  assert.throws(
    () => applyLaunch(campaign, "2026-09-20T18:10:00.000Z"),
    /current mail piece/i
  )
  assert.deepEqual(campaign, before)
  assert.equal(campaign.mailPiece, undefined)
  assert.equal("productionDocument" in campaign, false)
})

test("Launch fails when status is not quantity_confirmed", () => {
  const campaign = campaignWithCurrentMailPiece("audience_confirmed")
  const before = structuredClone(campaign)

  assert.throws(
    () => applyLaunch(campaign, "2026-09-20T18:10:00.000Z"),
    /quantity is confirmed/i
  )
  assert.deepEqual(campaign, before)
  assert.equal(campaign.status, "audience_confirmed")
})

test("MailPiece history alone does not satisfy Launch", () => {
  const history = [mailPiece({ id: "mail-piece-historical", version: 1 })]
  const campaign = campaignWithoutCurrentMailPiece("quantity_confirmed", history)
  const before = structuredClone(campaign)

  assert.equal(campaign.mailPiece, undefined)
  assert.equal((campaign.mailPieceVersions ?? []).length, 1)
  assert.throws(
    () => applyLaunch(campaign, "2026-09-20T18:10:00.000Z"),
    /current mail piece/i
  )
  assert.deepEqual(campaign, before)
  assert.equal(campaign.mailPiece, undefined)
})
