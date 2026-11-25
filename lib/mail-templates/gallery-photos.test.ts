import assert from "node:assert/strict"
import { test } from "node:test"

import { isListedBackgroundPhoto } from "./gallery-curation"
import { galleryPhotoSrc } from "./gallery-photo-src"
import {
  GALLERY_PHOTO_COUNT,
  GALLERY_PHOTO_ESTIMATE_CENTS,
  GALLERY_PHOTO_HARD_CAP_CENTS,
  GALLERY_PHOTO_STOP_CENTS,
  gallerySpendAfter,
  gallerySpendDecision,
  planGalleryPhotos,
  usdFromCents,
} from "./gallery-photos"

test("the gallery plans one photo for each of the 24 templates", () => {
  const jobs = planGalleryPhotos()
  assert.equal(jobs.length, GALLERY_PHOTO_COUNT)
  assert.equal(new Set(jobs.map((job) => job.templateId)).size, GALLERY_PHOTO_COUNT)
  for (const job of jobs) {
    assert.equal(job.publicPath, `/gallery/${job.templateId}.jpg`)
    assert.match(job.prompt, /Do not crop a face/)
    assert.match(job.prompt, /No logos and no lettering/)
    assert.match(job.prompt, /\bno people\b/i)
    assert.match(job.prompt, /single photograph, one scene, not a collage, no split screen/i)
    assert.doesNotMatch(job.prompt, /Sample\./)
    assert.equal(galleryPhotoSrc(job.templateId), isListedBackgroundPhoto(job.templateId) ? job.publicPath : null)
  }
  assert.equal(galleryPhotoSrc("not-a-template"), null)
})

test("the spend cap stops at $6.50 and will not start a photo past $7", () => {
  assert.equal(GALLERY_PHOTO_STOP_CENTS, 650)
  assert.equal(GALLERY_PHOTO_HARD_CAP_CENTS, 700)
  assert.equal(GALLERY_PHOTO_ESTIMATE_CENTS, 15)
  assert.equal(gallerySpendDecision(0, 4), "ok")
  assert.equal(gallerySpendDecision(648, 4), "stop")
  assert.equal(gallerySpendDecision(650, 4), "stop")
  assert.equal(gallerySpendDecision(698, 4), "ceiling")
  assert.equal(gallerySpendDecision(700, 4), "ceiling")
  assert.equal(gallerySpendAfter(0, 4).decision, "ok")
  assert.equal(gallerySpendAfter(648, 4).decision, "stop")
  assert.equal(gallerySpendAfter(698, 4).spentCents, 702)
  assert.equal(gallerySpendAfter(698, 4).decision, "ceiling")
  assert.equal(usdFromCents(96), "0.96")
  const all = GALLERY_PHOTO_COUNT * GALLERY_PHOTO_ESTIMATE_CENTS
  assert.equal(gallerySpendDecision(0, all), "ok")
  assert.ok(all < GALLERY_PHOTO_STOP_CENTS)
})
