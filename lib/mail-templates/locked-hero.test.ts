import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { galleryCategories, galleryCategoryBySlug, galleryIndustrySlug, photoCountLabel } from "./gallery-categories"
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
  assert.equal(roofing.photos.length, 21)
  assert.ok(roofing.photos.some((photo) => photo.id === "roofing-scene-18"))
  assert.equal(categories.reduce((count, category) => count + category.photos.length, 0), 317)
  assert.ok(roofing.photos.every((photo) => photo.src.startsWith("/gallery/")))
  assert.equal(photoCountLabel(2, 18), "3 of 18")
  assert.equal(photoCountLabel(0, roofing.photos.length), `1 of ${roofing.photos.length}`)
})

test("each industry with photos has its own gallery page", () => {
  const categories = galleryCategories()
  assert.deepEqual(
    categories.slice(0, 8).map((category) => category.label),
    ["Roofing", "HVAC", "Restaurant", "Dental", "Real estate", "Landscaping", "Auto repair", "Cleaning"]
  )
  assert.equal(categories.length, 39)
  assert.equal(galleryIndustrySlug("auto_repair"), "auto-repair")
  assert.equal(galleryIndustrySlug("vet_pet"), "vet-pet")
  assert.equal(galleryCategoryBySlug("roofing")?.photos.length, 21)
  assert.equal(galleryCategoryBySlug("auto-repair")?.id, "auto_repair")
  assert.equal(galleryCategoryBySlug("real-estate")?.label, "Real estate")
  assert.equal(galleryCategoryBySlug("plumbing")?.photos.length, 5)
  assert.equal(galleryCategoryBySlug("vet-pet")?.label, "Vet & Pet")
  assert.equal(galleryCategoryBySlug("med-spa-chiro")?.label, "Med Spa & Chiro")
  assert.equal(galleryCategoryBySlug("tutoring-childcare")?.label, "Tutoring & Childcare")
  assert.equal(galleryCategoryBySlug("retail-grand-openings")?.label, "Retail & Grand Openings")
  assert.equal(galleryCategoryBySlug("../roofing"), null)
  assert.equal(galleryCategoryBySlug("not-a-trade"), null)
  const index = readFileSync("components/mail-gallery/GalleryIndex.tsx", "utf8")
  const industry = readFileSync("app/app/templates/[industry]/page.tsx", "utf8")
  const alphabetical = [...categories].sort((a, b) => a.label.localeCompare(b.label, "en")).map((category) => category.label)
  assert.deepEqual(alphabetical.slice(0, 3), ["Auto insurance", "Auto repair", "Bakery"])
  assert.ok(alphabetical.includes("Vet & Pet"))
  assert.equal(alphabetical.length, categories.length)
  assert.match(index, /localeCompare/)
  assert.match(index, /flex-wrap/)
  assert.match(index, /\/app\/templates\//)
  assert.match(index, /photos/)
  assert.doesNotMatch(index, /<img/)
  assert.match(industry, /\n {8}Back\n/)
  assert.match(industry, /href="\/app\/templates"/)
  assert.match(industry, /GalleryBoard/)
})

test("the gallery viewer and the print downloads are separate pages", () => {
  const gallery = readFileSync("app/app/templates/page.tsx", "utf8")
  const board = readFileSync("components/mail-gallery/GalleryBoard.tsx", "utf8")
  const prints = readFileSync("app/app/print-templates/page.tsx", "utf8")
  const sidebar = readFileSync("components/layout/AppSidebar.tsx", "utf8")
  const form = readFileSync("components/mail-gallery/LockedHeroMailer.tsx", "utf8")
  assert.match(gallery, /<h1[^>]*>Gallery<\/h1>/)
  assert.match(
    gallery,
    /We've already hand-picked hundreds of standout mailer photos for every industry, so your next postcard is a few clicks away instead of a blank page\./
  )
  assert.match(gallery, /How It Works/)
  assert.match(
    gallery,
    /You have two options\. Pick a photo and edit it yourself, or pick a photo and have us design the mailer for you\. Nothing is mailed from this page\./
  )
  assert.ok(gallery.indexOf("hand-picked hundreds") < gallery.indexOf("How It Works"))
  assert.ok(gallery.indexOf("How It Works") < gallery.indexOf("You have two options"))
  assert.match(gallery, /GalleryIndex/)
  assert.doesNotMatch(gallery, /GalleryBoard/)
  assert.doesNotMatch(gallery, /Download PDF/)
  assert.doesNotMatch(gallery, /Mailer Gallery/)
  assert.match(board, /Use this photo to edit myself/)
  assert.match(board, /Use this and have the AI make edits for me/)
  assert.match(board, /whitespace-normal/)
  assert.match(board, /flex-col gap-2 sm:flex-row/)
  assert.doesNotMatch(board, /Edit it myself/)
  assert.doesNotMatch(board, /Design it for me/)
  assert.match(form, /Use this and have the AI make edits for me/)
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
  assert.match(prints, /Using our plugins/)
  assert.match(prints, /Adobe Express/)
  assert.match(prints, /InDesign/)
  assert.match(prints, /Coming soon/)
  assert.match(prints, /Upload my finished design/)
  assert.match(prints, /\/app\/campaigns\/new\?path=upload/)
  assert.doesNotMatch(prints, /Start a campaign/)
  assert.doesNotMatch(prints, /https?:\/\/[^\s"']*(figma|canva|adobe)/i)
  const created = readFileSync("app/app/campaigns/new/page.tsx", "utf8")
  const editor = readFileSync("app/app/campaigns/[id]/page.tsx", "utf8")
  assert.match(created, /path === "upload"/)
  assert.match(created, /\?start=upload/)
  assert.match(editor, /start === "upload" \? "upload"/)
  assert.match(sidebar, /label: "Gallery", href: "\/app\/templates"/)
  assert.match(sidebar, /label: "Print Templates", href: "\/app\/print-templates"/)
  assert.match(form, /Highly recommended/)
  assert.match(form, /Business name/)
  assert.match(form, /Call to action/)
})
