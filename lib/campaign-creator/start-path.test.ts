import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import { progressStepsForEntry } from "./campaign-status"
import { applyStrategyConfirmation } from "./mail-piece"
import { createCampaignRepository } from "./repository"
import {
  applyAiDesignOnStrategyConfirm,
  applyAiGenerationStart,
  applyAiStart,
  creativeSurfaceForCampaign,
  nextStepForStartPath,
} from "./start-path"
import { createEmptyCampaignCreative, type Campaign } from "./types"
import { createFileDocumentStore } from "@/lib/storage/document-store"

const now = "2026-10-14T00:00:00.000Z"

test("each start path has one next step, and a missing path uses AI directions", () => {
  assert.equal(nextStepForStartPath("ai"), "directions")
  assert.equal(nextStepForStartPath("upload"), "upload")
  assert.equal(nextStepForStartPath("template"), "template")
  assert.equal(nextStepForStartPath("team"), "team-request")
  assert.equal(nextStepForStartPath(undefined), "directions")
})

test("the creative step follows the stored path and never offers the old chooser", () => {
  assert.equal(creativeSurfaceForCampaign({ entry: "ai" }), "directions")
  assert.equal(creativeSurfaceForCampaign({}), "directions")
  assert.equal(
    creativeSurfaceForCampaign({ entry: "upload", designSource: "upload" }),
    "upload"
  )
  assert.equal(creativeSurfaceForCampaign({ designSource: "upload" }), "upload")
  assert.equal(
    creativeSurfaceForCampaign({ entry: "template", designSource: "studio" }),
    "template"
  )
  assert.equal(progressStepsForEntry("ai")[0]?.label, "Strategy")
  assert.equal(progressStepsForEntry(undefined)[0]?.label, "Strategy")
})

test("confirming strategy on AI, or with no stored path, opens Studio", () => {
  const fresh = draft()
  applyStrategyConfirmation(fresh, now)
  assert.equal(fresh.entry, "ai")
  assert.equal(fresh.designSource, "studio")
  assert.equal(fresh.status, "strategy_confirmed")

  const alreadyAi = draft()
  alreadyAi.entry = "ai"
  applyAiDesignOnStrategyConfirm(alreadyAi)
  assert.equal(alreadyAi.entry, "ai")
  assert.equal(alreadyAi.designSource, "studio")

  const upload = draft()
  upload.entry = "upload"
  upload.designSource = "upload"
  applyAiDesignOnStrategyConfirm(upload)
  assert.equal(upload.entry, "upload")
  assert.equal(upload.designSource, "upload")

  const template = draft()
  template.entry = "template"
  template.designSource = "studio"
  applyAiDesignOnStrategyConfirm(template)
  assert.equal(template.entry, "template")
  assert.equal(template.designSource, "studio")
})

test("the first strategy message stores the AI path and does not overwrite another path", () => {
  const fresh = draft()
  applyAiStart(fresh, now)
  assert.equal(fresh.entry, "ai")

  const upload = draft()
  upload.entry = "upload"
  upload.designSource = "upload"
  applyAiStart(upload, now)
  assert.equal(upload.entry, "upload")

  const confirmed = draft()
  confirmed.status = "strategy_confirmed"
  applyAiStart(confirmed, now)
  assert.equal(confirmed.entry, undefined)
})

test("generation on a campaign with no stored path records AI instead of waiting for a chooser", () => {
  const legacy = draft()
  legacy.status = "strategy_confirmed"
  assert.equal(applyAiGenerationStart(legacy), true)
  assert.equal(legacy.entry, "ai")
  assert.equal(legacy.designSource, "studio")
  assert.equal(legacy.status, "generating_creative")
  assert.equal(applyAiGenerationStart(legacy), false)

  const upload = draft()
  upload.entry = "upload"
  upload.designSource = "upload"
  upload.status = "strategy_confirmed"
  assert.equal(applyAiGenerationStart(upload), false)
  assert.equal(upload.designSource, "upload")

  const template = draft()
  template.entry = "template"
  template.designSource = "studio"
  template.status = "creative_ready"
  template.creative.directions = [
    {
      id: "dir-1",
      name: "Roofing inspection",
      rationale: "A proven mailer.",
      spec: { headline: "Free inspection" },
      createdAt: now,
    },
  ]
  assert.equal(applyAiGenerationStart(template), false)
  assert.equal(template.entry, "template")
  assert.equal(template.status, "creative_ready")
})

test("a saved AI campaign confirms into Studio, and an older campaign defaults there too", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-start-path-"))
  try {
    const store = createFileDocumentStore(directory)
    const repository = createCampaignRepository(store)
    const created = await repository.createCampaign("owner@example.com")

    const talking = await repository.appendMessage(created.id, {
      id: "msg-1",
      role: "customer",
      content: "I want more HVAC appointments from homeowners nearby.",
      createdAt: now,
    })
    assert.equal(talking.entry, "ai")
    assert.equal(talking.designSource, undefined)

    const confirmed = await repository.confirmStrategy(created.id)
    assert.equal(confirmed.entry, "ai")
    assert.equal(confirmed.designSource, "studio")
    assert.equal(confirmed.status, "strategy_confirmed")

    const older = await repository.createCampaign("owner@example.com")
    await store.put(older.id, {
      ...older,
      status: "strategy_confirmed",
      brief: { goal: "Book more HVAC appointments" },
      mailPieceSpec: confirmed.mailPieceSpec,
      updatedAt: now,
    })
    const loaded = await repository.getCampaign(older.id)
    assert.ok(loaded)
    assert.equal(loaded.entry, undefined)
    assert.equal(loaded.designSource, undefined)

    const generating = await repository.markGeneratingCreative(older.id)
    assert.equal(generating.entry, "ai")
    assert.equal(generating.designSource, "studio")
    assert.equal(generating.status, "generating_creative")
  } finally {
    await rm(directory, { recursive: true, force: true })
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
    readyForBriefReview: true,
    createdAt: now,
    updatedAt: now,
  }
}
