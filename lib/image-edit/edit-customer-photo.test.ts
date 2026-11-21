import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { encodeSolidPng, readRasterSize } from "@/lib/print-spec/raster"

import { editCustomerPhoto, usePhotoEditorForTests } from "./edit-customer-photo"
import { CUSTOMER_PHOTO_MESSAGES, PHOTO_EDIT_DAILY, PHOTO_EDIT_FAILED, PHOTO_EDIT_PAUSED } from "./messages"
import { memoryPhotoEditLedger } from "./spend"

const png = encodeSolidPng(12, 10, [8, 16, 24])
const env = {
  GEMINI_MONTHLY_CAP_USD: "25",
  PHOTO_EDIT_DAILY_LIMIT: "20",
  GEMINI_API_KEY: "present",
} as unknown as NodeJS.ProcessEnv

test("an edit returns a print jpeg and does not tell the customer the price or the vendor", async () => {
  const ledger = memoryPhotoEditLedger()
  const result = await editCustomerPhoto({
    userId: "owner",
    imageBase64: png.toString("base64"),
    instruction: "make the sky sunset",
    now: new Date("2026-11-21T15:00:00.000Z"),
    env,
    ledger,
    editor: async () => png,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.match(result.afterSrc, /^data:image\/jpeg;base64,/)
  const bytes = Buffer.from(result.afterSrc.split(",")[1] ?? "", "base64")
  const size = readRasterSize(bytes)
  assert.equal(size.kind, "jpeg")
  assert.equal(size.width, 12)
  assert.equal(size.height, 10)
  const packed = JSON.stringify(result)
  assert.equal(/gemini|openai|\$|cent|prompt/i.test(packed), false)
  for (const message of CUSTOMER_PHOTO_MESSAGES) {
    assert.equal(/gemini|openai|anthropic|\$|nano banana/i.test(message), false)
  }
})

test("the monthly cap blocks the next edit before the model is called", async () => {
  const ledger = memoryPhotoEditLedger()
  let calls = 0
  const editor = async () => {
    calls += 1
    return png
  }
  const tight = { ...env, GEMINI_MONTHLY_CAP_USD: "0.04" } as NodeJS.ProcessEnv
  const first = await editCustomerPhoto({
    userId: "owner",
    imageBase64: png.toString("base64"),
    instruction: "remove the truck",
    now: new Date("2026-11-21T15:00:00.000Z"),
    env: tight,
    ledger,
    editor,
  })
  const second = await editCustomerPhoto({
    userId: "someone-else",
    imageBase64: png.toString("base64"),
    instruction: "remove the truck",
    now: new Date("2026-11-21T15:00:00.000Z"),
    env: tight,
    ledger,
    editor,
  })
  assert.equal(first.ok, true)
  assert.equal(second.ok, false)
  if (second.ok) return
  assert.equal(second.message, PHOTO_EDIT_PAUSED)
  assert.equal(calls, 1)
})

test("the daily limit is per customer", async () => {
  const ledger = memoryPhotoEditLedger()
  const tight = { ...env, PHOTO_EDIT_DAILY_LIMIT: "1" } as NodeJS.ProcessEnv
  const now = new Date("2026-11-21T15:00:00.000Z")
  const first = await editCustomerPhoto({
    userId: "owner",
    imageBase64: png.toString("base64"),
    instruction: "make the sky sunset",
    now,
    env: tight,
    ledger,
    editor: async () => png,
  })
  const second = await editCustomerPhoto({
    userId: "owner",
    imageBase64: png.toString("base64"),
    instruction: "make the sky sunset",
    now,
    env: tight,
    ledger,
    editor: async () => png,
  })
  assert.equal(first.ok, true)
  assert.equal(second.ok, false)
  if (second.ok) return
  assert.equal(second.message, PHOTO_EDIT_DAILY)
})

test("a failed edit is not counted against the cap", async () => {
  const ledger = memoryPhotoEditLedger()
  const failed = await editCustomerPhoto({
    userId: "owner",
    imageBase64: png.toString("base64"),
    instruction: "make the sky sunset",
    now: new Date("2026-11-21T15:00:00.000Z"),
    env: { ...env, GEMINI_MONTHLY_CAP_USD: "0.04" } as NodeJS.ProcessEnv,
    ledger,
    editor: async () => {
      throw new Error("nope")
    },
  })
  const again = await editCustomerPhoto({
    userId: "owner",
    imageBase64: png.toString("base64"),
    instruction: "make the sky sunset",
    now: new Date("2026-11-21T15:00:00.000Z"),
    env: { ...env, GEMINI_MONTHLY_CAP_USD: "0.04" } as NodeJS.ProcessEnv,
    ledger,
    editor: async () => png,
  })
  assert.equal(failed.ok, false)
  if (failed.ok) return
  assert.equal(failed.message, PHOTO_EDIT_FAILED)
  assert.equal(again.ok, true)
})

test("customer copy never names a vendor or a price", () => {
  const files = [
    "components/mail-gallery/PhotoAdjust.tsx",
    "components/cockpit/GalleryProof.tsx",
    "lib/image-edit/messages.ts",
    "app/api/photo-edit/route.ts",
    "app/api/photo-edit/keep/route.ts",
  ]
  for (const file of files) {
    const source = readFileSync(file, "utf8")
    assert.equal(/gemini|openai|anthropic|flux|qwen|seedream|nano banana|\$\d/i.test(source), false, file)
  }
  const adjust = readFileSync("components/mail-gallery/PhotoAdjust.tsx", "utf8")
  for (const label of ["Apply edit", "Before", "After", "Undo", "Keep", "Discard"]) {
    assert.ok(adjust.includes(label), label)
  }
})

test.after(() => {
  usePhotoEditorForTests(null)
})
