import assert from "node:assert/strict"
import test from "node:test"

import { encodeSolidPng } from "@/lib/print-spec/raster"
import { createMemoryDocumentStore } from "@/lib/storage/document-store"
import { createCampaignRepository } from "@/lib/campaign-creator/repository"
import type { Campaign, UploadedDesign } from "@/lib/campaign-creator/types"

import { acceptFinishedProof } from "./accept-finished-proof"
import { toPrintJpeg } from "./print-jpeg"
import { PHOTO_SAVE_FAILED } from "./messages"

test("accepting a word-change proof opens the campaign proof with that front", async () => {
  const repository = createCampaignRepository(createMemoryDocumentStore())
  const jpeg = await toPrintJpeg(encodeSolidPng(16, 10, [20, 30, 40]))
  const result = await acceptFinishedProof({
    userId: "owner",
    imageBase64: jpeg.toString("base64"),
    businessName: "Harbor Roofing",
    headline: "Free roof check",
    phone: "(619) 555-0148",
    website: "harbor.example",
    repository,
    saveFace: async (campaign: Campaign, bytes: Buffer): Promise<UploadedDesign> => ({
      front: {
        fileName: "proof.jpg",
        mediaType: "image/jpeg",
        byteLength: bytes.length,
        key: "front.jpg",
      },
      issues: [],
      checkedAt: campaign.updatedAt,
    }),
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  const campaign = await repository.getCampaign(result.campaignId)
  assert.ok(campaign)
  assert.equal(campaign?.entry, "upload")
  assert.equal(campaign?.designSource, "upload")
  assert.equal(campaign?.status, "strategy_confirmed")
  assert.equal(campaign?.brief.businessInfo?.name, "Harbor Roofing")
  assert.equal(campaign?.brief.offer, "Free roof check")
  assert.equal(campaign?.uploadedDesign?.front?.key, "front.jpg")
  assert.equal(campaign?.postcardSize, "5x8")
})

test("accepting a gallery design keeps the campaign name and the postcard size", async () => {
  const repository = createCampaignRepository(createMemoryDocumentStore())
  const jpeg = await toPrintJpeg(encodeSolidPng(16, 10, [20, 30, 40]))
  const result = await acceptFinishedProof({
    userId: "owner",
    imageBase64: jpeg.toString("base64"),
    businessName: "Harbor Roofing",
    headline: "Free roof inspection · Call to book a visit",
    phone: "(619) 555-0148",
    campaignName: "Spring tune-up",
    size: "6x9",
    repository,
    saveFace: async (campaign: Campaign, bytes: Buffer): Promise<UploadedDesign> => ({
      front: {
        fileName: "proof.jpg",
        mediaType: "image/jpeg",
        byteLength: bytes.length,
        key: "front.jpg",
      },
      issues: [],
      checkedAt: campaign.updatedAt,
    }),
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  const campaign = await repository.getCampaign(result.campaignId)
  assert.equal(campaign?.name, "Spring tune-up")
  assert.equal(campaign?.postcardSize, "6x9")
  assert.equal(campaign?.brief.offer, "Free roof inspection · Call to book a visit")
})

test("a proof that is not a jpeg is refused", async () => {
  const repository = createCampaignRepository(createMemoryDocumentStore())
  const result = await acceptFinishedProof({
    userId: "owner",
    imageBase64: "not-a-jpeg",
    businessName: "Harbor Roofing",
    headline: "Free roof check",
    phone: "(619) 555-0148",
    repository,
  })
  assert.deepEqual(result, { ok: false, message: PHOTO_SAVE_FAILED })
  assert.equal((await repository.listForOwner("owner")).length, 0)
})
