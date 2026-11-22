import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import jsQR from "jsqr"
import sharp from "sharp"

import { editLockedHero } from "@/lib/image-edit/edit-locked-hero"
import { memoryWordChangeLedger } from "@/lib/image-edit/word-change"
import { finishedGalleryPhotos } from "@/lib/mail-templates/gallery-finished"
import { encodeSolidPng } from "@/lib/print-spec/raster"

import { paintQrsOnFace, qrPixelBox } from "./composite"
import { frameBox } from "./model"

const png = encodeSolidPng(24, 16, [8, 16, 24])
const finishedId = finishedGalleryPhotos()[0]?.id ?? ""
const now = new Date("2026-11-22T15:00:00.000Z")
const openCaps = {
  WORD_CHANGE_FREE_ALLOWANCE: "5",
  WORD_CHANGE_ACCOUNT_DAILY_CAP: "20",
  WORD_CHANGE_SITE_DAILY_CAP: "300",
  GEMINI_API_KEY: "present",
} as unknown as NodeJS.ProcessEnv

test("the QR is composited after the edit, not sent to the editor", async () => {
  let instruction = ""
  const shot: { image: Buffer | null } = { image: null }
  const edited = await editLockedHero({
    userId: "owner",
    templateId: finishedId,
    campaignName: "Spring tune-up",
    size: "5x8",
    businessName: "Harbor Roofing",
    offer: "Free roof inspection",
    callToAction: "Call to book a visit",
    phone: "(619) 555-0148",
    website: "harbor.example",
    instructions: "Keep the roof photo. Change the headline to Spring checkups and use navy type.",
    now,
    env: openCaps,
    ledger: memoryWordChangeLedger(),
    editor: async (input) => {
      instruction = input.instruction
      shot.image = input.image
      return input.image
    },
    loadImage: async () => png,
  })
  assert.equal(edited.ok, true)
  const editorImage = shot.image
  assert.ok(editorImage)
  assert.equal(editorImage.equals(png), true)
  assert.doesNotMatch(instruction, /qr code|qr-placement|paintQrs/i)

  const payload = "https://mail.example/q/abcd2345"
  const base = await sharp({
    create: { width: 800, height: 500, channels: 3, background: { r: 200, g: 180, b: 160 } },
  })
    .jpeg()
    .toBuffer()
  const mark = { xInches: 0.4, yInches: 0.4, sizeInches: 1.25, payload }
  const painted = await paintQrsOnFace(base, { size: "5x8", frame: "trim", marks: [mark] })
  assert.equal(painted.equals(base), false)
  assert.equal(editorImage.equals(painted), false)
  const box = qrPixelBox(frameBox("5x8", "trim"), 800, 500, mark)
  const found = await decodeQr(painted, box)
  assert.equal(found, payload)

  const outside = await sharp(painted).extract({ left: 2, top: 2, width: 4, height: 4 }).raw().toBuffer()
  assert.ok(outside[0]! > 170 && outside[1]! > 150 && outside[2]! > 130)
})

test("the edit path and the word-change path do not paint a QR", () => {
  const files = [
    "lib/image-edit/edit-locked-hero.ts",
    "lib/image-edit/gemini.ts",
    "lib/image-edit/locked-hero-instruction.ts",
    "app/api/photo-edit/design/route.ts",
    "app/api/photo-edit/words/route.ts",
    "app/api/photo-edit/words/accept/route.ts",
    "components/mail-gallery/ChangeTheWords.tsx",
  ]
  for (const file of files) {
    const source = readFileSync(file, "utf8")
    assert.equal(/qr-placement|paintQrsOnFace|QrFaceOverlay/.test(source), false, file)
  }
})

async function decodeQr(
  image: Buffer,
  box: { left: number; top: number; width: number; height: number }
): Promise<string | null> {
  const { data, info } = await sharp(image)
    .extract(box)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
  return jsQR(pixels, info.width, info.height)?.data ?? null
}
