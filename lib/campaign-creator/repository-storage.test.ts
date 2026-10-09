import assert from "node:assert/strict"
import { mkdtemp, rm } from "fs/promises"
import os from "os"
import path from "path"
import { test } from "node:test"

import { createCampaignRepository } from "./repository"
import {
  createFileDocumentStore,
  createPostgresDocumentStore,
} from "../storage/document-store"
import { MemorySql } from "../storage/memory-sql"
import type { DocumentStore } from "../storage/document-store"

async function roundTrip(store: DocumentStore, readerStore: DocumentStore) {
  const writer = createCampaignRepository(store)
  const reader = createCampaignRepository(readerStore)

  assert.equal(await reader.getCampaign("missing"), null)

  const created = await writer.createCampaign("owner@example.com")
  assert.equal(created.ownerId, "owner@example.com")
  assert.equal(created.status, "draft")

  const loaded = await reader.getCampaign(created.id)
  assert.equal(loaded?.id, created.id)
  assert.equal(loaded?.brief.offer, undefined)

  const updated = await writer.updateBrief(created.id, { offer: "Free inspection" })
  assert.equal(updated.brief.offer, "Free inspection")

  const again = await reader.getCampaign(created.id)
  assert.equal(again?.brief.offer, "Free inspection")
  assert.equal(again?.ownerId, "owner@example.com")
}

test("campaigns persist in local files across two repository instances", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mm-campaigns-"))
  try {
    await roundTrip(createFileDocumentStore(dir), createFileDocumentStore(dir))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("campaigns persist in postgres across two repository instances", async () => {
  const sql = new MemorySql()
  await roundTrip(
    createPostgresDocumentStore("campaigns", sql),
    createPostgresDocumentStore("campaigns", sql)
  )
  assert.match(sql.statements.join("\n"), /INSERT INTO campaigns/)
})
