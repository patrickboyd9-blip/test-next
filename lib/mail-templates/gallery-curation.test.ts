import assert from "node:assert/strict"
import { test } from "node:test"

import sharp from "sharp"

import { getMailTemplate } from "./query"
import { galleryCategories, galleryCategoryBySlug } from "./gallery-categories"
import {
  GALLERY_KEEP_IDS,
  GALLERY_REDOS,
  galleryRedoPromptFailures,
  isListedBackgroundPhoto,
} from "./gallery-curation"
import { composeGalleryRedo, GALLERY_CARD_HEIGHT, GALLERY_CARD_WIDTH } from "./gallery-redo-compose"

test("the curated gallery lists three keeps and nine redos", () => {
  assert.equal(GALLERY_REDOS.length, 9)
  assert.equal(new Set(GALLERY_REDOS.map((redo) => redo.id)).size, 9)
  for (const id of GALLERY_KEEP_IDS) assert.equal(isListedBackgroundPhoto(id), true)
  for (const redo of GALLERY_REDOS) {
    assert.equal(isListedBackgroundPhoto(redo.id), true)
    assert.deepEqual(galleryRedoPromptFailures(redo), [])
    const template = getMailTemplate(redo.id)
    assert.ok(template)
    assert.equal(template?.spec.headline, redo.headline)
    assert.equal(template?.spec.offer, redo.offer)
    assert.equal(template?.name, redo.name)
  }
  assert.equal(isListedBackgroundPhoto("roofing-after-the-storm"), false)
  assert.equal(isListedBackgroundPhoto("auto-repair-scene-02"), false)
  const background = galleryCategories().flatMap((category) => category.photos).filter((photo) => photo.kind === "photo")
  assert.equal(background.length, 12)
  assert.equal(galleryCategoryBySlug("roofing")?.photos.length, 0)
  assert.equal(galleryCategories().some((category) => category.id === "roofing"), false)
})

test("a redo composite is a postcard-shaped jpeg", async () => {
  const photo = await sharp({
    create: { width: 80, height: 50, channels: 3, background: "#336699" },
  })
    .jpeg()
    .toBuffer()
  const redo = GALLERY_REDOS.find((item) => item.layout === "split")
  assert.ok(redo)
  const card = await composeGalleryRedo(photo, redo)
  const meta = await sharp(card).metadata()
  assert.equal(meta.format, "jpeg")
  assert.equal(meta.width, GALLERY_CARD_WIDTH)
  assert.equal(meta.height, GALLERY_CARD_HEIGHT)
  const [r, g, b] = await sharp(card)
    .extract({ left: 600, top: 750, width: 1, height: 1 })
    .raw()
    .toBuffer()
  assert.ok(b > r + 40 && b > g + 40, "the split photo must stay visible on the left")
})
