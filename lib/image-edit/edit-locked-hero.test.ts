import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { encodeSolidPng, readRasterSize } from "@/lib/print-spec/raster"
import { finishedGalleryPhotos } from "@/lib/mail-templates/gallery-finished"

import { editLockedHero } from "./edit-locked-hero"
import { addressBackSvg } from "./locked-hero-back"
import { lockedHeroInstruction } from "./locked-hero-instruction"
import {
  HERO_EDIT_FAILED,
  HERO_NEED_CHANGES,
  PHOTO_EDIT_DAILY,
  WORD_CHANGE_ALLOWANCE,
  WORD_CHANGE_PAUSED,
} from "./messages"
import { memoryWordChangeLedger } from "./word-change"

const png = encodeSolidPng(24, 16, [8, 16, 24])
const finishedId = finishedGalleryPhotos()[0]?.id ?? ""
const now = new Date("2026-11-22T15:00:00.000Z")
const openCaps = {
  WORD_CHANGE_FREE_ALLOWANCE: "5",
  WORD_CHANGE_ACCOUNT_DAILY_CAP: "20",
  WORD_CHANGE_SITE_DAILY_CAP: "300",
  GEMINI_API_KEY: "present",
} as unknown as NodeJS.ProcessEnv

const form = {
  userId: "owner",
  templateId: finishedId,
  campaignName: "Spring tune-up",
  size: "5x8" as const,
  businessName: "Harbor Roofing",
  offer: "Free roof inspection",
  callToAction: "Call to book a visit",
  phone: "(619) 555-0148",
  website: "harbor.example",
  instructions: "Keep the roof photo. Change the headline to Spring checkups and use navy type.",
}

test("the design request keeps the customer's words and does not name a vendor", () => {
  const text = lockedHeroInstruction({
    ...form,
    size: "5x8",
    changeNote: "Make the phone larger",
    hasLogo: true,
  })
  assert.match(text, /Harbor Roofing/)
  assert.match(text, /Spring checkups/)
  assert.match(text, /Make the phone larger/)
  assert.match(text, /attached logo/)
  assert.doesNotMatch(text, /gemini|openai|anthropic|\$|prompt/i)
})

test("the address side is assembled from the form and stays out of the vendor", () => {
  const svg = addressBackSvg(
    {
      size: "5x8",
      businessName: "A & B <Roofing>",
      offer: "Free inspection",
      callToAction: "Call today",
      phone: "(619) 555-0148",
      website: "",
    },
    { width: 400, height: 250, x: 20, y: 20, w: 180, h: 160 }
  )
  assert.match(svg, /A &amp; B &lt;Roofing&gt;/)
  assert.match(svg, /Free inspection/)
  assert.doesNotMatch(svg, /gemini|openai|\$\d/i)
})

test("this path shares the free edit allowance and does not call the editor when it is used up", async () => {
  const ledger = memoryWordChangeLedger()
  let calls = 0
  const editor = async () => {
    calls += 1
    return png
  }
  const env = { ...openCaps, WORD_CHANGE_FREE_ALLOWANCE: "1" } as NodeJS.ProcessEnv
  const first = await editLockedHero({ ...form, now, env, ledger, editor, loadImage: async () => png })
  const second = await editLockedHero({ ...form, now, env, ledger, editor, loadImage: async () => png })
  assert.equal(first.ok, true)
  if (!first.ok) return
  assert.equal(first.proof, true)
  assert.match(first.frontSrc, /^data:image\/jpeg;base64,/)
  assert.match(first.backSrc, /^data:image\/jpeg;base64,/)
  assert.equal(readRasterSize(Buffer.from(first.frontSrc.split(",")[1] ?? "", "base64")).kind, "jpeg")
  assert.equal(readRasterSize(Buffer.from(first.backSrc.split(",")[1] ?? "", "base64")).kind, "jpeg")
  assert.equal(/gemini|openai|\$|prompt/i.test(JSON.stringify({ front: first.frontSrc.slice(0, 32), proof: first.proof })), false)
  assert.equal(second.ok, false)
  if (second.ok) return
  assert.equal(second.message, WORD_CHANGE_ALLOWANCE)
  assert.equal(second.code, "allowance")
  assert.equal(calls, 1)
})

test("the account daily cap and the site daily cap stop a gallery design", async () => {
  const ledger = memoryWordChangeLedger()
  const editor = async () => png
  const daily = { ...openCaps, WORD_CHANGE_ACCOUNT_DAILY_CAP: "1" } as NodeJS.ProcessEnv
  const first = await editLockedHero({ ...form, now, env: daily, ledger, editor, loadImage: async () => png })
  const second = await editLockedHero({ ...form, now, env: daily, ledger, editor, loadImage: async () => png })
  assert.equal(first.ok, true)
  assert.equal(second.ok, false)
  if (second.ok) return
  assert.equal(second.message, PHOTO_EDIT_DAILY)

  const site = memoryWordChangeLedger()
  const siteEnv = { ...openCaps, WORD_CHANGE_SITE_DAILY_CAP: "1" } as NodeJS.ProcessEnv
  const other = await editLockedHero({
    ...form,
    userId: "someone-else",
    now,
    env: siteEnv,
    ledger: site,
    editor,
    loadImage: async () => png,
  })
  const blocked = await editLockedHero({
    ...form,
    userId: "third",
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
})

test("a follow-up edit uses the current proof, and a failed edit is not counted", async () => {
  const ledger = memoryWordChangeLedger()
  const gallery = encodeSolidPng(24, 16, [1, 2, 3])
  const proof = encodeSolidPng(24, 16, [9, 9, 9])
  let seen: Buffer | null = null
  let notes = ""
  const editor = async (input: { image: Buffer; instruction: string; logo: { bytes: Buffer } | null }) => {
    seen = input.image
    notes = input.instruction
    if (input.logo) assert.ok(input.logo.bytes.length > 8)
    return png
  }
  const first = await editLockedHero({
    ...form,
    now,
    env: openCaps,
    ledger,
    editor,
    loadImage: async () => gallery,
    logoBase64: png.toString("base64"),
  })
  assert.equal(first.ok, true)
  assert.ok(seen)
  assert.equal(Buffer.compare(seen as unknown as Buffer, gallery), 0)

  const current = `data:image/png;base64,${proof.toString("base64")}`
  let loads = 0
  const second = await editLockedHero({
    ...form,
    changeNote: "Make the phone larger",
    currentFrontBase64: current,
    now,
    env: openCaps,
    ledger,
    editor,
    loadImage: async () => {
      loads += 1
      return gallery
    },
  })
  assert.equal(second.ok, true)
  assert.equal(loads, 0)
  assert.equal(Buffer.compare(seen as unknown as Buffer, proof), 0)
  assert.match(notes, /Make the phone larger/)

  const failing = memoryWordChangeLedger()
  const failed = await editLockedHero({
    ...form,
    now,
    env: { ...openCaps, WORD_CHANGE_FREE_ALLOWANCE: "1" } as NodeJS.ProcessEnv,
    ledger: failing,
    editor: async () => {
      throw new Error("nope")
    },
    loadImage: async () => png,
  })
  const retry = await editLockedHero({
    ...form,
    now,
    env: { ...openCaps, WORD_CHANGE_FREE_ALLOWANCE: "1" } as NodeJS.ProcessEnv,
    ledger: failing,
    editor: async () => png,
    loadImage: async () => png,
  })
  assert.equal(failed.ok, false)
  if (failed.ok) return
  assert.equal(failed.message, HERO_EDIT_FAILED)
  assert.equal(retry.ok, true)
})

test("a design without the change note is refused before the editor runs", async () => {
  let calls = 0
  const result = await editLockedHero({
    ...form,
    instructions: "tiny",
    now,
    env: openCaps,
    ledger: memoryWordChangeLedger(),
    editor: async () => {
      calls += 1
      return png
    },
    loadImage: async () => png,
  })
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.message, HERO_NEED_CHANGES)
  assert.equal(calls, 0)
})

test("customer copy for this design path does not name a vendor or a price", () => {
  const files = [
    "components/mail-gallery/LockedHeroMailer.tsx",
    "app/api/photo-edit/design/route.ts",
    "lib/mail-templates/locked-hero-proof.ts",
    "lib/image-edit/messages.ts",
  ]
  for (const file of files) {
    const source = readFileSync(file, "utf8")
    assert.equal(/gemini|openai|anthropic|flux|qwen|seedream|nano banana|\$\d/i.test(source), false, file)
  }
})
