import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { test } from "node:test"

import { galleryCategories, galleryCategoryBySlug } from "./gallery-categories"
import {
  FINISHED_INDUSTRY_LABELS,
  finishedGalleryPhotos,
  finishedGalleryRecords,
  galleryIndustryLabel,
} from "./gallery-finished"
import { galleryPhotoSrc } from "./gallery-photo-src"
import { getMailTemplate, listMailTemplates } from "./query"

const BLOB_HOST = "o1at7qxja3v9ya7m.public.blob.vercel-storage.com"
const RISKY_IDS = ["MM-bakery-005", "MM-home-security-019", "MM-plumbing-005"]

function assertGalleryPicture(url: string) {
  assert.equal(url.includes(" "), false)
  if (url.startsWith("/gallery/")) {
    assert.match(url, /^\/gallery\/[a-z0-9-]+\.jpg$/)
    assert.equal(existsSync(`public${url}`), true, url)
    return
  }
  assert.match(url, new RegExp(`^https://${BLOB_HOST}/gallery/v2/.+\\.jpg$`))
}

test("finished gallery records load with an industry label and an https picture", () => {
  const records = finishedGalleryRecords()
  assert.equal(records.length, 152)
  assert.equal(new Set(records.map((record) => record.id)).size, 152)
  assert.equal(listMailTemplates().some((template) => template.id.startsWith("MM-")), false)

  for (const record of records) {
    assert.match(record.id, /^MM-[a-z0-9-]+$/)
    assert.equal(typeof FINISHED_INDUSTRY_LABELS[record.industry], "string", record.industry)
    const label = galleryIndustryLabel(record.industry)
    assert.notEqual(label, record.industry)
    assert.match(label, /^[A-Z]/)
    assertGalleryPicture(record.url)
    if (record.back_url) assertGalleryPicture(record.back_url)
    assert.ok(record.width > 0)
    assert.ok(record.height > 0)
    assert.equal(galleryPhotoSrc(record.id), record.url)

    const template = getMailTemplate(record.id)
    assert.ok(template)
    assert.equal(template.size, "5x8")
    assert.equal(template.spec.backLayout, "standard_address")
    if (record.name) {
      assert.equal(template.name, record.name)
      assert.equal(template.summary, record.summary)
    } else {
      assert.match(template.name, /^Postcard \d+$/)
    }
    assert.equal(template.sampleBusinessName, "Local business")
  }

  const risky = records.filter((record) => record.name_risk)
  assert.deepEqual(
    risky.map((record) => record.id).sort(),
    [...RISKY_IDS].sort(),
  )
  assert.ok(risky.every((record) => (record.name_risk ?? "").length > 10))
})

test("finished photos join the gallery by industry and hide internal fields", () => {
  const records = finishedGalleryRecords()
  const photos = finishedGalleryPhotos()
  assert.equal(photos.length, 152)
  const categories = galleryCategories()
  const listed = new Set(categories.map((category) => category.id))
  const byId = new Map(photos.map((photo) => [photo.id, photo]))

  for (const record of records) {
    const photo = byId.get(record.id)
    assert.ok(photo)
    const industry = record.industry.replaceAll("-", "_")
    assert.equal(photo.industry, industry)
    assert.ok(listed.has(photo.industry), photo.industry)
    assert.equal(galleryCategoryBySlug(record.industry)?.id, photo.industry)
    if (record.url.startsWith("/gallery/")) {
      assert.match(photo.src, /^\/gallery\//)
    } else {
      assert.match(photo.src, /^https:\/\//)
    }
    if (record.name) {
      assert.equal(photo.name, record.name)
      assert.equal(photo.summary, record.summary)
    } else {
      assert.match(photo.name, /^Postcard \d+$/)
    }
    assert.doesNotMatch(photo.name, /name_risk|source_research|source_front|GOLD-/)
    assert.doesNotMatch(photo.summary, /name_risk|source_research|source_front|GOLD-/)
    assert.equal(photo.name.includes(record.fictional_brand_name), false)
    assert.equal(photo.summary.includes(record.fictional_brand_name), false)
    if (record.name_risk) {
      assert.equal(photo.name.includes(record.name_risk), false)
      assert.equal(photo.summary.includes(record.name_risk), false)
    }
    assert.equal(photo.kind, "finished")
    const keys = ["id", "industry", "kind", "name", "src", "summary"]
    if (record.back_url) {
      keys.push("backSrc")
      assert.equal(photo.backSrc, record.back_url)
    }
    assert.deepEqual(Object.keys(photo).sort(), keys.sort())
  }

  const eye = galleryCategoryBySlug("optometry")?.photos.find((photo) => photo.id === "MM-optometry-see-clearly")
  assert.equal(eye?.name, "See Clearly")
  assert.equal(eye?.summary, "A dark eye-care card for an annual exam and new frames.")
  assert.equal(eye?.src, "/gallery/optometry-see-clearly.jpg")
  assert.equal(eye?.backSrc, "/gallery/optometry-see-clearly-back.jpg")
  const fitness = galleryCategoryBySlug("gyms-fitness")?.photos.find((photo) => photo.id === "MM-gyms-fitness-stronger-together")
  assert.equal(fitness?.name, "Stronger Together")
  assert.equal(fitness?.backSrc, "/gallery/gyms-fitness-stronger-together-back.jpg")
  const retail = galleryCategoryBySlug("consumer-products")?.photos.find((photo) => photo.id === "MM-consumer-products-made-for-home")
  assert.equal(retail?.name, "Made for Home")
  assert.equal(retail?.backSrc, "/gallery/consumer-products-made-for-home-back.jpg")

  const vet = galleryCategoryBySlug("vet-pet")
  assert.equal(vet?.label, "Vet & Pet")
  assert.equal(vet?.photos.length, 3)
  assert.deepEqual(
    vet?.photos.map((photo) => photo.name),
    ["Postcard 1", "Postcard 2", "Postcard 3"],
  )

  const catalogLabels = ["HVAC", "Restaurant", "Dental", "Real estate", "Auto repair"]
  const expected = [...new Set([...catalogLabels, ...Object.values(FINISHED_INDUSTRY_LABELS)])].sort((a, b) =>
    a.localeCompare(b, "en"),
  )
  assert.deepEqual(
    categories.map((category) => category.label).sort((a, b) => a.localeCompare(b, "en")),
    expected,
  )
  assert.equal(categories.length, expected.length)
})

test("the blob host is allowed for next image requests", () => {
  const config = readFileSync("next.config.ts", "utf8")
  assert.match(config, /o1at7qxja3v9ya7m\.public\.blob\.vercel-storage\.com/)
  assert.match(config, /remotePatterns/)
})
