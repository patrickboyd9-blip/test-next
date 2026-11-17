import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { promisify } from "node:util"

import { requireOwnedCampaign } from "@/lib/auth/campaign-access"
import { runAs, type AccountSession } from "@/lib/auth/session"
import { createCampaignRepository } from "@/lib/campaign-creator/repository"
import type { JobCreative, JobPhotoRecord } from "@/lib/campaign-creator/types"
import { encodePng } from "@/lib/design-intelligence/cutout"
import { decodeRaster } from "@/lib/bring-your-own-design/decode-raster"
import { addressSideContentRect, rectsOverlap } from "@/lib/print-spec/address-side-content"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { createFileDocumentStore } from "@/lib/storage/document-store"

import { backPhotoSlot, FRONT_PHOTO_SLOT, windowForKeep } from "./crop"
import { chooseBack, placeFace } from "./layout"
import { prepareJobPhoto } from "./prepare"
import { renderJobProof } from "./render"

const exec = promisify(execFile)
const alice: AccountSession = {
  userId: "alice@example.com",
  email: "alice@example.com",
  name: "Alice",
  businessName: "Alice Co",
  fixture: false,
}
const bob: AccountSession = { ...alice, userId: "bob@example.com", email: "bob@example.com", name: "Bob", businessName: "Bob Co" }

function solid(width: number, height: number, paint: (x: number, y: number) => [number, number, number, number]): Buffer {
  const rgba = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = paint(x, y)
      const index = (y * width + x) * 4
      rgba[index] = r
      rgba[index + 1] = g
      rgba[index + 2] = b
      rgba[index + 3] = a
    }
  }
  return encodePng(width, height, rgba)
}

test("a job photo is not a logo or a finished design, and a soft photo stays soft", () => {
  const png = solid(80, 60, () => [20, 40, 200, 255])
  const prepared = prepareJobPhoto(png, "image/png")
  assert.equal(prepared.ok, true)
  if (!prepared.ok) return
  assert.equal(prepared.record.role, "job-photo")
  assert.match(prepared.record.fileName, /^job-[a-f0-9]{8}\.png$/)
  assert.equal(prepared.record.detail, "low")
  assert.equal(prepareJobPhoto(Buffer.from("%PDF-1.4"), "application/pdf").ok, false)
  const svg = prepareJobPhoto(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/svg+xml")
  assert.equal(svg.ok, false)
  if (!svg.ok) assert.match(svg.error, /logo/)
  const pdf = prepareJobPhoto(Buffer.from("%PDF-1.4"), "application/pdf")
  if (!pdf.ok) assert.match(pdf.error, /finished design/)
})

test("the kept face and tool survive a large frame and are not cut to force a thin one", () => {
  const source = { width: 240, height: 160 }
  const keep = { x: 0.15, y: 0.02, w: 0.7, h: 0.72 }
  const front = windowForKeep(source, keep, FRONT_PHOTO_SLOT)
  assert.equal(front.fits, true)
  if (!front.fits) return
  assert.ok(front.window.y <= keep.y)
  assert.ok(front.window.y + front.window.h >= keep.y + keep.h)
  const thin = windowForKeep(source, { x: 0, y: 0, w: 1, h: 1 }, { w: 4, h: 0.7 })
  assert.equal(thin.fits, false)
  if (!thin.fits) assert.match(thin.reason, /words-only back/)
})

test("a words-only back leaves the front photo and its frame untouched", () => {
  const photo = photoRecord()
  const creative: JobCreative = {
    rightsConfirmedAt: "2026-11-08T00:00:00.000Z",
    trade: "unknown",
    serviceAction: "Repair",
    photos: [photo],
    frontPhotoId: photo.id,
    back: { treatment: "photo", photoId: photo.id },
  }
  const next = chooseBack(creative, "text")
  assert.equal(next.frontPhotoId, creative.frontPhotoId)
  assert.deepEqual(next.photos, creative.photos)
  assert.equal(next.back.treatment, "text")
  assert.equal(next.back.photoId, null)
  assert.equal(placeFace(next, "front").photoId, photo.id)
  assert.equal(placeFace(next, "back").treatment, "text")
})

test("the saved crop reloads for the owner and is invisible to another account", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-job-"))
  try {
    const repository = createCampaignRepository(createFileDocumentStore(directory))
    const campaign = await repository.createCampaign(alice.userId)
    const photo = photoRecord()
    const creative: JobCreative = {
      rightsConfirmedAt: "2026-11-08T00:00:00.000Z",
      trade: "unknown",
      serviceAction: "Replacement",
      photos: [photo],
      frontPhotoId: photo.id,
      back: { treatment: "text", photoId: null },
    }
    await repository.saveJobCreative(campaign.id, creative)
    const loaded = await repository.getCampaign(campaign.id)
    assert.deepEqual(loaded?.jobCreative?.photos[0]?.keep, photo.keep)
    assert.equal(loaded?.jobCreative?.photos[0]?.role, "job-photo")
    assert.equal(loaded?.brief.brandAssets, undefined)
    const owned = await runAs(alice, () => requireOwnedCampaign(campaign.id, repository))
    assert.equal(owned.jobCreative?.frontPhotoId, photo.id)
    await assert.rejects(
      () => runAs(bob, () => requireOwnedCampaign(campaign.id, repository)),
      (error: unknown) => error instanceof Error && "status" in error && (error as { status: number }).status === 404
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("the print proof uses the same crop and stays out of the address keep-out", async () => {
  const width = 240
  const height = 160
  const png = solid(width, height, (_x, y) => {
    if (y < 36) return [0, 180, 40, 255]
    if (y > 70 && y < 110) return [200, 20, 20, 255]
    return [20, 40, 180, 255]
  })
  const photo = photoRecord()
  photo.width = width
  photo.height = height
  photo.keep = { x: 0.1, y: 0, w: 0.8, h: 0.75 }
  photo.detail = "ok"
  const creative: JobCreative = {
    rightsConfirmedAt: "2026-11-08T00:00:00.000Z",
    trade: "unknown",
    serviceAction: "Repair",
    photos: [photo],
    frontPhotoId: photo.id,
    back: { treatment: "text", photoId: null },
  }
  const expected = windowForKeep(photo, photo.keep, FRONT_PHOTO_SLOT)
  const proof = await renderJobProof(creative, new Map([[photo.fileName, png]]))
  assert.equal(proof.front.treatment, "photo")
  assert.deepEqual(proof.front.fit, expected)
  assert.equal(proof.back.treatment, "text")
  assert.equal(proof.front.photoId, photo.id)
  const content = addressSideContentRect()
  for (const keepOut of buildPostcard5x8PrintSpec().keepOuts) {
    assert.equal(rectsOverlap(content, keepOut.canvas), false, keepOut.id)
  }
  const directory = await mkdtemp(path.join(tmpdir(), "mm-job-proof-"))
  try {
    const pdf = path.join(directory, "proof.pdf")
    await writeFile(pdf, proof.bytes)
    await exec("pdftoppm", ["-png", "-r", "40", "-f", "1", "-l", "1", pdf, path.join(directory, "front")])
    const raster = decodeRaster(await (await import("node:fs/promises")).readFile(path.join(directory, "front-1.png")), "png")
    assert.ok(raster)
    if (!raster) return
    let green = 0
    let red = 0
    for (let i = 0; i < raster.rgba.length; i += 4) {
      const g = raster.rgba[i + 1] ?? 0
      const r = raster.rgba[i] ?? 0
      const b = raster.rgba[i + 2] ?? 0
      if (g > 120 && r < 80) green += 1
      if (r > 140 && g < 80 && b < 80) red += 1
    }
    assert.ok(green > 20, `green ${green}`)
    assert.ok(red > 20, `red ${red}`)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
  const impossible = {
    ...creative,
    back: { treatment: "photo" as const, photoId: photo.id },
    photos: [{ ...photo, keep: { x: 0, y: 0, w: 1, h: 1 } }],
  }
  const back = placeFace(impossible, "back")
  assert.equal(back.treatment, "text")
  assert.match(back.warning ?? "", /words-only/)
  assert.equal(placeFace(impossible, "front").photoId, photo.id)
  void backPhotoSlot
})

function photoRecord(): JobPhotoRecord {
  return {
    id: "abc12345",
    role: "job-photo",
    fileName: "job-abc12345.png",
    width: 240,
    height: 160,
    keep: { x: 0.2, y: 0.1, w: 0.5, h: 0.5 },
    protect: "both",
    detail: "ok",
    createdAt: "2026-11-08T00:00:00.000Z",
  }
}
