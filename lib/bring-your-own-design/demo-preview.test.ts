import assert from "node:assert/strict"
import { test } from "node:test"

import { createCampaignRepository } from "@/lib/campaign-creator/repository"
import { createMemoryDocumentStore } from "@/lib/storage/document-store"

import { openUploadedDesign, resolveUploadedDesignStore } from "./store"

test("preview demo keeps an uploaded PNG in memory and reads it back", async () => {
  const previousVercel = process.env.VERCEL_ENV
  const previousDemo = process.env.DEMO_MODE
  process.env.VERCEL_ENV = "preview"
  delete process.env.DEMO_MODE
  try {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 9])
    await resolveUploadedDesignStore().put("preview-camp", "front.png", png, "image/png")
    const opened = await openUploadedDesign("preview-camp", "front.png")
    assert.ok(opened)
    assert.equal(opened.bytes.length, png.length)
    assert.equal(opened.bytes[0], 137)
  } finally {
    restore("VERCEL_ENV", previousVercel)
    restore("DEMO_MODE", previousDemo)
  }
})

test("every preview server can open the same demo campaign", async () => {
  const previousVercel = process.env.VERCEL_ENV
  process.env.VERCEL_ENV = "preview"
  try {
    const repository = createCampaignRepository(createMemoryDocumentStore())
    const opened = await repository.getCampaign("preview-demo")
    assert.equal(opened?.id, "preview-demo")
    assert.equal(opened?.ownerId, "preview-demo@example.com")
  } finally {
    restore("VERCEL_ENV", previousVercel)
  }
})

function restore(name: "VERCEL_ENV" | "DEMO_MODE", value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}
