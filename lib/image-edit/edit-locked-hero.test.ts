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
    phoneOnFront: false,
    originalBusinessName: null,
  })
  assert.match(text, /Harbor Roofing/)
  assert.match(text, /Spring checkups/)
  assert.match(text, /Make the phone larger/)
  assert.match(text, /attached logo/)
  assert.match(text, /Required changes:/)
  assert.match(text, /1\. Keep the roof photo/)
  assert.match(text, /replace or redraw the main subject/i)
  assert.match(text, /same pose, size, position, lighting, and photo style/)
  assert.match(text, /Preserve everything that was not requested/)
  assert.match(text, /text positions, font styles, sizes, and colors of untouched elements/)
  assert.match(text, /same spot and at a similar size/)
  assert.match(text, /top-corner logo stays a top-corner logo/)
  assert.match(text, /Never move the business name into the headline/)
  assert.match(text, /every mention of the existing business name and any words of it/)
  assert.match(text, /Do not add a phone number to the front/)
  assert.match(text, /bottom disclaimer bar/)
  assert.doesNotMatch(text, /gemini|openai|anthropic|\$|prompt/i)
})

test("a numbered note is a must-do list and a named business stays in its spot", () => {
  const text = lockedHeroInstruction({
    campaignName: "Year-round care",
    size: "5x8",
    businessName: "JP Pets",
    offer: "Year-round care",
    callToAction: "Call the clinic",
    phone: "(619) 555-0199",
    website: "",
    instructions:
      "(1) change the dog to a German shepherd (2) change the top-left color from green to red (3) change the business name from Wrenshaw Veterinary to JP Pets",
    changeNote: "Make the phone larger",
    hasLogo: true,
    phoneOnFront: false,
    originalBusinessName: "Wrenshaw Veterinary",
  })
  assert.match(text, /1\. change the dog to a German shepherd/)
  assert.match(text, /2\. change the top-left color from green to red/)
  assert.match(text, /3\. change the business name from Wrenshaw Veterinary to JP Pets/)
  assert.match(text, /4\. Make the phone larger/)
  assert.match(text, /replace or redraw the main subject \(a person, an animal, or an object\)/)
  assert.match(text, /Preserve everything that was not requested/)
  assert.match(text, /overall layout, the composition/)
  assert.match(text, /every mention of "Wrenshaw Veterinary"/)
  assert.match(text, /logo subtitle or descriptor words/)
  assert.match(text, /body or offer text/)
  assert.match(text, /"JP Pets"/)
  assert.match(text, /same spot and style/)
  assert.match(text, /Do not add a phone number to the front/)
  assert.doesNotMatch(text, /Add the phone number exactly as typed/)
  assert.match(text, /existing logo position/)
  assert.doesNotMatch(text, /YEAR-ROUND CARE/)
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

test("a checked phone is added on the front, and the same business name is left alone", () => {
  const checked = lockedHeroInstruction({
    ...form,
    size: "5x8",
    changeNote: "",
    hasLogo: false,
    phoneOnFront: true,
    originalBusinessName: null,
  })
  assert.match(checked, /Add the phone number exactly as typed, "\(619\) 555-0148"/)
  assert.match(checked, /near the call to action/)
  assert.match(checked, /legible size/)
  assert.match(checked, /font and color matching the design/)
  assert.match(checked, /without covering the main subject or the offer/)
  assert.match(checked, /without moving other elements/)
  assert.match(checked, /replace it in place instead/)
  assert.doesNotMatch(checked, /Do not add a phone number to the front/)
  assert.match(checked, /every mention of the existing business name and any words of it/)

  const same = lockedHeroInstruction({
    ...form,
    businessName: "wrenshaw veterinary",
    size: "5x8",
    changeNote: "",
    hasLogo: false,
    phoneOnFront: false,
    originalBusinessName: "Wrenshaw Veterinary",
  })
  assert.doesNotMatch(same, /every mention of/i)
  assert.match(same, /Do not add a phone number to the front/)
  assert.match(same, /Do not remove or replace a phone number unless a required change asks/)
  assert.doesNotMatch(same, /Add the phone number exactly as typed/)
})

test("a re-edit names the gallery brand and keeps the phone choice", async () => {
  const front = `data:image/png;base64,${png.toString("base64")}`
  let notes = ""
  const added = await editLockedHero({
    ...form,
    templateId: "MM-vet-pet-029",
    businessName: "JP Pets",
    phoneOnFront: true,
    changeNote: "Make the offer box shorter",
    currentFrontBase64: front,
    now,
    env: openCaps,
    ledger: memoryWordChangeLedger(),
    editor: async (input: { instruction: string }) => {
      notes = input.instruction
      return png
    },
    loadImage: async () => png,
  })
  assert.equal(added.ok, true)
  assert.match(notes, /Make the offer box shorter/)
  assert.match(notes, /every mention of "Wrenshaw Veterinary"/)
  assert.match(notes, /"JP Pets"/)
  assert.match(notes, /Add the phone number exactly as typed, "\(619\) 555-0148"/)
  assert.doesNotMatch(notes, /gemini|openai|anthropic|\$|prompt/i)

  let held = ""
  const skipped = await editLockedHero({
    ...form,
    templateId: "MM-vet-pet-029",
    businessName: "JP Pets",
    phoneOnFront: false,
    changeNote: "Make the offer box shorter",
    currentFrontBase64: front,
    now,
    env: openCaps,
    ledger: memoryWordChangeLedger(),
    editor: async (input: { instruction: string }) => {
      held = input.instruction
      return png
    },
    loadImage: async () => png,
  })
  assert.equal(skipped.ok, true)
  assert.match(held, /every mention of "Wrenshaw Veterinary"/)
  assert.match(held, /Do not add a phone number to the front/)
  assert.doesNotMatch(held, /Add the phone number exactly as typed/)
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
