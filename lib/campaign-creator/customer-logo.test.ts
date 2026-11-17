import assert from "node:assert/strict"
import { test } from "node:test"

import { encodePng } from "@/lib/design-intelligence/cutout"
import { composeRoofingProCard } from "@/lib/roofing-pro/compose"
import { renderStudioDesignPdf } from "@/lib/print-spec/render-template-postcard-pdf"
import { decodeRaster } from "@/lib/bring-your-own-design/decode-raster"

import { toImageBrief } from "./image-brief"
import { imageBriefFingerprint } from "./studio-image-fingerprint"
import { buildOpenAIImagePrompt } from "./photography-shot-list"
import {
  logoContainRect,
  mentionsLogo,
  mergeBrandAssets,
  prepareCustomerLogo,
  uploadedLogo,
  CUSTOMER_LOGO_BOX,
} from "./customer-logo"
import type { CampaignBrief, CreativeSpec } from "./types"

function png(width: number, height: number, paint: (x: number, y: number) => [number, number, number, number]): Buffer {
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

const spec = {
  imageryRole: "crew",
  leadJob: "trust",
  layoutVariant: "type_primary_split",
  visualDirection: "A plumber at a water heater, face visible",
  headline: "The tank is ready",
  offer: "$150 off a water heater",
} as CreativeSpec

test("a mentioned logo is not treated as an uploaded file", () => {
  assert.equal(mentionsLogo("We already have a logo"), true)
  assert.equal(mentionsLogo("Book a water heater"), false)
  const brief: CampaignBrief = {
    otherRequirements: "Please use our logo",
    brandAssets: [{ id: "note", type: "logo", description: "our logo" }],
  }
  assert.equal(uploadedLogo(brief), null)
})

test("a png keeps its transparent pixels and an svg is refused", () => {
  const file = png(4, 2, (x) => (x < 2 ? [10, 20, 200, 255] : [0, 0, 0, 0]))
  const prepared = prepareCustomerLogo(file)
  assert.equal(prepared.ok, true)
  if (!prepared.ok) return
  const decoded = decodeRaster(prepared.logo.png, "png")
  assert.ok(decoded)
  assert.equal(decoded?.width, 4)
  assert.equal(decoded?.rgba[11], 0)
  assert.equal(prepareCustomerLogo(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>")).ok, false)
  assert.match(prepareCustomerLogo(Buffer.from("hello")).ok ? "" : (prepareCustomerLogo(Buffer.from("hello")) as { error: string }).error, /PNG or JPEG/)
})

test("a jpeg is stored as a png and a huge file is refused", () => {
  const jpeg = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAADAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD5cooor8qP79P/2Q==",
    "base64"
  )
  const prepared = prepareCustomerLogo(jpeg)
  assert.equal(prepared.ok, true)
  if (!prepared.ok) return
  assert.equal(prepared.logo.width, 8)
  assert.equal(prepared.logo.height, 3)
  assert.equal(decodeRaster(prepared.logo.png, "png")?.width, 8)
  const huge = Buffer.alloc(4 * 1024 * 1024 + 1, 1)
  const refused = prepareCustomerLogo(huge)
  assert.equal(refused.ok, false)
  if (refused.ok) return
  assert.match(refused.error, /4 MB/)
})

test("a chat rewrite keeps the uploaded logo file", () => {
  const current = [{ id: "logo-1", type: "logo" as const, description: "northline.png", fileUrl: "/api/studio-image/camp/logo-abcdef12.png" }]
  const merged = mergeBrandAssets(current, [{ id: "text", type: "other", description: "truck photo" }, { id: "words", type: "logo", description: "our logo" }])
  assert.equal(merged?.length, 2)
  assert.equal(merged?.[0]?.fileUrl, current[0]?.fileUrl)
  assert.equal(uploadedLogo({ brandAssets: merged })?.fileUrl, current[0]?.fileUrl)
})

test("the photograph prompt knows a real logo and does not change the photo cache key", () => {
  const plain = toImageBrief(spec, { campaign: { offer: "$150 off a water heater" } })
  const withLogo = toImageBrief(spec, {
    campaign: {
      offer: "$150 off a water heater",
      brandAssets: [{ id: "logo-1", type: "logo", description: "mark.png", fileUrl: "/api/studio-image/camp/logo-abcdef12.png" }],
    },
  })
  assert.ok(plain && withLogo)
  assert.equal(withLogo?.customerLogo, true)
  assert.equal(plain?.customerLogo, undefined)
  assert.equal(imageBriefFingerprint(withLogo!), imageBriefFingerprint(plain!))
  assert.match(buildOpenAIImagePrompt(withLogo!), /real logo file is placed on the card/)
  assert.doesNotMatch(buildOpenAIImagePrompt(plain!), /real logo file is placed/)
})

test("the logo box keeps a wide mark wide", () => {
  const placed = logoContainRect(CUSTOMER_LOGO_BOX, { width: 40, height: 10 })
  assert.ok(placed.w / placed.h > 3)
  assert.ok(placed.x >= CUSTOMER_LOGO_BOX.x)
  assert.ok(placed.y >= CUSTOMER_LOGO_BOX.y)
  assert.ok(placed.x + placed.w <= CUSTOMER_LOGO_BOX.x + CUSTOMER_LOGO_BOX.w + 0.001)
})

test("the print file draws the logo on the front and not as a stretched square", async () => {
  const mark = png(40, 10, () => [220, 10, 220, 255])
  const card = composeRoofingProCard({
    templateId: "roof_full_bleed",
    spec: { headline: "A dry roof", offer: "$500 off", phone: "(512) 555-0100", website: "example.com" },
    businessName: "Northline Roofing",
    qrPayload: "https://example.com",
  })
  const rendered = await renderStudioDesignPdf({
    card,
    copy: { businessName: "Northline Roofing", phone: "(512) 555-0100", website: "example.com", qrPayload: "https://example.com" },
    logo: { bytes: new Uint8Array(mark), width: 40, height: 10 },
  })
  const { execFile } = await import("node:child_process")
  const { mkdtemp, readFile, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const path = await import("node:path")
  const { promisify } = await import("node:util")
  const dir = await mkdtemp(path.join(tmpdir(), "logo-proof-"))
  try {
    const pdf = path.join(dir, "card.pdf")
    await writeFile(pdf, rendered.bytes)
    await promisify(execFile)("pdftoppm", ["-png", "-r", "72", "-f", "1", "-l", "1", pdf, path.join(dir, "front")])
    const raster = decodeRaster(await readFile(path.join(dir, "front-1.png")), "png")
    assert.ok(raster)
    let minX = raster!.width
    let maxX = 0
    let minY = raster!.height
    let maxY = 0
    let count = 0
    for (let y = 0; y < raster!.height; y += 1) {
      for (let x = 0; x < raster!.width; x += 1) {
        const index = (y * raster!.width + x) * 4
        const r = raster!.rgba[index] ?? 0
        const g = raster!.rgba[index + 1] ?? 0
        const b = raster!.rgba[index + 2] ?? 0
        if (r > 180 && b > 180 && g < 80) {
          count += 1
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minY = Math.min(minY, y)
          maxY = Math.max(maxY, y)
        }
      }
    }
    assert.ok(count > 20, "logo pixels are on the front")
    const ratio = (maxX - minX + 1) / Math.max(1, maxY - minY + 1)
    assert.ok(ratio > 2.5, `logo stayed wide (${ratio})`)
    assert.ok(minX < raster!.width * 0.35, "logo sits toward the left")
    assert.ok(minY < raster!.height * 0.4, "logo sits toward the top")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
