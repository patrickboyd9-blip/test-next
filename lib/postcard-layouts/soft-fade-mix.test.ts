import test from "node:test"
import assert from "node:assert/strict"
import { leanSoftFade, isSoftFadeTemplate } from "./assign"
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
      if (palette === "roofing") assert.equal(soft, 2)
    }
  })
}
