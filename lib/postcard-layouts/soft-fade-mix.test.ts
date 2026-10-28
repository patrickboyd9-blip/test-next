import test from "node:test"
import assert from "node:assert/strict"
import { leanSoftFade, isSoftFadeTemplate, verticalPaletteForBrief } from "./assign"
import { isRoofingProTemplate } from "@/lib/roofing-pro/ids"
import { industryForBrief } from "@/lib/research-library/industry"
import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { templatesForPalette } from "./templates"
import type { PostcardTemplateId } from "./ids"

for (const palette of ["roofing", "hvac", "plumbing", "general"]) {
  test(`${palette}: a three-direction set leans soft-fade but is not all one style`, () => {
    const allowed = templatesForPalette(palette)
    const hard = allowed.filter((id) => !isSoftFadeTemplate(id))
    for (const start of [hard.slice(0, 3), allowed.filter(isSoftFadeTemplate).concat(allowed).slice(0, 3)]) {
      const chosen = new Map<number, PostcardTemplateId>(start.map((id, i) => [i, id]))
      while (chosen.size < 3) chosen.set(chosen.size, allowed[0]!)
      leanSoftFade([0, 1, 2], chosen, allowed)
      const soft = [...chosen.values()].filter(isSoftFadeTemplate).length
      assert.ok(soft >= 1, `${palette} has a soft fade`)
      assert.ok(soft < 3, `${palette} is not 100% soft fade`)
      assert.equal(soft, 2, `${palette} leans 2 of 3 soft fade`)
    }
  })
}

test("a soft fade assigned to any trade renders through the photo-fade composer", () => {
  for (const palette of ["hvac", "plumbing", "general", "real_estate"]) {
    const fades = templatesForPalette(palette).filter(isSoftFadeTemplate)
    assert.ok(fades.length >= 2, palette)
    for (const id of fades) assert.ok(isRoofingProTemplate(id), `${palette} ${id}`)
  }
})

test("storm and hail restoration businesses are roofing", () => {
  for (const text of ["Red River Storm Restoration", "Free hail damage check", "Storm damage repair"]) {
    const brief = { goal: "Book an inspection", offer: "Free inspection", businessInfo: { name: text } } as CampaignBrief
    assert.equal(verticalPaletteForBrief(brief), "roofing", text)
    assert.equal(industryForBrief(brief), "roofing", text)
  }
})
