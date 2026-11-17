import assert from "node:assert/strict"
import { test } from "node:test"

import { headlineWordCount } from "@/lib/campaign-creator/headline-repair"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"

import { getMailTemplate, listMailTemplates } from "./query"
import { TEMPLATE_INDUSTRIES } from "./types"

test("the catalog has three mailers for each industry, stored as records", () => {
  const all = listMailTemplates()
  assert.equal(all.length, TEMPLATE_INDUSTRIES.length * 3)
  assert.equal(new Set(all.map((template) => template.id)).size, all.length)

  for (const industry of TEMPLATE_INDUSTRIES) {
    const group = listMailTemplates(industry)
    assert.equal(group.length, 3)
    for (const template of group) {
      assert.equal(template.industry, industry)
      assert.equal(template.size, "5x8")
      assert.ok(template.sampleBusinessName.length > 1)
      assert.ok(template.summary.length > 10)
      assert.equal(template.spec.backLayout, "standard_address")
      const words = headlineWordCount(template.spec.headline)
      assert.ok(words >= 3 && words <= 6, `${template.id} headline has ${words} words`)
    }
  }

  assert.equal(getMailTemplate("missing"), null)
  assert.equal(getMailTemplate("hvac-quiet-fix")?.spec.headline, "The Quiet Fix")
  assert.equal(listMailTemplates("dental").every((template) => template.industry === "dental"), true)
})

test("the v1 gallery covers eight industries with a traceable layout", async () => {
  const { galleryV1, GALLERY_V1_INDUSTRIES } = await import("./gallery-v1")
  const rows = galleryV1()
  assert.equal(rows.length, GALLERY_V1_INDUSTRIES.length * 3)
  for (const row of rows) {
    assert.ok(row.sourcePatternId?.startsWith("gold/"))
    assert.ok(row.layoutRecipe)
    assert.match(row.spec.phone, /555/)
    assert.equal(row.spec.backLayout, "standard_address")
    assert.doesNotMatch(row.spec.headline, /PostPilot|Design\.com/i)
  }
  const added = rows.filter((row) => row.industry === "auto_repair" || row.industry === "cleaning")
  for (const row of added) assert.match(row.spec.website, /\.example\//)
  const primaries = new Map<string, string>()
  for (const row of rows) {
    if (!primaries.has(row.industry)) primaries.set(row.industry, row.spec.palette?.[0] ?? "")
    const recipes = new Set(rows.filter((item) => item.industry === row.industry).map((item) => item.layoutRecipe))
    assert.ok(recipes.size >= 2, `${row.industry} needs more than one layout`)
  }
  assert.equal(new Set(primaries.values()).size, GALLERY_V1_INDUSTRIES.length)
})

test("template mailers keep the 5x8 and 6x9 print geometry", () => {
  const five = buildPostcard5x8PrintSpec()
  assert.equal(five.catalogId, "postcard_5x8")
  assert.equal(five.catalogVersion, 1)
  assert.equal(five.bleedInchesPerSide, 0.25)
  assert.equal(five.finishedTrimInches.widthInches, 8)
  assert.equal(five.finishedTrimInches.heightInches, 5)
  assert.equal(five.recommendedSafeTextInsetInches, 0.25)
  assert.ok(five.keepOuts.length > 0)

  const six = buildPostcard6x9PrintSpec()
  assert.equal(six.bleedInchesPerSide, 0.25)
  assert.equal(six.finishedTrimInches.widthInches, 9)
  assert.equal(six.finishedTrimInches.heightInches, 6)
  assert.equal(six.artworkCanvasInches.widthInches, 9.5)
  assert.equal(six.artworkCanvasInches.heightInches, 6.5)
  assert.equal(six.recommendedSafeTextInsetInches, 0.25)
  assert.ok(six.keepOuts.length > 0)
})
