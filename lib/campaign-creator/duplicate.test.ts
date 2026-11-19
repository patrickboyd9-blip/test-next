import assert from "node:assert/strict"
import { test } from "node:test"

import { createEmptyCampaignCreative, type Campaign } from "./types"
import { duplicateCampaign } from "./duplicate"

test("a copy keeps one design and starts over on approval, payment, and mail", () => {
  const source = campaign()
  const copy = duplicateCampaign(source, "2026-11-18T00:00:00.000Z", "copy-1")
  assert.equal(copy.id, "copy-1")
  assert.equal(copy.name, "Spring tune-up (copy)")
  assert.equal(copy.status, "creative_ready")
  assert.equal(copy.ownerId, source.ownerId)
  assert.equal(copy.brief.offer, "$50 off")
  assert.equal(copy.brief.audience?.description, "Homeowners near the shop")
  assert.equal(copy.mailPieceSpec?.selectedCatalogId, "postcard_5x8")
  assert.equal(copy.creative.directions.length, 1)
  assert.equal(copy.creative.directions[0]?.id, "dir-b")
  assert.equal(copy.creative.approvedRevisionId, undefined)
  assert.equal(copy.creative.approvedSpec, undefined)
  assert.equal(copy.mailPiece, undefined)
  assert.equal(copy.mailOrder, undefined)
  assert.equal(copy.uploadedDesign?.approvedAt, undefined)
  assert.equal(copy.uploadedDesign?.printFileKey, undefined)
  assert.notEqual(copy.id, source.id)
  assert.equal(source.status, "launched")
  assert.equal(source.creative.directions.length, 2)
})

test("the rename replaces the copy suffix and still drops mail status", () => {
  const copy = duplicateCampaign(campaign(), "2026-11-18T00:00:00.000Z", "copy-2", "  Fall check  ")
  assert.equal(copy.name, "Fall check")
  assert.equal(copy.mailOrder, undefined)
  assert.equal(copy.status, "creative_ready")
})

function direction(id: string, headline: string, recommended: boolean, now: string): Campaign["creative"]["directions"][number] {
  return {
    id,
    name: headline,
    rationale: "One offer.",
    designedToDrive: "A call",
    tags: [],
    spec: { headline },
    recommended,
    createdAt: now,
  }
}

function campaign(): Campaign {
  const now = "2026-11-01T00:00:00.000Z"
  const creative = createEmptyCampaignCreative()
  creative.directions = [
    direction("dir-a", "A", false, now),
    direction("dir-b", "B", true, now),
  ]
  creative.selectedDirectionId = "dir-b"
  creative.approvedRevisionId = "rev-1"
  creative.approvedSpec = { headline: "Approved" }
  return {
    id: "camp-1",
    ownerId: "ada@example.com",
    name: "Spring tune-up",
    status: "launched",
    brief: { offer: "$50 off", audience: { description: "Homeowners near the shop" } },
    creative,
    transcript: [{ id: "m1", role: "customer", content: "hi", createdAt: now }],
    uploadedDesign: {
      front: { fileName: "front.png", mediaType: "image/png", byteLength: 10, key: "front.png" },
      issues: [],
      approvedAt: now,
      printFileKey: "print.pdf",
    },
    mailPieceSpec: {
      recommendedCatalogId: "postcard_5x8",
      recommendedCatalogVersion: 1,
      selectedCatalogId: "postcard_5x8",
      selectedCatalogVersion: 1,
      customerOverride: false,
      decidedAt: now,
      decidedBy: "ada@example.com",
      addressFaceAuthorship: "fulfillment",
    },
    mailPiece: {
      id: "piece",
      version: 1,
      approvedAt: now,
      directionId: "dir-b",
      revisionId: "rev-1",
      catalogId: "postcard_5x8",
      catalogVersion: 1,
      spec: { headline: "Approved" },
    },
    mailOrder: {
      id: "order",
      mode: "test",
      environment: "stage",
      pieceCount: 10,
      estimatedCostLabel: "Placeholder",
      artwork: "type-plate",
      submitted: true,
      product: {
        documentClass: "Postcard",
        layout: "Double Sided Postcard",
        mailClass: "First Class",
        paperType: "White",
        printOption: "Color",
        color: "Full",
        productionTime: "Next Day",
      },
      createdAt: now,
      updatedAt: now,
    },
    readyForBriefReview: true,
    createdAt: now,
    updatedAt: now,
  }
}
