import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { getMailTemplate } from "./query"
import { lockedHeroDesign, lockedHeroReady } from "./locked-hero"

test("a locked gallery picture is not replaced by a sample design", () => {
  const template = getMailTemplate("roofing-after-the-storm")
  assert.ok(template)
  if (!template) return
  assert.equal(lockedHeroReady("  Spring  ", null), false)
  assert.equal(lockedHeroReady("Spring tune-up", "5x8"), true)
  const design = lockedHeroDesign(template, "  Spring tune-up  ", "5x8")
  assert.equal(design.photoLocked, true)
  assert.equal(design.photoId, template.id)
  assert.equal(design.headline, template.spec.headline)
  assert.match(design.note, /picture stays/)
  assert.doesNotMatch(JSON.stringify(design), /gemini|openai|replicate|flux|anthropic/i)
})

test("the gallery card offers both choices before any later screen", () => {
  const source = readFileSync("components/mail-gallery/GalleryBoard.tsx", "utf8")
  assert.match(source, /Edit it myself/)
  assert.match(source, /Design it for me/)
  assert.match(source, /\/app\/mail\?hero=/)
  assert.match(source, /data-gallery-card/)
})
