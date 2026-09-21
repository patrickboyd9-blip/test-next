import assert from "node:assert/strict"
import { test } from "node:test"

import { deriveProductionDocument } from "./production-document"
import type {
  AddressFaceAuthorship,
  Campaign,
  CreativeSpec,
  MailPiece,
  MailPieceSpec,
  ProductionDocument,
} from "./types"
import { createEmptyCampaignCreative } from "./types"

const PRODUCTION_DOCUMENT_KEYS = [
  "id",
  "mailPieceId",
  "mailPieceVersion",
  "catalogId",
  "catalogVersion",
  "faces",
  "derivedAt",
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

function mailPieceSpec(
  overrides: Partial<MailPieceSpec> = {}
): MailPieceSpec {
  return {
    recommendedCatalogId: "postcard_5x8",
    recommendedCatalogVersion: 1,
    selectedCatalogId: "postcard_5x8",
    selectedCatalogVersion: 1,
    customerOverride: false,
    decidedAt: "2026-09-19T20:00:00.000Z",
    decidedBy: "owner@example.com",
    addressFaceAuthorship: "fulfillment",
    ...overrides,
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

function derivableCampaign(overrides: Partial<Campaign> = {}): Campaign {
  const piece = mailPiece()
  return {
    id: "campaign-1",
    ownerId: "owner@example.com",
    status: "creative_approved",
    brief: { offer: "Free roof inspection" },
    creative: createEmptyCampaignCreative(),
    transcript: [],
    mailPieceSpec: mailPieceSpec(),
    mailPiece: piece,
    mailPieceVersions: [piece],
    readyForBriefReview: true,
    createdAt: "2026-09-19T19:00:00.000Z",
    updatedAt: "2026-09-19T21:00:00.000Z",
    ...overrides,
  }
}

function semanticFields(document: ProductionDocument) {
  const { id: _id, ...rest } = document
  return rest
}

test("fulfillment authorship derives customer front and fulfillment back", () => {
  const campaign = derivableCampaign()
  const now = "2026-09-20T18:00:00.000Z"

  const document = deriveProductionDocument(campaign, now)

  assert.deepEqual(document.faces, { front: "customer", back: "fulfillment" })
})

test("customer authorship derives customer front and customer back", () => {
  const campaign = derivableCampaign({
    mailPieceSpec: mailPieceSpec({ addressFaceAuthorship: "customer" }),
  })
  const now = "2026-09-20T18:00:00.000Z"

  const document = deriveProductionDocument(campaign, now)

  assert.deepEqual(document.faces, { front: "customer", back: "customer" })
})

test("ProductionDocument copies current MailPiece identity and catalog identity", () => {
  const piece = mailPiece({
    id: "mail-piece-current",
    version: 2,
    catalogId: "postcard_5x8",
    catalogVersion: 1,
  })
  const campaign = derivableCampaign({
    mailPiece: piece,
    mailPieceVersions: [mailPiece({ id: "mail-piece-prior", version: 1 }), piece],
  })
  const now = "2026-09-20T18:00:00.000Z"

  const document = deriveProductionDocument(campaign, now)

  assert.equal(document.mailPieceId, "mail-piece-current")
  assert.equal(document.mailPieceVersion, 2)
  assert.equal(document.catalogId, "postcard_5x8")
  assert.equal(document.catalogVersion, 1)
  assert.equal(document.derivedAt, now)
  assert.equal(typeof document.id, "string")
  assert.ok(document.id.length > 0)
})

test("returned shape contains only ProductionDocument fields", () => {
  const campaign = derivableCampaign()
  const document = deriveProductionDocument(campaign, "2026-09-20T18:00:00.000Z")

  assert.deepEqual(Object.keys(document).sort(), [...PRODUCTION_DOCUMENT_KEYS].sort())
  assert.deepEqual(Object.keys(document.faces).sort(), ["back", "front"])
  assert.equal("addressFaceAuthorship" in document, false)
  assert.equal("version" in document, false)
  assert.equal("pages" in document, false)
  assert.equal("campaignId" in document, false)
  assert.equal("spec" in document, false)
  assert.equal("trimSizeInches" in document, false)
  assert.equal("click2mail" in document, false)
  assert.equal("status" in document, false)
})

test("derivation uses current MailPiece v2 and does not scan mailPieceVersions", () => {
  const first = mailPiece({
    id: "mail-piece-v1",
    version: 1,
    spec: baseSpec({ headline: "Version One" }),
  })
  const current = mailPiece({
    id: "mail-piece-v2",
    version: 2,
    spec: baseSpec({ headline: "Version Two" }),
  })
  const campaign = derivableCampaign({
    mailPiece: current,
    mailPieceVersions: [first, current],
  })

  const document = deriveProductionDocument(campaign, "2026-09-20T18:00:00.000Z")

  assert.equal(document.mailPieceId, "mail-piece-v2")
  assert.equal(document.mailPieceVersion, 2)
  assert.equal("spec" in document, false)
})

test("derivation does not mutate Campaign", () => {
  const campaign = derivableCampaign()
  const frozen = structuredClone(campaign)

  deriveProductionDocument(campaign, "2026-09-20T18:00:00.000Z")

  assert.deepEqual(campaign, frozen)
  assert.equal("productionDocument" in campaign, false)
})

test("same frozen inputs produce equivalent semantic fields and different ids", () => {
  const campaign = derivableCampaign()
  const now = "2026-09-20T18:00:00.000Z"

  const first = deriveProductionDocument(campaign, now)
  const second = deriveProductionDocument(campaign, now)

  assert.deepEqual(semanticFields(first), semanticFields(second))
  assert.notEqual(first.id, second.id)
})

test("missing current MailPiece is rejected", () => {
  const campaign = derivableCampaign()
  delete campaign.mailPiece

  assert.throws(
    () => deriveProductionDocument(campaign, "2026-09-20T18:00:00.000Z"),
    /current mail piece/i
  )
})

test("missing MailPieceSpec is rejected", () => {
  const campaign = derivableCampaign()
  delete campaign.mailPieceSpec

  assert.throws(
    () => deriveProductionDocument(campaign, "2026-09-20T18:00:00.000Z"),
    /mail piece spec/i
  )
})

test("legacy MailPieceSpec missing authorship is rejected", () => {
  const campaign = derivableCampaign({
    mailPieceSpec: {
      recommendedCatalogId: "postcard_5x8",
      recommendedCatalogVersion: 1,
      selectedCatalogId: "postcard_5x8",
      selectedCatalogVersion: 1,
      customerOverride: false,
      decidedAt: "2026-09-19T20:00:00.000Z",
      decidedBy: "owner@example.com",
    } as MailPieceSpec,
  })
  delete (campaign.mailPieceSpec as { addressFaceAuthorship?: AddressFaceAuthorship })
    .addressFaceAuthorship

  assert.throws(
    () => deriveProductionDocument(campaign, "2026-09-20T18:00:00.000Z"),
    /address-face authorship/i
  )
})

test("invalid addressFaceAuthorship is rejected", () => {
  const campaign = derivableCampaign({
    mailPieceSpec: mailPieceSpec({
      addressFaceAuthorship: "both" as AddressFaceAuthorship,
    }),
  })

  assert.throws(
    () => deriveProductionDocument(campaign, "2026-09-20T18:00:00.000Z"),
    /address-face authorship/i
  )
})

test("selected catalog identity mismatch is rejected", () => {
  const campaign = derivableCampaign({
    mailPieceSpec: mailPieceSpec({
      selectedCatalogVersion: 2 as unknown as MailPieceSpec["selectedCatalogVersion"],
    }),
  })

  assert.throws(
    () => deriveProductionDocument(campaign, "2026-09-20T18:00:00.000Z"),
    /catalog identity/i
  )
})

test("unresolved MailPiece catalog identity is rejected", () => {
  const unresolvedVersion = 2 as unknown as MailPiece["catalogVersion"]
  const piece = mailPiece({ catalogVersion: unresolvedVersion })
  const campaign = derivableCampaign({
    mailPiece: piece,
    mailPieceVersions: [piece],
    mailPieceSpec: mailPieceSpec({
      selectedCatalogVersion: unresolvedVersion,
    }),
  })

  assert.throws(
    () => deriveProductionDocument(campaign, "2026-09-20T18:00:00.000Z"),
    /unknown mail piece catalog version/i
  )
})
