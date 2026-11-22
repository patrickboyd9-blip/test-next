import assert from "node:assert/strict"
import test from "node:test"

import jsQR from "jsqr"
import sharp from "sharp"

import { findQr, resetAnalytics } from "@/lib/analytics/store"
import type { UploadedDesignStore } from "@/lib/bring-your-own-design/store"
import { createCampaignRepository } from "@/lib/campaign-creator/repository"
import type { Campaign, UploadedDesign } from "@/lib/campaign-creator/types"
import { toPrintJpeg } from "@/lib/image-edit/print-jpeg"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { encodeSolidPng } from "@/lib/print-spec/raster"
import { createMemoryDocumentStore } from "@/lib/storage/document-store"

import { acceptDesignedProof } from "./accept-designed-proof"
import { qrPixelBox } from "./composite"
import { frameBox } from "./model"

test("approving the design paints the QR onto the edited picture", async () => {
  resetAnalytics()
  const repository = createCampaignRepository(createMemoryDocumentStore())
  const jpeg = await toPrintJpeg(encodeSolidPng(800, 500, [200, 180, 160]))
  const back = await toPrintJpeg(encodeSolidPng(680, 440, [244, 241, 234]))
  const saved: { front: Buffer | null; back: Buffer | null } = { front: null, back: null }
  const result = await acceptDesignedProof({
    userId: "owner",
    imageBase64: jpeg.toString("base64"),
    backBase64: back.toString("base64"),
    businessName: "Harbor Roofing",
    headline: "Free roof inspection",
    offer: "Call to book a visit",
    phone: "(619) 555-0148",
    website: "harbor.example",
    campaignName: "Spring tune-up",
    size: "5x8",
    origin: "https://mail.example",
    qrs: [
      {
        id: "qr-front",
        code: "abcd2345",
        side: "front",
        xInches: 0.4,
        yInches: 0.4,
        sizeInches: 1.25,
        destination: "page",
        website: "harbor.example",
        phone: "(619) 555-0148",
        parts: { call: false, form: false, booking: false, bookingUrl: null },
      },
      {
        id: "qr-back",
        code: "efgh6789",
        side: "back",
        xInches: 0.4,
        yInches: 0.4,
        sizeInches: 1,
        destination: "website",
        website: "https://harbor.example/offer",
        phone: "",
        parts: { call: false, form: false, booking: false, bookingUrl: null },
      },
    ],
    repository,
    saveFace: async (_campaign: Campaign, bytes: Buffer): Promise<UploadedDesign> => {
      saved.front = bytes
      return {
        front: { fileName: "proof.jpg", mediaType: "image/jpeg", byteLength: bytes.length, key: "front.jpg" },
        issues: [],
      }
    },
    saveBack: async (bytes) => {
      saved.back = bytes
    },
  })
  assert.equal(result.ok, true)
  const savedFront = saved.front
  const savedBack = saved.back
  assert.ok(savedFront)
  assert.ok(savedBack)
  const frontMeta = await sharp(savedFront).metadata()
  const frontCode = await decodeQr(
    savedFront,
    qrPixelBox(frameBox("5x8", "trim"), frontMeta.width ?? 1, frontMeta.height ?? 1, {
      xInches: 0.4,
      yInches: 0.4,
      sizeInches: 1.25,
    })
  )
  assert.equal(frontCode, "https://mail.example/q/abcd2345")
  const backMeta = await sharp(savedBack).metadata()
  const backCode = await decodeQr(
    savedBack,
    qrPixelBox(frameBox("5x8", "canvas"), backMeta.width ?? 1, backMeta.height ?? 1, {
      xInches: 0.4,
      yInches: 0.4,
      sizeInches: 1,
    })
  )
  assert.equal(backCode, "https://mail.example/q/efgh6789")
  assert.equal(findQr("abcd2345")?.destination, "hosted")
  assert.equal(findQr("efgh6789")?.website, "https://harbor.example/offer")
  assert.equal(savedFront.equals(jpeg), false)
  const zone = buildPostcard5x8PrintSpec().keepOuts.find((item) => item.id === "barcode_strip")
  assert.ok(zone)
  const cleared = await sharp(savedBack)
    .extract({ left: zone.pixels.xPx + 8, top: zone.pixels.yPx + 8, width: 2, height: 2 })
    .raw()
    .toBuffer()
  assert.ok(cleared[0]! > 245 && cleared[1]! > 245 && cleared[2]! > 245)
})

test("the saved back keeps the QR and is stored with the campaign", async () => {
  resetAnalytics()
  const repository = createCampaignRepository(createMemoryDocumentStore())
  const files = new Map<string, Buffer>()
  const store: UploadedDesignStore = {
    async put(campaignId, key, bytes) {
      files.set(`${campaignId}/${key}`, Buffer.from(bytes))
    },
    async get(campaignId, key) {
      const found = files.get(`${campaignId}/${key}`)
      return found ? { bytes: found } : null
    },
  }
  const jpeg = await toPrintJpeg(encodeSolidPng(800, 500, [180, 170, 160]))
  const back = await toPrintJpeg(encodeSolidPng(680, 440, [244, 241, 234]))
  const result = await acceptDesignedProof({
    userId: "owner",
    imageBase64: jpeg.toString("base64"),
    backBase64: back.toString("base64"),
    businessName: "Harbor Roofing",
    headline: "Free roof inspection",
    offer: "Call to book a visit",
    phone: "(619) 555-0148",
    size: "5x8",
    origin: "https://mail.example",
    qrs: [
      {
        id: "qr-back",
        code: "mnpr2345",
        side: "back",
        xInches: 0.4,
        yInches: 0.4,
        sizeInches: 1,
        destination: "page",
        website: "",
        phone: "(619) 555-0148",
        parts: { call: false, form: false, booking: false, bookingUrl: null },
      },
    ],
    repository,
    store,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  const campaign = await repository.getCampaign(result.campaignId)
  assert.equal(campaign?.uploadedDesign?.back?.key, "back.jpg")
  const stored = files.get(`${result.campaignId}/back.jpg`)
  assert.ok(stored)
  const meta = await sharp(stored).metadata()
  const found = await decodeQr(
    stored,
    qrPixelBox(frameBox("5x8", "canvas"), meta.width ?? 1, meta.height ?? 1, {
      xInches: 0.4,
      yInches: 0.4,
      sizeInches: 1,
    })
  )
  assert.equal(found, "https://mail.example/q/mnpr2345")
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
  return jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height)?.data ?? null
}
