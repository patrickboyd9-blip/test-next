import assert from "node:assert/strict"
import { test } from "node:test"

import { applyStrategyConfirmation } from "./mail-piece"
import type { Campaign, MailPieceSpec } from "./types"
import { createEmptyCampaignCreative } from "./types"

function draftCampaign(): Campaign {
  return {
    id: "campaign-1",
    ownerId: "owner@example.com",
    status: "draft",
    brief: {},
    creative: createEmptyCampaignCreative(),
    transcript: [],
    readyForBriefReview: true,
    createdAt: "2026-09-19T19:00:00.000Z",
    updatedAt: "2026-09-19T19:00:00.000Z",
  }
}

function legacyMailPieceSpecWithoutAuthorship() {
  return {
    recommendedCatalogId: "postcard_5x8" as const,
    recommendedCatalogVersion: 1 as const,
    selectedCatalogId: "postcard_5x8" as const,
    selectedCatalogVersion: 1 as const,
    customerOverride: false,
    decidedAt: "2026-09-19T20:00:00.000Z",
    decidedBy: "owner@example.com",
  }
}

test("newly confirmed strategy creates MailPieceSpec with fulfillment authorship", () => {
  const campaign = draftCampaign()
  const now = "2026-09-20T16:00:00.000Z"

  applyStrategyConfirmation(campaign, now)

  const spec = campaign.mailPieceSpec
  assert.ok(spec)
  assert.equal(spec.addressFaceAuthorship, "fulfillment")
  assert.equal(spec.recommendedCatalogId, "postcard_5x8")
  assert.equal(spec.recommendedCatalogVersion, 1)
  assert.equal(spec.selectedCatalogId, "postcard_5x8")
  assert.equal(spec.selectedCatalogVersion, 1)
  assert.equal(spec.customerOverride, false)
  assert.equal(spec.decidedAt, now)
  assert.equal(spec.decidedBy, "owner@example.com")
  assert.equal(campaign.status, "strategy_confirmed")
  assert.equal(campaign.updatedAt, now)
})

test("existing MailPieceSpec is not rewritten when strategy is confirmed again", () => {
  const existing: MailPieceSpec = {
    recommendedCatalogId: "postcard_5x8",
    recommendedCatalogVersion: 1,
    selectedCatalogId: "postcard_5x8",
    selectedCatalogVersion: 1,
    customerOverride: true,
    decidedAt: "2026-09-19T20:00:00.000Z",
    decidedBy: "owner@example.com",
    addressFaceAuthorship: "customer",
  }
  const campaign = draftCampaign()
  campaign.mailPieceSpec = existing
  campaign.status = "strategy_confirmed"
  const frozen = structuredClone(existing)

  applyStrategyConfirmation(campaign, "2026-09-20T16:00:00.000Z")

  assert.equal(campaign.mailPieceSpec, existing)
  assert.deepEqual(campaign.mailPieceSpec, frozen)
  assert.equal(campaign.mailPieceSpec.decidedAt, "2026-09-19T20:00:00.000Z")
  assert.equal(campaign.mailPieceSpec.customerOverride, true)
  assert.equal(campaign.mailPieceSpec.addressFaceAuthorship, "customer")
  assert.equal(campaign.status, "strategy_confirmed")
})

test("legacy MailPieceSpec records without authorship remain loadable and are not backfilled", () => {
  const persisted = JSON.stringify({
    ...draftCampaign(),
    status: "strategy_confirmed",
    mailPieceSpec: legacyMailPieceSpecWithoutAuthorship(),
  })

  const loaded = JSON.parse(persisted) as Campaign
  assert.ok(loaded.mailPieceSpec)
  assert.equal("addressFaceAuthorship" in loaded.mailPieceSpec, false)
  assert.equal(loaded.mailPieceSpec.selectedCatalogId, "postcard_5x8")
  assert.equal(loaded.mailPieceSpec.selectedCatalogVersion, 1)
  assert.equal(loaded.mailPieceSpec.recommendedCatalogId, "postcard_5x8")
  assert.equal(loaded.mailPieceSpec.decidedBy, "owner@example.com")

  applyStrategyConfirmation(loaded, "2026-09-20T16:00:00.000Z")

  assert.equal("addressFaceAuthorship" in (loaded.mailPieceSpec ?? {}), false)
  assert.equal(loaded.mailPieceSpec?.decidedAt, "2026-09-19T20:00:00.000Z")
  assert.equal(loaded.status, "strategy_confirmed")
})
