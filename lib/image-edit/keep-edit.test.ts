import assert from "node:assert/strict"
import test from "node:test"

import type { UploadedDesignStore } from "@/lib/bring-your-own-design/store"
import { encodeSolidPng } from "@/lib/print-spec/raster"

import { editCustomerPhoto } from "./edit-customer-photo"
import { keepEditedPhoto } from "./keep-edit"
import { memoryPhotoEditLedger } from "./spend"

test("keep stores the jpeg on the campaign the way an upload is stored", async () => {
  const files = new Map<string, Buffer>()
  const store: UploadedDesignStore = {
    async put(campaignId, key, bytes) {
      files.set(`${campaignId}/${key}`, Buffer.from(bytes))
    },
    async get(campaignId, key) {
      const bytes = files.get(`${campaignId}/${key}`)
      return bytes ? { bytes } : null
    },
  }
  const png = encodeSolidPng(6, 6, [4, 5, 6])
  const edited = await editCustomerPhoto({
    userId: "owner",
    imageBase64: png.toString("base64"),
    instruction: "remove the truck",
    now: new Date("2026-11-21T15:00:00.000Z"),
    env: { GEMINI_MONTHLY_CAP_USD: "25", PHOTO_EDIT_DAILY_LIMIT: "20" } as unknown as NodeJS.ProcessEnv,
    ledger: memoryPhotoEditLedger(),
    editor: async () => png,
  })
  assert.equal(edited.ok, true)
  if (!edited.ok) return
  const kept = await keepEditedPhoto({
    imageBase64: edited.afterSrc,
    campaignId: "camp-1",
    store,
  })
  assert.deepEqual(kept, { ok: true })
  const saved = await store.get("camp-1", "front.jpg")
  assert.ok(saved)
  assert.equal(saved?.bytes[0], 0xff)
  assert.equal(saved?.bytes[1], 0xd8)
})
