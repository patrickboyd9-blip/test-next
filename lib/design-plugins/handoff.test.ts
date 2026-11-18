import assert from "node:assert/strict"
import { test } from "node:test"

import { GET as listCampaigns, POST as createCampaign } from "@/app/api/design-plugins/campaigns/route"
import { POST as upload } from "@/app/api/design-plugins/upload/route"
import { createCampaignRepository } from "@/lib/campaign-creator/repository"
import { createMemoryDocumentStore } from "@/lib/storage/document-store"

import { createPluginCampaign, summariesForOwner, uploadPluginDesign } from "./handoff"

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

test("a plugin lists only the signed-in customer's campaigns", () => {
  const rows = summariesForOwner(
    [
      { id: "a", ownerId: "owner-plugins", name: "Spring", postcardSize: "5x8" },
      { id: "b", ownerId: "someone-else", name: "Hidden", postcardSize: "6x9" },
    ],
    "owner-plugins",
  )
  assert.deepEqual(rows, [{ id: "a", name: "Spring", size: "5x8" }])
})

test("an anonymous plugin request is refused", async () => {
  const listed = await listCampaigns(new Request("http://localhost/api/design-plugins/campaigns"))
  assert.equal(listed.status, 401)
  const created = await createCampaign(
    new Request("http://localhost/api/design-plugins/campaigns", {
      method: "POST",
      body: JSON.stringify({ name: "Spring", size: "5x8" }),
    }),
  )
  assert.equal(created.status, 401)
  const sent = await upload(
    new Request("http://localhost/api/design-plugins/upload", {
      method: "POST",
      body: JSON.stringify({ campaignId: "x", face: "front", contentBase64: PNG }),
    }),
  )
  assert.equal(sent.status, 401)
})

test("a plugin upload uses the same design path and does not mail", async () => {
  const repository = createCampaignRepository(createMemoryDocumentStore())
  const created = await createPluginCampaign("owner-plugins", { name: "Spring card", size: "5x8" }, repository)
  assert.equal(created.size, "5x8")
  const files = new Map<string, Buffer>()
  const saved = await uploadPluginDesign(
    "owner-plugins",
    {
      campaignId: created.id,
      face: "front",
      fileName: "front.png",
      contentBase64: PNG,
      businessName: "Harbor Roofing",
      street: "1 Main St",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
    },
    repository,
    {
      async put(campaignId, key, bytes) {
        files.set(`${campaignId}/${key}`, Buffer.from(bytes))
      },
      async get(campaignId, key) {
        const found = files.get(`${campaignId}/${key}`)
        return found ? { bytes: found } : null
      },
    },
  )
  assert.equal(saved.mailed, false)
  assert.equal(saved.charged, false)
  assert.equal(saved.face, "front")
  assert.doesNotMatch(JSON.stringify(saved), /click2mail/i)
  await assert.rejects(
    () => uploadPluginDesign("other-person", { campaignId: created.id, face: "back", fileName: "back.png", contentBase64: PNG }, repository),
    /not found/,
  )
})
