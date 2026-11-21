import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { galleryCategories } from "./gallery-categories"
import { FINISHED_GALLERY_KIND, finishedGalleryPhotos } from "./gallery-finished"
import { galleryPhotoActions } from "./gallery-actions"

test("finished postcards hide edit-myself and offer change the words", () => {
  const finished = galleryPhotoActions("finished")
  assert.equal(finished.editMyself, false)
  assert.equal(finished.changeWords, true)
  assert.equal(finished.designForMe, true)

  const photo = galleryPhotoActions("photo")
  assert.equal(photo.editMyself, true)
  assert.equal(photo.changeWords, false)
  assert.equal(photo.designForMe, true)
  assert.equal(galleryPhotoActions(undefined).editMyself, true)
})

test("the finished data flag is on every finished picture and not on empty scenes", () => {
  const finished = finishedGalleryPhotos()
  assert.ok(finished.length > 100)
  assert.ok(finished.every((item) => item.kind === FINISHED_GALLERY_KIND))
  const file = JSON.parse(readFileSync("lib/mail-templates/gallery-finished.json", "utf8")) as { kind: string }
  assert.equal(file.kind, "finished")

  const categories = galleryCategories()
  const scenes = categories.flatMap((category) => category.photos).filter((item) => item.kind === "photo")
  const cards = categories.flatMap((category) => category.photos).filter((item) => item.kind === "finished")
  assert.ok(scenes.length > 0)
  assert.equal(cards.length, finished.length)
  assert.ok(scenes.every((item) => galleryPhotoActions(item.kind).editMyself))
  assert.ok(cards.every((item) => galleryPhotoActions(item.kind).changeWords && !galleryPhotoActions(item.kind).editMyself))
})

test("the gallery hides edit-myself for finished cards and shows Change the words", () => {
  const board = readFileSync("components/mail-gallery/GalleryBoard.tsx", "utf8")
  const form = readFileSync("components/mail-gallery/ChangeTheWords.tsx", "utf8")
  assert.match(board, /galleryPhotoActions/)
  assert.match(board, /actions\.editMyself \?/)
  assert.match(board, /Use this photo to edit myself/)
  assert.match(board, /actions\.changeWords \?/)
  assert.match(board, /Change the words/)
  assert.match(board, /Use this and have the AI make edits for me/)
  assert.match(form, /Business name/)
  assert.match(form, /Headline or offer/)
  assert.match(form, /Phone/)
  assert.match(form, /Website/)
  assert.match(form, /Extra line/)
  assert.match(form, /Replace the existing logo/)
  assert.match(form, /Top left/)
  assert.match(form, /Accept this proof/)
  assert.match(form, /Try again/)
  assert.doesNotMatch(`${board}\n${form}`, /gemini|openai|anthropic|flux|qwen|seedream|nano banana|\$\d/i)
})
