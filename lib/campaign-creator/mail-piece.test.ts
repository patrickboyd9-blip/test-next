import assert from "node:assert/strict"
import { test } from "node:test"

import {
  applyCreativeApproval,
  applyCreativeUnapproval,
  getCurrentMailPiece,
  nextMailPieceVersion,
} from "./mail-piece"
import { cloneSpec } from "./spec-diff"
import type {
  Campaign,
  CreativeSpec,
  MailPiece,
  MailPieceSpec,
} from "./types"
import { createEmptyCampaignCreative } from "./types"

const MAIL_PIECE_KEYS = [
  "id",
  "version",
  "approvedAt",
  "directionId",
  "revisionId",
  "catalogId",
  "catalogVersion",
  "spec",
] as const

function baseSpec(overrides: Partial<CreativeSpec> = {}): CreativeSpec {
  return {
    layoutVariant: "type_primary_split",
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

function approvableCampaign(spec: CreativeSpec = baseSpec()): Campaign {
  const directionId = "dir-lead"
  const revisionId = "rev-1"
  return {
    id: "campaign-1",
    ownerId: "owner@example.com",
    status: "creative_ready",
    brief: { offer: "Free roof inspection" },
    creative: {
      ...createEmptyCampaignCreative(),
      selectedDirectionId: directionId,
      activeSpec: cloneSpec(spec),
      activeRevisionId: revisionId,
      directions: [
        {
          id: directionId,
          name: "Offer First",
          rationale: "Leads with the existing offer so the next step is obvious.",
          designedToDrive: "Inspection bookings",
          tags: ["offer-led", "local", "clear-cta"],
          spec: cloneSpec(spec),
          recommended: true,
          createdAt: "2026-09-19T20:01:00.000Z",
        },
      ],
      revisions: [
        {
          id: revisionId,
          directionId,
          version: 1,
          spec: cloneSpec(spec),
          customerPrompt: "Original concept",
          studioResponse: "",
          type: "refinement",
          createdAt: "2026-09-19T20:01:00.000Z",
        },
      ],
    },
    transcript: [],
    mailPieceSpec: mailPieceSpec(),
    readyForBriefReview: true,
    createdAt: "2026-09-19T19:00:00.000Z",
    updatedAt: "2026-09-19T20:01:00.000Z",
  }
}

test("next MailPiece version starts at 1 and increments from history", () => {
  assert.equal(nextMailPieceVersion(undefined), 1)
  assert.equal(nextMailPieceVersion([]), 1)
  assert.equal(
    nextMailPieceVersion([{ version: 1 } as MailPiece, { version: 2 } as MailPiece]),
    3
  )
})

test("first approval creates MailPiece version 1 bound to the approved spec and catalog", () => {
  const spec = baseSpec({ headline: "Approved Headline" })
  const campaign = approvableCampaign(spec)
  const now = "2026-09-19T21:00:00.000Z"

  applyCreativeApproval(campaign, now)

  const current = getCurrentMailPiece(campaign)
  assert.ok(current)
  assert.equal(current.version, 1)
  assert.equal(current.approvedAt, now)
  assert.equal(current.directionId, "dir-lead")
  assert.equal(current.revisionId, "rev-1")
  assert.equal(current.catalogId, "postcard_5x8")
  assert.equal(current.catalogVersion, 1)
  assert.equal(current.spec.headline, "Approved Headline")
  assert.deepEqual(current.spec, spec)
  assert.equal(campaign.status, "creative_approved")
  assert.equal(campaign.updatedAt, now)
  assert.equal((campaign.mailPieceVersions ?? []).length, 1)
  assert.equal(getCurrentMailPiece(campaign), campaign.mailPiece)
})

test("approvedSpec remains populated and matches the MailPiece spec", () => {
  const campaign = approvableCampaign(baseSpec({ headline: "Match Me" }))
  applyCreativeApproval(campaign, "2026-09-19T21:00:00.000Z")

  assert.ok(campaign.creative.approvedSpec)
  assert.equal(campaign.creative.approvedRevisionId, campaign.mailPiece?.revisionId)
  assert.deepEqual(campaign.creative.approvedSpec, campaign.mailPiece?.spec)
  assert.notEqual(campaign.creative.approvedSpec, campaign.mailPiece?.spec)
})

test("later approval after unapprove creates version 2 without mutating version 1", () => {
  const campaign = approvableCampaign(baseSpec({ headline: "Version One" }))
  applyCreativeApproval(campaign, "2026-09-19T21:00:00.000Z")
  const first = campaign.mailPieceVersions?.[0]
  assert.ok(first)
  const frozenFirst = structuredClone(first)

  applyCreativeUnapproval(campaign, "2026-09-19T21:05:00.000Z")
  assert.equal(campaign.status, "creative_ready")
  assert.equal(getCurrentMailPiece(campaign), undefined)
  assert.equal(campaign.creative.approvedSpec, undefined)
  assert.equal(campaign.creative.approvedRevisionId, undefined)
  assert.equal((campaign.mailPieceVersions ?? []).length, 1)
  assert.deepEqual(campaign.mailPieceVersions?.[0], frozenFirst)

  campaign.creative.activeSpec = baseSpec({ headline: "Version Two" })
  applyCreativeApproval(campaign, "2026-09-19T21:10:00.000Z")

  const current = getCurrentMailPiece(campaign)
  assert.ok(current)
  assert.equal(current.version, 2)
  assert.equal(current.spec.headline, "Version Two")
  assert.equal((campaign.mailPieceVersions ?? []).length, 2)
  assert.deepEqual(campaign.mailPieceVersions?.[0], frozenFirst)
  assert.equal(campaign.mailPieceVersions?.[0].spec.headline, "Version One")
  assert.notEqual(campaign.mailPieceVersions?.[0].id, current.id)
  assert.equal(getCurrentMailPiece(campaign)?.version, 2)
})

test("unapprove returns the campaign to creative_ready and clears only the current MailPiece", () => {
  const campaign = approvableCampaign()
  applyCreativeApproval(campaign, "2026-09-19T21:00:00.000Z")
  applyCreativeUnapproval(campaign, "2026-09-19T21:06:00.000Z")

  assert.equal(campaign.status, "creative_ready")
  assert.equal(campaign.mailPiece, undefined)
  assert.equal(getCurrentMailPiece(campaign), undefined)
  assert.equal((campaign.mailPieceVersions ?? []).length, 1)
  assert.equal(campaign.mailPieceVersions?.[0].version, 1)
})

test("there is never more than one current approved MailPiece", () => {
  const campaign = approvableCampaign()
  applyCreativeApproval(campaign, "2026-09-19T21:00:00.000Z")
  applyCreativeUnapproval(campaign, "2026-09-19T21:06:00.000Z")
  campaign.creative.activeSpec = baseSpec({ headline: "Second" })
  applyCreativeApproval(campaign, "2026-09-19T21:12:00.000Z")

  const currents = [campaign.mailPiece].filter(Boolean)
  assert.equal(currents.length, 1)
  assert.equal(campaign.mailPiece?.version, 2)
  assert.equal(
    (campaign.mailPieceVersions ?? []).filter(
      (piece) => piece.id === campaign.mailPiece?.id
    ).length,
    1
  )
})

test("legacy campaigns without MailPiece remain loadable", () => {
  const campaign = approvableCampaign()
  delete campaign.mailPiece
  delete campaign.mailPieceVersions
  campaign.creative.approvedSpec = baseSpec()
  campaign.creative.approvedRevisionId = "rev-1"
  campaign.status = "creative_approved"

  assert.equal(getCurrentMailPiece(campaign), undefined)
  assert.equal(campaign.mailPieceVersions, undefined)
  assert.ok(campaign.creative.approvedSpec)
  assert.equal(campaign.status, "creative_approved")
})

test("MailPiece does not introduce physical geometry or vendor-specific fields", () => {
  const campaign = approvableCampaign()
  applyCreativeApproval(campaign, "2026-09-19T21:00:00.000Z")
  const piece = campaign.mailPiece
  assert.ok(piece)

  assert.deepEqual(Object.keys(piece).sort(), [...MAIL_PIECE_KEYS].sort())
  assert.equal("trimSizeInches" in piece, false)
  assert.equal("bleed" in piece, false)
  assert.equal("safeArea" in piece, false)
  assert.equal("dpi" in piece, false)
  assert.equal("colorSpace" in piece, false)
  assert.equal("documentClass" in piece, false)
  assert.equal("click2mail" in piece, false)
  const serialized = JSON.stringify(piece)
  assert.doesNotMatch(serialized, /click2mail/i)
  assert.doesNotMatch(serialized, /bleed/i)
  assert.doesNotMatch(serialized, /trimSize/i)
})
