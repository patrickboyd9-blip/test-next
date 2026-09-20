import assert from "node:assert/strict"
import { test } from "node:test"

import { applyRecoverMissingMailPiece } from "./repository"
import type { Campaign, CreativeSpec, MailPiece, MailPieceSpec } from "./types"
import { createEmptyCampaignCreative } from "./types"

function baseSpec(overrides: Partial<CreativeSpec> = {}): CreativeSpec {
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
    ...overrides,
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

function historicalMailPiece(): MailPiece {
  return {
    id: "mail-piece-historical",
    version: 1,
    approvedAt: "2026-09-19T21:00:00.000Z",
    directionId: "dir-lead",
    revisionId: "rev-1",
    catalogId: "postcard_5x8",
    catalogVersion: 1,
    spec: baseSpec({ headline: "Historical" }),
  }
}

function recoverableCampaign(
  overrides: Partial<Campaign> = {}
): Campaign {
  const spec = baseSpec()
  return {
    id: "campaign-1",
    ownerId: "owner@example.com",
    status: "quantity_confirmed",
    brief: {
      offer: "Free roof inspection",
      audience: { description: "Homeowners in 97214", quantity: 2500 },
      qrDestination: "https://example.com/book",
      phone: "555-0100",
      website: "https://example.com",
    },
    creative: {
      ...createEmptyCampaignCreative(),
      selectedDirectionId: "dir-lead",
      activeSpec: spec,
      activeRevisionId: "rev-1",
      approvedRevisionId: "rev-1",
      approvedSpec: baseSpec({ headline: "Approved snapshot" }),
      directions: [
        {
          id: "dir-lead",
          name: "Offer First",
          rationale: "Leads with the offer.",
          designedToDrive: "Inspection bookings",
          tags: ["offer-led"],
          spec,
          recommended: true,
          createdAt: "2026-09-19T20:01:00.000Z",
        },
      ],
      revisions: [
        {
          id: "rev-1",
          directionId: "dir-lead",
          version: 1,
          spec,
          customerPrompt: "Original concept",
          studioResponse: "",
          type: "refinement",
          createdAt: "2026-09-19T20:01:00.000Z",
        },
      ],
    },
    transcript: [],
    mailPieceSpec: mailPieceSpec(),
    mailPieceVersions: [historicalMailPiece()],
    readyForBriefReview: true,
    createdAt: "2026-09-19T19:00:00.000Z",
    updatedAt: "2026-09-19T21:00:00.000Z",
    ...overrides,
  }
}

test("recovery succeeds for a campaign with persisted creative and no current MailPiece", () => {
  const campaign = recoverableCampaign()
  const now = "2026-09-20T19:00:00.000Z"

  applyRecoverMissingMailPiece(campaign, now)

  assert.equal(campaign.status, "creative_ready")
  assert.equal(campaign.updatedAt, now)
  assert.equal(campaign.mailPiece, undefined)
})

test("recovery preserves creative, brief, spec, and MailPiece history", () => {
  const campaign = recoverableCampaign()
  const before = structuredClone(campaign)
  const now = "2026-09-20T19:00:00.000Z"

  applyRecoverMissingMailPiece(campaign, now)

  assert.deepEqual(campaign.creative.approvedSpec, before.creative.approvedSpec)
  assert.equal(campaign.creative.approvedRevisionId, before.creative.approvedRevisionId)
  assert.deepEqual(campaign.creative.directions, before.creative.directions)
  assert.deepEqual(campaign.creative.revisions, before.creative.revisions)
  assert.deepEqual(campaign.creative.activeSpec, before.creative.activeSpec)
  assert.equal(campaign.creative.activeRevisionId, before.creative.activeRevisionId)
  assert.deepEqual(campaign.mailPieceSpec, before.mailPieceSpec)
  assert.deepEqual(campaign.brief, before.brief)
  assert.equal(campaign.brief.audience?.quantity, 2500)
  assert.equal(campaign.brief.qrDestination, "https://example.com/book")
  assert.equal(campaign.brief.phone, "555-0100")
  assert.equal(campaign.brief.website, "https://example.com")
  assert.deepEqual(campaign.mailPieceVersions, before.mailPieceVersions)
})

test("recovery does not create a current MailPiece", () => {
  const campaign = recoverableCampaign()

  applyRecoverMissingMailPiece(campaign, "2026-09-20T19:00:00.000Z")

  assert.equal(campaign.mailPiece, undefined)
  assert.equal((campaign.mailPieceVersions ?? []).length, 1)
  assert.equal(campaign.mailPieceVersions?.[0].id, "mail-piece-historical")
})

test("recovery fails when a current MailPiece exists and does not mutate the campaign", () => {
  const piece = historicalMailPiece()
  const campaign = recoverableCampaign({
    mailPiece: piece,
    mailPieceVersions: [piece],
    status: "creative_approved",
  })
  const before = structuredClone(campaign)

  assert.throws(
    () => applyRecoverMissingMailPiece(campaign, "2026-09-20T19:00:00.000Z"),
    /already has a current mail piece/i
  )
  assert.deepEqual(campaign, before)
})

test("recovery fails without persisted creative, does not mutate, and does not generate", () => {
  const campaign = recoverableCampaign({
    creative: createEmptyCampaignCreative(),
    mailPieceVersions: undefined,
  })
  const before = structuredClone(campaign)

  assert.equal(campaign.creative.directions.length, 0)
  assert.throws(
    () => applyRecoverMissingMailPiece(campaign, "2026-09-20T19:00:00.000Z"),
    /persisted creative to review/i
  )
  assert.deepEqual(campaign, before)
  assert.equal(campaign.creative.directions.length, 0)
  assert.equal(campaign.status, "quantity_confirmed")
})

test("recovery is allowed with or without approval snapshots", () => {
  const withSnapshots = recoverableCampaign({ status: "audience_confirmed" })
  applyRecoverMissingMailPiece(withSnapshots, "2026-09-20T19:00:00.000Z")
  assert.equal(withSnapshots.status, "creative_ready")
  assert.ok(withSnapshots.creative.approvedSpec)
  assert.equal(withSnapshots.creative.approvedRevisionId, "rev-1")

  const withoutSnapshots = recoverableCampaign({
    status: "creative_approved",
    creative: {
      ...recoverableCampaign().creative,
      approvedSpec: undefined,
      approvedRevisionId: undefined,
    },
  })
  applyRecoverMissingMailPiece(withoutSnapshots, "2026-09-20T19:05:00.000Z")
  assert.equal(withoutSnapshots.status, "creative_ready")
  assert.equal(withoutSnapshots.creative.approvedSpec, undefined)
  assert.equal(withoutSnapshots.creative.approvedRevisionId, undefined)
  assert.equal(withoutSnapshots.creative.directions.length, 1)
})

test("successful recovery leaves the campaign in creative_ready for existing Approve creative", () => {
  const campaign = recoverableCampaign({ status: "audience_confirmed" })

  applyRecoverMissingMailPiece(campaign, "2026-09-20T19:00:00.000Z")

  assert.equal(campaign.status, "creative_ready")
  assert.ok(campaign.creative.directions.length > 0)
  assert.ok(campaign.creative.activeSpec)
  assert.equal(campaign.mailPiece, undefined)
})
