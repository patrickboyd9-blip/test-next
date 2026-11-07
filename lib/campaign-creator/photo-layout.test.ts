import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { promisify } from "node:util"

import { decodeRaster } from "@/lib/bring-your-own-design/decode-raster"
import { toImageBrief } from "@/lib/campaign-creator/image-brief"
import { buildOpenAIImagePrompt, servicePhotoPromptFailures } from "@/lib/campaign-creator/photography-shot-list"
import { inferPhotoSubject } from "@/lib/campaign-creator/photo-subject"
import {
  headCardRect,
  headIsClipped,
  MAILER_PHOTO_ASPECT,
  sceneFocal,
} from "@/lib/design-intelligence/subject-crop"
import { encodePng } from "@/lib/design-intelligence/cutout"
import { tradePalette } from "@/lib/postcard-layouts/trade-palettes"
import { trimKeepOuts } from "@/lib/postcard-layouts/compose"
import { rectsOverlap, trimInches } from "@/lib/postcard-layouts/templates"
import { photoVeilHex } from "@/lib/roofing-pro/scrim"
import { composeRoofingProCard, templateUsesSoftFadeBack } from "@/lib/roofing-pro/compose"
import { renderStudioDesignPdf } from "@/lib/print-spec/render-template-postcard-pdf"
import type { CampaignBrief, CreativeSpec } from "@/lib/campaign-creator/types"

const exec = promisify(execFile)

const DAMAGE: CreativeSpec = {
  headline: "Hail dents hide in plain sight.",
  subheadline: "We replace the damaged slope and haul the debris.",
  body: "The dents are in the shingles. We show you before we start.",
  offer: "$750 off a storm damage roof replacement",
  phone: "(405) 555-0117",
  website: "redriverstorm.example",
}

test("a short offer band crops a head at the scene focal and keeps it at the person focal", () => {
  const slot = {
    id: "photo",
    role: "photo",
    rect: { x: 0, y: 0, w: 8, h: 2.46 },
    bleed: true,
    treatment: "cover" as const,
  }
  assert.equal(headIsClipped({ ...slot, focal: sceneFocal() }, MAILER_PHOTO_ASPECT), true)
  for (const size of ["5x8", "6x9"] as const) {
    const card = composeRoofingProCard({
      templateId: "roof_coupon",
      size,
      spec: DAMAGE,
      businessName: "Red River Storm Restoration",
      trade: "roofing",
    })
    const photo = card.front.photos[0]
    assert.ok(photo)
    assert.equal(headIsClipped(photo, MAILER_PHOTO_ASPECT), false, size)
    const head = headCardRect(photo, MAILER_PHOTO_ASPECT)
    const offer = card.front.shapes.find((shape) => shape.role === "offer-tile")
    assert.ok(offer)
    assert.equal(rectsOverlap(head, offer.rect), false, size)
    assert.ok(head.y >= 0.04, `${size} head starts at ${head.y}`)
  }
})

test("a person on a soft-fade back stays on the card and out of the address zone", () => {
  assert.equal(inferPhotoSubject({ trade: "roofing", headline: DAMAGE.headline, offer: DAMAGE.offer }), "person")
  assert.equal(inferPhotoSubject({ trade: "real-estate-agents", headline: "What is your home worth?", offer: "Free home value report" }), "scene")
  const card = composeRoofingProCard({
    templateId: "roof_full_bleed",
    spec: DAMAGE,
    businessName: "Red River Storm Restoration",
    trade: "roofing",
    qrPayload: "https://redriverstorm.example",
    license: "OK CIB #80001234",
  })
  const photo = card.back.photos.find((slot) => slot.id === "back-fade-photo")
  assert.ok(photo)
  assert.ok(photo.rect.y >= -0.02, "person backs do not shift the photo off the top")
  assert.equal(headIsClipped(photo, MAILER_PHOTO_ASPECT), false)
  const head = headCardRect(photo, MAILER_PHOTO_ASPECT)
  const trim = trimInches("5x8")
  assert.ok(head.y >= 0.04 && head.y + head.h <= trim.h)
  assert.ok(head.x >= -0.02 && head.x + head.w <= photo.rect.x + photo.rect.w + 0.02)
  for (const keepOut of trimKeepOuts("5x8")) {
    assert.equal(rectsOverlap(head, keepOut), false, keepOut.id)
  }
  const tile = card.back.shapes.find((shape) => shape.role === "offer-tile")
  if (tile) assert.equal(rectsOverlap(head, tile.rect), false)
  const veil = card.back.shapes.find((shape) => shape.id === "back-fade")
  assert.ok(veil)
  assert.notEqual(veil.fill.toLowerCase(), tradePalette("roofing").scrim.toLowerCase())
  const band = card.back.shapes.find((shape) => shape.id === "back-headline-band")
  assert.equal(band?.role, "field")
  assert.equal(band?.fill.toLowerCase(), tradePalette("roofing").field.toLowerCase())
})

test("a house back may still drop sky, and a set of templates is not all one back", () => {
  const house = composeRoofingProCard({
    templateId: "roof_fade_offer",
    spec: { headline: "Thinking of selling?", offer: "Free home value report", phone: "(843) 555-0131", website: "harbor.example" },
    businessName: "Harbor Point Realty",
    trade: "real-estate-agents",
  })
  const photo = house.back.photos[0]
  assert.ok(photo && photo.rect.y < -0.4)
  assert.equal(templateUsesSoftFadeBack("roof_fade_offer"), true)
  assert.equal(templateUsesSoftFadeBack("roof_coupon"), false)
  assert.equal(templateUsesSoftFadeBack("roof_neighborhood"), false)
  const styles = ["roof_fade_offer", "roof_full_bleed", "roof_coupon"] as const
  const backs = styles.map((templateId) => composeRoofingProCard({
    templateId,
    spec: DAMAGE,
    businessName: "Northline Roofing",
    trade: "roofing",
  }).back.photos.some((slot) => slot.id === "back-fade-photo"))
  assert.ok(backs.some(Boolean))
  assert.ok(backs.some((fade) => !fade))
})

test("image prompts require a readable service and, when someone is present, a whole head", () => {
  const dental = toImageBrief(
    {
      imageryRole: "crew",
      leadJob: "offer",
      layoutVariant: "image_grounded",
      visualDirection: "A hygienist at work",
      headline: "Book the checkup you keep putting off.",
      offer: "$99 new patient exam, cleaning and x-rays",
    },
    { campaign: { goal: "Book a new patient visit", offer: "$99 new patient exam, cleaning and x-rays", businessInfo: { name: "Brightside Family Dental" } } as CampaignBrief }
  )
  assert.ok(dental)
  assert.equal(servicePhotoPromptFailures(buildOpenAIImagePrompt(dental)).join("; "), "")
  assert.match(dental.artDirection.subject, /operatory|scaler|mirror/i)

  const roof = toImageBrief(
    {
      imageryRole: "crew",
      leadJob: "offer",
      layoutVariant: "image_grounded",
      visualDirection: "A roof",
      headline: "Curling shingles? Fix them before the rain.",
      offer: "$400 off a full roof replacement",
      layoutHints: { templateId: "roof_fade_offer", trade: "roofing" },
    },
    { campaign: { goal: "Book a roof estimate", offer: "$400 off a full roof replacement", businessInfo: { name: "Northline Roofing" } } as CampaignBrief }
  )
  assert.ok(roof)
  assert.equal(servicePhotoPromptFailures(buildOpenAIImagePrompt(roof)).join("; "), "")
  assert.match(buildOpenAIImagePrompt(roof), /entire head/)

  const house = toImageBrief(
    {
      imageryRole: "neighborhood",
      leadJob: "offer",
      layoutVariant: "image_grounded",
      visualDirection: "A house",
      headline: "Thinking of selling?",
      offer: "Free home value report",
    },
    { campaign: { goal: "Book a listing consultation", offer: "Free home value report", businessInfo: { name: "Harbor Point Realty" } } as CampaignBrief }
  )
  assert.ok(house)
  assert.match(buildOpenAIImagePrompt(house), /No people/)
  assert.equal(servicePhotoPromptFailures(buildOpenAIImagePrompt(house)).join("; "), "")
})

test("the printed back veil does not turn a neutral photo green, and the head marker survives", async () => {
  const width = 960
  const height = 540
  const rgba = Buffer.alloc(width * height * 4)
  const head = { x: 0.28, y: 0.03, w: 0.44, h: 0.26 }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const nx = x / width
      const ny = y / height
      const marked = nx >= head.x && nx < head.x + head.w && ny >= head.y && ny < head.y + head.h
      rgba[index] = marked ? 255 : 150
      rgba[index + 1] = marked ? 0 : 150
      rgba[index + 2] = marked ? 255 : 150
      rgba[index + 3] = 255
    }
  }
  const bytes = new Uint8Array(encodePng(width, height, rgba))
  const image = { bytes, width, height }
  const card = composeRoofingProCard({
    templateId: "roof_fade_offer",
    spec: {
      headline: "Book the checkup you keep putting off.",
      offer: "$99 new patient exam, cleaning and x-rays",
      phone: "(919) 555-0163",
      website: "brightsidedental.example",
    },
    businessName: "Brightside Family Dental",
    trade: "dental",
    qrPayload: "https://brightsidedental.example",
  })
  const rendered = await renderStudioDesignPdf({
    card,
    copy: { businessName: "Brightside Family Dental", phone: "(919) 555-0163", website: "brightsidedental.example", qrPayload: "https://brightsidedental.example" },
    image,
    backImage: image,
  })
  const dir = await mkdtemp(path.join(tmpdir(), "mailer-layout-"))
  try {
    const pdf = path.join(dir, "card.pdf")
    await writeFile(pdf, rendered.bytes)
    await exec("pdftoppm", ["-png", "-r", "36", pdf, path.join(dir, "page")])
    const back = decodeRaster(await readFile(path.join(dir, "page-2.png")), "png")
    const front = decodeRaster(await readFile(path.join(dir, "page-1.png")), "png")
    assert.ok(back && front)
    assert.ok(countMagenta(front.rgba) > 40, "front kept the head marker")
    assert.ok(countMagenta(back.rgba) > 40, "back kept the head marker")
    const sample = neutralSample(back.rgba, back.width, back.height)
    assert.ok(sample.count > 30, `back still shows untinted photo (${sample.count} px)`)
    assert.ok(Math.abs(sample.g - sample.r) < 14 && Math.abs(sample.b - sample.r) < 14, `back photo cast RGB ${sample.r.toFixed(0)},${sample.g.toFixed(0)},${sample.b.toFixed(0)}`)
    const dental = tradePalette("dental")
    const veil = photoVeilHex(dental.scrim)
    assert.ok(chroma(veil) + 8 < chroma(dental.scrim))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

function countMagenta(rgba: Uint8Array): number {
  let count = 0
  for (let index = 0; index < rgba.length; index += 4) {
    const r = rgba[index] ?? 0
    const g = rgba[index + 1] ?? 0
    const b = rgba[index + 2] ?? 0
    if (r > 180 && b > 180 && g < 80) count += 1
  }
  return count
}

function neutralSample(rgba: Uint8Array, width: number, height: number): { r: number; g: number; b: number; count: number } {
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  const x1 = Math.floor(width * 0.06)
  const x2 = Math.floor(width * 0.4)
  const y1 = Math.floor(height * 0.34)
  const y2 = Math.floor(height * 0.52)
  for (let y = y1; y < y2; y += 2) {
    for (let x = x1; x < x2; x += 2) {
      const index = (y * width + x) * 4
      const pr = rgba[index] ?? 0
      const pg = rgba[index + 1] ?? 0
      const pb = rgba[index + 2] ?? 0
      if (pr > 180 && pb > 180 && pg < 90) continue
      if (pr > 235 && pg > 235 && pb > 235) continue
      r += pr
      g += pg
      b += pb
      count += 1
    }
  }
  return { r: count ? r / count : 0, g: count ? g / count : 0, b: count ? b / count : 0, count }
}

function chroma(hex: string): number {
  const raw = hex.replace("#", "")
  const channels = [0, 2, 4].map((index) => Number.parseInt(raw.slice(index, index + 2), 16))
  return Math.max(...channels) - Math.min(...channels)
}
