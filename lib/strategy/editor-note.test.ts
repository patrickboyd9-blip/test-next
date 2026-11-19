import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { createEmptyCampaignCreative, type Campaign } from "@/lib/campaign-creator/types"

import { campaignEditorNote } from "./editor-note"
import { readLibraryFiles } from "./library"
import { REVIEWED_SOURCES } from "./sources"

function draft(): Campaign {
  const now = new Date().toISOString()
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

test("a missing reviewed file does not throw and leaves that note empty", () => {
  const files = readLibraryFiles(() => {
    throw new Error("ENOENT: lib/design-intelligence/ad-psych/campaign-library.md")
  })
  for (const source of REVIEWED_SOURCES) {
    assert.equal(files[source.file], "")
  }
  const note = campaignEditorNote(draft(), () => files)
  assert.match(note, /limited/)
  assert.doesNotMatch(note, /server error/i)
})

test("the campaign function is told to ship the reviewed notes", () => {
  const config = readFileSync("next.config.ts", "utf8")
  assert.match(config, /\/app\/campaigns\/\[id\]/)
  assert.match(config, /ad-psych\/\*\*\/\*\.md/)
  assert.match(config, /\/app\/campaigns\/\[id\]\/guidance/)
})
