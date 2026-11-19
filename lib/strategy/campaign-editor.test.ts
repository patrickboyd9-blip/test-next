import assert from "node:assert/strict"
import { test } from "node:test"

import { createEmptyCampaignCreative, type Campaign } from "@/lib/campaign-creator/types"

import { guidanceNote, loadCampaignEditor } from "./campaign-editor"
import { readLibraryFiles } from "./library"
import { REVIEWED_SOURCES } from "./sources"

test("a missing reviewed file does not throw, and the preview editor still opens", async () => {
  const files = readLibraryFiles(() => {
    const error = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException
    error.code = "ENOENT"
    throw error
  })
  for (const source of REVIEWED_SOURCES) {
    assert.equal(files[source.file], "")
  }

  const demo = previewDemo()
  const opened = await loadCampaignEditor("preview-demo", async () => demo, () => {
    throw new Error("ENOENT: campaign library missing from the function bundle")
  })
  assert.equal(opened.ok, true)
  if (!opened.ok) return
  assert.equal(opened.campaign.id, "preview-demo")
  assert.match(opened.note, /limited/)
  assert.equal(guidanceNote(demo, () => files), opened.note)
})

test("a store failure is a calm unavailable state, not a thrown server error", async () => {
  const opened = await loadCampaignEditor("preview-demo", async () => {
    throw new Error("connect ECONNREFUSED")
  })
  assert.deepEqual(opened, { ok: false, reason: "unavailable" })
  const missing = await loadCampaignEditor("missing", async () => null)
  assert.deepEqual(missing, { ok: false, reason: "missing" })
})

function previewDemo(): Campaign {
  const now = "2026-11-18T00:00:00.000Z"
  return {
    id: "preview-demo",
    ownerId: "preview-demo@example.com",
    status: "draft",
    brief: {},
    creative: createEmptyCampaignCreative(),
    transcript: [],
    readyForBriefReview: false,
    createdAt: now,
    updatedAt: now,
  }
}
