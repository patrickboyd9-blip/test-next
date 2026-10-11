import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import { progressStepsForEntry } from "@/lib/campaign-creator/campaign-status"
import { createCampaignRepository } from "@/lib/campaign-creator/repository"
import { createEmptyCampaignCreative, type Campaign } from "@/lib/campaign-creator/types"
import { createFileDocumentStore } from "@/lib/storage/document-store"

import { applyUploadedDesignApproval } from "./approval"
import { applyLeaveUploadPath, applyUploadPathStart, parseUploadPathBasics } from "./upload-path"

const basics = {
  campaignName: "Spring postcard",
  businessName: "Northwind HVAC",
  street: "100 Main St",
  city: "Austin",
  state: "tx",
  postalCode: "78701",
}

test("the upload path skips the strategy conversation and still approves", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-upload-path-"))
  try {
    const repository = createCampaignRepository(createFileDocumentStore(directory))
    const created = await repository.createCampaign("owner@example.com")
    assert.equal(created.status, "draft")
    assert.equal(created.transcript.length, 0)

    const started = await repository.beginUploadPath(created.id, basics)
    assert.equal(started.entry, "upload")
    assert.equal(started.designSource, "upload")
    assert.equal(started.status, "strategy_confirmed")
    assert.equal(started.readyForBriefReview, false)
    assert.equal(started.transcript.length, 0)
    assert.equal(started.name, "Spring postcard")
    assert.equal(started.mailPieceSpec?.selectedCatalogId, "postcard_5x8")
    assert.equal(started.brief.businessInfo?.name, "Northwind HVAC")
    assert.equal(started.brief.businessInfo?.state, "TX")
    assert.equal(started.brief.businessInfo?.postalCode, "78701")
    assert.equal(started.creative.directions.length, 0)

    started.uploadedDesign = {
      front: { fileName: "front.png", mediaType: "image/png", byteLength: 10, key: "front.png" },
      back: { fileName: "back.png", mediaType: "image/png", byteLength: 10, key: "back.png" },
      issues: [],
    }
    applyUploadedDesignApproval(started, "2026-10-11T00:00:00.000Z", "print.pdf")
    assert.equal(started.status, "creative_approved")
    assert.equal(started.uploadedDesign?.front?.key, "front.png")
    assert.equal(started.uploadedDesign?.printFileKey, "print.pdf")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("a draft cannot upload without the return address", () => {
  const campaign = draft()
  assert.throws(
    () => applyUploadPathStart(campaign, { campaignName: "Spring", businessName: "Northwind HVAC" }, now),
    /return street address/
  )
  assert.equal(campaign.status, "draft")
  assert.equal(campaign.designSource, undefined)
  assert.equal(campaign.entry, undefined)
})

test("leaving the upload path returns to the first screen", () => {
  const campaign = draft()
  applyUploadPathStart(campaign, basics, now)
  applyLeaveUploadPath(campaign, now)
  assert.equal(campaign.status, "draft")
  assert.equal(campaign.entry, undefined)
  assert.equal(campaign.designSource, undefined)
  assert.equal(campaign.mailPieceSpec, undefined)
  assert.equal(campaign.name, "Spring postcard")
})

test("upload progress skips strategy and keeps audience, quantity, and launch", () => {
  assert.deepEqual(
    progressStepsForEntry("upload").map((step) => step.label),
    ["Design", "Audience", "Quantity", "Launch"]
  )
  assert.equal(progressStepsForEntry(undefined)[0]?.label, "Strategy")
})

test("the short form accepts a ZIP+4 and a two-letter state", () => {
  const parsed = parseUploadPathBasics({ ...basics, state: "tx", postalCode: "78701-1234" })
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal(parsed.value.state, "TX")
    assert.equal(parsed.value.postalCode, "78701-1234")
  }
})

function draft(): Campaign {
  return {
    id: "camp",
    ownerId: "owner@example.com",
    status: "draft",
    brief: {},
    creative: createEmptyCampaignCreative(),
    transcript: [],
    readyForBriefReview: false,
    createdAt: now,
    updatedAt: now,
  }
}

const now = "2026-10-11T00:00:00.000Z"
