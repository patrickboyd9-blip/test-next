import assert from "node:assert/strict"
import { test } from "node:test"

import { headlineWordCount } from "@/lib/campaign-creator/headline-repair"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"

import { getMailTemplate, listMailTemplates } from "./query"
import { TEMPLATE_INDUSTRIES } from "./types"

test("the catalog has three mailers for each industry, stored as records", () => {
  const all = listMailTemplates()
  const addressed = all.filter((template) => template.size === "5x8")
  const eddm = all.filter((template) => template.size !== "5x8")
  assert.equal(addressed.length, TEMPLATE_INDUSTRIES.length * 3)
  assert.equal(new Set(all.map((template) => template.id)).size, all.length)
  assert.ok(eddm.some((template) => template.size === "6.5x9"))
  assert.ok(eddm.some((template) => template.size === "6.25x11"))

  for (const industry of TEMPLATE_INDUSTRIES) {
    const group = listMailTemplates(industry).filter((template) => template.size === "5x8")
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
  for (const template of eddm) {
    assert.equal(template.spec.backLayout, "eddm_postal_customer")
    assert.equal(template.spec.layoutHints?.templateId !== undefined, true)
    const words = headlineWordCount(template.spec.headline)
    assert.ok(words >= 3 && words <= 6, `${template.id} headline has ${words} words`)
    assert.doesNotMatch(`${template.spec.headline} ${template.spec.body}`, /\bDear\b|\{\{/)
  }

  assert.equal(getMailTemplate("missing"), null)
  assert.equal(getMailTemplate("hvac-quiet-fix")?.spec.headline, "The Quiet Fix")
  assert.equal(listMailTemplates("dental").every((template) => template.industry === "dental"), true)
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
