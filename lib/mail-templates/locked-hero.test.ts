import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { galleryCategories, photoCountLabel } from "./gallery-categories"
import { getMailTemplate } from "./query"
import { lockedHeroDesign, lockedHeroMissing, type LockedHeroInput } from "./locked-hero"

const READY: LockedHeroInput = {
  campaignName: "  Spring tune-up  ",
  size: "5x8",
  businessName: "Harbor Roofing",
  offer: "Free roof inspection",
  callToAction: "Call to book a visit",
  phone: "(619) 555-0148",
  website: "",
  logoName: null,
}

test("a locked gallery picture keeps the customer's words and does not require a logo", () => {
  const template = getMailTemplate("roofing-after-the-storm")
  assert.ok(template)
  if (!template) return
  assert.equal(lockedHeroMissing({ ...READY, size: null }), "Choose a 5×8 or a 6×9 postcard.")
  assert.equal(lockedHeroMissing({ ...READY, businessName: "" }), "Add the business name.")
  assert.equal(lockedHeroMissing({ ...READY, offer: "" }), "Add the offer.")
  assert.equal(lockedHeroMissing({ ...READY, callToAction: "" }), "Add the call to action.")
  assert.equal(lockedHeroMissing({ ...READY, phone: "" }), "Add a phone number.")
  assert.equal(lockedHeroMissing(READY), null)
  const design = lockedHeroDesign(template, READY)
  assert.equal(design.photoLocked, true)
  assert.equal(design.photoId, template.id)
  assert.equal(design.logoName, null)
  assert.equal(design.offer, "Free roof inspection")
  assert.equal(design.headline, "Call to book a visit")
  assert.match(design.note, /picture stays/)
  assert.doesNotMatch(JSON.stringify(design), /gemini|openai|replicate|flux|anthropic/i)
})

test("gallery categories page through every photo, including a later set of 18", () => {
  const categories = galleryCategories()
  const roofing = categories.find((category) => category.id === "roofing")
  assert.ok(roofing)
  assert.ok(roofing.photos.length >= 1)
  assert.ok(roofing.photos.every((photo) => photo.src.startsWith("/gallery/")))
  assert.equal(photoCountLabel(2, 18), "3 of 18")
  assert.equal(photoCountLabel(0, roofing.photos.length), `1 of ${roofing.photos.length}`)
})

test("the gallery viewer and the print downloads are separate pages", () => {
  const gallery = readFileSync("app/app/templates/page.tsx", "utf8")
  const board = readFileSync("components/mail-gallery/GalleryBoard.tsx", "utf8")
  const prints = readFileSync("app/app/print-templates/page.tsx", "utf8")
  const sidebar = readFileSync("components/layout/AppSidebar.tsx", "utf8")
  const form = readFileSync("components/mail-gallery/LockedHeroMailer.tsx", "utf8")
  assert.match(gallery, /You have two options/)
  assert.doesNotMatch(gallery, /Download PDF/)
  assert.doesNotMatch(gallery, /Mailer Gallery/)
  assert.match(board, /Edit it myself/)
  assert.match(board, /Design it for me/)
  assert.match(board, /Previous photo/)
  assert.match(board, /Next photo/)
  assert.match(board, /data-photo-count/)
  assert.match(board, /ArrowRight/)
  assert.match(board, /onTouchEnd/)
  assert.match(prints, /Print Templates/)
  assert.match(prints, /Download PDF \(front and back\)/)
  assert.match(prints, /Figma/)
  assert.match(prints, /Canva/)
  assert.match(prints, /Photoshop/)
  assert.match(sidebar, /label: "Gallery", href: "\/app\/templates"/)
  assert.match(sidebar, /label: "Print Templates", href: "\/app\/print-templates"/)
  assert.match(form, /Highly recommended/)
  assert.match(form, /Business name/)
  assert.match(form, /Call to action/)
})
