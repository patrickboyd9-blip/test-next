import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import { progressStepsForEntry } from "@/lib/campaign-creator/campaign-status"
import { applyCreativeApproval } from "@/lib/campaign-creator/mail-piece"
import { createCampaignRepository } from "@/lib/campaign-creator/repository"
import { createEmptyCampaignCreative, type Campaign } from "@/lib/campaign-creator/types"
import { createFileDocumentStore } from "@/lib/storage/document-store"

import { applyTemplateStart } from "./apply"
import { getMailTemplate } from "./query"

const now = "2026-10-12T00:00:00.000Z"

test("picking a template loads it into Studio on the 5x8 mail piece", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-template-"))
  try {
    const repository = createCampaignRepository(createFileDocumentStore(directory))
    const created = await repository.createCampaign("owner@example.com")
    const started = await repository.beginTemplatePath(created.id, "roofing-free-inspection")

    assert.equal(started.entry, "template")
    assert.equal(started.designSource, "studio")
    assert.equal(started.status, "creative_ready")
    assert.equal(started.transcript.length, 0)
    assert.equal(started.mailPieceSpec?.selectedCatalogId, "postcard_5x8")
    assert.equal(started.mailPieceSpec?.selectedCatalogVersion, 1)
    assert.equal(started.mailPieceSpec?.recommendedCatalogId, "postcard_5x8")
    assert.equal(started.brief.businessInfo?.name, "Harbor Roofing")
    assert.equal(started.brief.offer, "Free roof inspection")
    assert.equal(started.creative.directions.length, 1)
    assert.equal(started.creative.directions[0]?.spec.headline, "Free Roof Inspection")
    assert.equal(started.creative.selectedDirectionId, started.creative.directions[0]?.id)
    assert.equal(started.creative.activeSpec?.phone, "(619) 555-0148")
    assert.equal(started.creative.revisions.length, 1)
    assert.equal(started.creative.revisions[0]?.version, 1)

    const reloaded = await repository.getCampaign(created.id)
    assert.equal(reloaded?.creative.activeSpec?.headline, "Free Roof Inspection")

    applyCreativeApproval(started, now)
    assert.equal(started.status, "creative_approved")
    assert.equal(started.mailPiece?.catalogId, "postcard_5x8")
    assert.equal(started.mailPiece?.catalogVersion, 1)
    assert.equal(started.mailPiece?.spec.headline, "Free Roof Inspection")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("a missing template and a campaign already in progress are refused", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-template-miss-"))
  try {
    const repository = createCampaignRepository(createFileDocumentStore(directory))
    const created = await repository.createCampaign("owner@example.com")
    await assert.rejects(
      () => repository.beginTemplatePath(created.id, "not-a-template"),
      /no longer available/
    )
    const template = getMailTemplate("dental-first-visit")
    assert.ok(template)
    const campaign = draft()
    campaign.status = "strategy_confirmed"
    assert.throws(() => applyTemplateStart(campaign, template, now), /first screen/)
    assert.equal(campaign.creative.directions.length, 0)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("template progress skips strategy and keeps the rest of the mail flow", () => {
  assert.deepEqual(
    progressStepsForEntry("template").map((step) => step.label),
    ["Design", "Audience", "Quantity", "Launch"]
  )
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
