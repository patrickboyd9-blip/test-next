import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import { PDFDocument } from "pdf-lib"

import { createEmptyCampaignCreative, type Campaign } from "../campaign-creator/types"
import { encodeSolidPng } from "../print-spec/raster"
import { buildPostcard5x8PrintSpec } from "../print-spec/postcard-5x8-print-spec"
import { applyUploadedDesignApproval, clearUploadedDesignApproval } from "./approval"
import { renderUploadedPostcardPdf } from "./render-uploaded-pdf"
import { createFileUploadedDesignStore } from "./store-file"

test("approving an upload freezes a mail piece and a later edit clears that approval", () => {
  const campaign = uploadCampaign()
  const piece = applyUploadedDesignApproval(campaign, "2026-10-11T00:00:00.000Z", "print.pdf")
  assert.equal(campaign.status, "creative_approved")
  assert.equal(campaign.mailPiece?.id, piece.id)
  assert.equal(campaign.mailPiece?.catalogId, "postcard_5x8")
  assert.equal(campaign.uploadedDesign?.printFileKey, "print.pdf")
  assert.equal(campaign.uploadedDesign?.approvedAt, "2026-10-11T00:00:00.000Z")

  clearUploadedDesignApproval(campaign)
  assert.equal(campaign.uploadedDesign?.approvedAt, undefined)
  assert.equal(campaign.uploadedDesign?.printFileKey, undefined)
  assert.equal(campaign.uploadedDesign?.front?.key, "front.png")
})

test("approval refuses a design that still has a blocking problem", () => {
  const campaign = uploadCampaign()
  campaign.uploadedDesign?.issues.push({
    severity: "error",
    code: "page_size",
    face: "front",
    message: "Wrong size",
  })
  assert.throws(() => applyUploadedDesignApproval(campaign, "2026-10-11T00:00:00.000Z", "print.pdf"), /Fix the file/)
})

test("the print file is two pages at the 5x8 artwork size", async () => {
  const spec = buildPostcard5x8PrintSpec()
  const png = encodeSolidPng(32, 32, [20, 40, 80])
  const pdf = await renderUploadedPostcardPdf({
    geometry: spec,
    front: { bytes: png, mediaType: "image/png" },
    back: { bytes: png, mediaType: "image/png" },
  })
  const doc = await PDFDocument.load(pdf)
  assert.equal(doc.getPageCount(), 2)
  const media = doc.getPage(0).getMediaBox()
  assert.equal(media.width, 612)
  assert.equal(media.height, 396)
  const back = doc.getPage(1).getMediaBox()
  assert.equal(back.width, 612)
  assert.equal(back.height, 396)
})

test("uploaded bytes round-trip through the local store", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-upload-"))
  try {
    const store = createFileUploadedDesignStore(directory)
    await store.put("camp", "front.png", Buffer.from("front-bytes"), "image/png")
    const opened = await store.get("camp", "front.png")
    assert.equal(opened?.bytes.toString(), "front-bytes")
    assert.equal(await store.get("camp", "../front.png"), null)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

function uploadCampaign(): Campaign {
  const now = "2026-10-11T00:00:00.000Z"
  return {
    id: "camp",
    ownerId: "owner",
    status: "strategy_confirmed",
    brief: { businessInfo: { name: "Northwind" } },
    creative: createEmptyCampaignCreative(),
    transcript: [],
    designSource: "upload",
    uploadedDesign: {
      front: { fileName: "front.png", mediaType: "image/png", byteLength: 10, key: "front.png" },
      back: { fileName: "back.png", mediaType: "image/png", byteLength: 10, key: "back.png" },
      issues: [],
      checkedAt: now,
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
    readyForBriefReview: true,
    createdAt: now,
    updatedAt: now,
  }
}
