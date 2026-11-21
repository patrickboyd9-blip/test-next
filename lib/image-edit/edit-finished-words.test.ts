import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { encodeSolidPng, readRasterSize } from "@/lib/print-spec/raster"

import { editFinishedWords, useFinishedImageLoaderForTests, useFinishedWordsEditorForTests } from "./edit-finished-words"
import {
  PHOTO_EDIT_DAILY,
  PHOTO_EDIT_FAILED,
  WORD_CHANGE_ALLOWANCE,
  WORD_CHANGE_PAUSED,
} from "./messages"
import { wordChangeInstruction } from "./word-change-instruction"
import {
  decideWordChange,
  FREE_WORD_CHANGES,
  memoryWordChangeLedger,
  wordChangeAccountDaily,
  wordChangeFreeAllowance,
  wordChangeSiteDaily,
} from "./word-change"
import { finishedGalleryPhotos } from "@/lib/mail-templates/gallery-finished"

const png = encodeSolidPng(12, 10, [8, 16, 24])
const finishedId = finishedGalleryPhotos()[0]?.id ?? ""
const now = new Date("2026-11-21T15:00:00.000Z")

const openCaps = {
  WORD_CHANGE_FREE_ALLOWANCE: "5",
  WORD_CHANGE_ACCOUNT_DAILY_CAP: "20",
  WORD_CHANGE_SITE_DAILY_CAP: "300",
  GEMINI_API_KEY: "present",
} as unknown as NodeJS.ProcessEnv

function limits(env: NodeJS.ProcessEnv) {
  return {
    freeAllowance: wordChangeFreeAllowance(env),
    accountDaily: wordChangeAccountDaily(env),
    siteDaily: wordChangeSiteDaily(env),
  }
}

test("the free allowance is 5, the account day is 20, and the site day is 300", () => {
  assert.equal(FREE_WORD_CHANGES, 5)
  assert.equal(wordChangeFreeAllowance({} as NodeJS.ProcessEnv), 5)
  assert.equal(wordChangeAccountDaily({} as NodeJS.ProcessEnv), 20)
  assert.equal(wordChangeSiteDaily({} as NodeJS.ProcessEnv), 300)
  assert.equal(wordChangeSiteDaily({ WORD_CHANGE_SITE_DAILY_CAP: "40" } as unknown as NodeJS.ProcessEnv), 40)
  assert.deepEqual(
    decideWordChange({ paid: false, accountTotal: 5, accountToday: 0, siteToday: 0, freeAllowance: 5, accountDaily: 20, siteDaily: 300 }),
    { ok: false, reason: "allowance" }
  )
  assert.deepEqual(
    decideWordChange({ paid: true, accountTotal: 5, accountToday: 0, siteToday: 0, freeAllowance: 5, accountDaily: 20, siteDaily: 300 }),
    { ok: true }
  )
  assert.deepEqual(
    decideWordChange({ paid: true, accountTotal: 0, accountToday: 20, siteToday: 0, freeAllowance: 5, accountDaily: 20, siteDaily: 300 }),
    { ok: false, reason: "account-day" }
  )
  assert.deepEqual(
    decideWordChange({ paid: false, accountTotal: 0, accountToday: 0, siteToday: 300, freeAllowance: 5, accountDaily: 20, siteDaily: 300 }),
    { ok: false, reason: "site-day" }
  )
})

test("a word change keeps the customer's words and does not name a vendor", () => {
  const text = wordChangeInstruction({
    businessName: "Harbor Roofing",
    headline: "Free roof check",
    phone: "(619) 555-0148",
    website: "harbor.example",
    extra: "This week only",
    placement: "replace-existing",
  })
  assert.match(text, /Harbor Roofing/)
  assert.match(text, /Free roof check/)
  assert.match(text, /Replace the existing logo/)
  assert.doesNotMatch(text, /gemini|openai|\$|prompt/i)
})

test("five free edits are counted, and the next one asks for a card before the editor runs", async () => {
  const ledger = memoryWordChangeLedger()
  let calls = 0
  const env = { ...openCaps, WORD_CHANGE_FREE_ALLOWANCE: "1" } as NodeJS.ProcessEnv
  const editor = async () => {
    calls += 1
    return png
  }
  const first = await editFinishedWords({
    userId: "owner",
    templateId: finishedId,
    businessName: "Harbor Roofing",
    headline: "Free roof check",
    phone: "(619) 555-0148",
    now,
    env,
    ledger,
    editor,
    loadImage: async () => png,
  })
  const second = await editFinishedWords({
    userId: "owner",
    templateId: finishedId,
    businessName: "Harbor Roofing",
    headline: "Free roof check",
    phone: "(619) 555-0148",
    now,
    env,
    ledger,
    editor,
    loadImage: async () => png,
  })
  assert.equal(first.ok, true)
  if (!first.ok) return
  assert.equal(first.proof, true)
  assert.match(first.afterSrc, /^data:image\/jpeg;base64,/)
  const bytes = Buffer.from(first.afterSrc.split(",")[1] ?? "", "base64")
  assert.equal(readRasterSize(bytes).kind, "jpeg")
  assert.equal(/gemini|openai|\$|prompt/i.test(JSON.stringify(first)), false)
  assert.equal(second.ok, false)
  if (second.ok) return
  assert.equal(second.message, WORD_CHANGE_ALLOWANCE)
  assert.equal(second.code, "allowance")
  assert.equal(calls, 1)
  assert.equal(limits(env).freeAllowance, 1)
})

test("the account daily cap and the site daily cap stop the edit", async () => {
  const ledger = memoryWordChangeLedger()
  let calls = 0
  const editor = async () => {
    calls += 1
    return png
  }
  const daily = { ...openCaps, WORD_CHANGE_ACCOUNT_DAILY_CAP: "1" } as NodeJS.ProcessEnv
  const first = await editFinishedWords({
    userId: "owner",
    templateId: finishedId,
    businessName: "Harbor Roofing",
    headline: "Free roof check",
    phone: "(619) 555-0148",
    now,
    env: daily,
    ledger,
    editor,
    loadImage: async () => png,
  })
  const second = await editFinishedWords({
    userId: "owner",
    templateId: finishedId,
    businessName: "Harbor Roofing",
    headline: "Free roof check",
    phone: "(619) 555-0148",
    now,
    env: daily,
    ledger,
    editor,
    loadImage: async () => png,
  })
  assert.equal(first.ok, true)
  assert.equal(second.ok, false)
  if (second.ok) return
  assert.equal(second.message, PHOTO_EDIT_DAILY)

  const site = memoryWordChangeLedger()
  const siteEnv = { ...openCaps, WORD_CHANGE_SITE_DAILY_CAP: "1" } as NodeJS.ProcessEnv
  const other = await editFinishedWords({
    userId: "someone-else",
    templateId: finishedId,
    businessName: "Harbor Roofing",
    headline: "Free roof check",
    phone: "(619) 555-0148",
    now,
    env: siteEnv,
    ledger: site,
    editor,
    loadImage: async () => png,
  })
  const blocked = await editFinishedWords({
    userId: "third",
    templateId: finishedId,
    businessName: "Harbor Roofing",
    headline: "Free roof check",
    phone: "(619) 555-0148",
    now,
    env: siteEnv,
    ledger: site,
    editor,
    loadImage: async () => png,
  })
  assert.equal(other.ok, true)
  assert.equal(blocked.ok, false)
  if (blocked.ok) return
  assert.equal(blocked.message, WORD_CHANGE_PAUSED)
  assert.equal(calls, 2)
})

test("a failed edit is not counted, and a paid stub skips the free allowance and the proof mark", async () => {
  const ledger = memoryWordChangeLedger()
  const env = { ...openCaps, WORD_CHANGE_FREE_ALLOWANCE: "1" } as NodeJS.ProcessEnv
  const failed = await editFinishedWords({
    userId: "owner",
    templateId: finishedId,
    businessName: "Harbor Roofing",
    headline: "Free roof check",
    phone: "(619) 555-0148",
    now,
    env,
    ledger,
    editor: async () => {
      throw new Error("nope")
    },
    loadImage: async () => png,
  })
  const again = await editFinishedWords({
    userId: "owner",
    templateId: finishedId,
    businessName: "Harbor Roofing",
    headline: "Free roof check",
    phone: "(619) 555-0148",
    now,
    env,
    ledger,
    editor: async () => png,
    loadImage: async () => png,
  })
  assert.equal(failed.ok, false)
  if (failed.ok) return
  assert.equal(failed.message, PHOTO_EDIT_FAILED)
  assert.equal(again.ok, true)

  const paid = await editFinishedWords({
    userId: "payer",
    templateId: finishedId,
    businessName: "Harbor Roofing",
    headline: "Free roof check",
    phone: "(619) 555-0148",
    now,
    env: { ...openCaps, WORD_CHANGE_FREE_ALLOWANCE: "1", WORD_CHANGE_PAID: "true" } as NodeJS.ProcessEnv,
    ledger: memoryWordChangeLedger([{ id: "already", day: "2026-11-21", userId: "payer" }]),
    editor: async () => png,
    loadImage: async () => png,
  })
  assert.equal(paid.ok, true)
  if (!paid.ok || !again.ok) return
  assert.equal(paid.proof, false)
  assert.notEqual(paid.afterSrc, again.afterSrc)
})

test("customer copy for word changes does not name a vendor or a price", () => {
  const files = [
    "components/mail-gallery/ChangeTheWords.tsx",
    "components/mail-gallery/GalleryBoard.tsx",
    "app/app/billing/page.tsx",
    "app/api/photo-edit/words/route.ts",
    "app/api/photo-edit/words/accept/route.ts",
    "lib/image-edit/messages.ts",
    "lib/image-edit/logo-placement.ts",
  ]
  for (const file of files) {
    const source = readFileSync(file, "utf8")
    assert.equal(/gemini|openai|anthropic|flux|qwen|seedream|nano banana|\$\d/i.test(source), false, file)
  }
})

test.after(() => {
  useFinishedWordsEditorForTests(null)
  useFinishedImageLoaderForTests(null)
})
