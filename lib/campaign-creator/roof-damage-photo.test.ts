import assert from "node:assert/strict"
import { test } from "node:test"

import { composeRoofingProCard } from "@/lib/roofing-pro/compose"
import { addressSideContentRect } from "@/lib/print-spec/address-side-content"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { isSoftFadeBack } from "./address-side-layout"
import { roofDamageInHeadline, roofDamagePhotoMismatch, roofDamageScene } from "./roof-damage-photo"

test("damage headlines are detected", () => {
  assert.equal(roofDamageInHeadline("Curling Shingles Get Worse Fast"), "curling")
  assert.equal(roofDamageInHeadline("Hail hit Oklahoma City hard."), "hail")
  assert.equal(roofDamageInHeadline("Storm season is coming"), "storm")
  assert.equal(roofDamageInHeadline("Moss is eating your roof"), "moss")
  assert.equal(roofDamageInHeadline("Real savings on a new roof."), null)
  assert.equal(roofDamageInHeadline("A free look, no pressure, no pitch."), null)
})

test("the damage scene passes the check and a new-roof prompt fails it", () => {
  assert.equal(roofDamagePhotoMismatch("Curling Shingles Get Worse Fast", roofDamageScene("curling")), null)
  assert.match(
    roofDamagePhotoMismatch("Curling Shingles Get Worse Fast", "A house with a clean, freshly installed dark charcoal architectural shingle roof") ?? "",
    /curling/
  )
  assert.equal(roofDamagePhotoMismatch("Real savings on a new roof.", "freshly installed roof"), null)
})

test("fade roofing fronts get a soft-fade back that stays out of the address zone", () => {
  const card = composeRoofingProCard({
    templateId: "roof_full_bleed",
    size: "5x8",
    spec: { headline: "Real savings on a new roof.", offer: "$500 off a full roof replacement", phone: "(512) 555-0190", website: "example.com" },
    businessName: "Hernandez Roofing",
    license: "TX 123",
  })
  assert.equal(isSoftFadeBack(card.back), true)
  const spec = buildPostcard5x8PrintSpec()
  const content = addressSideContentRect(spec)
  const right = content.xInches - spec.bleedInchesPerSide + content.widthInches
  for (const slot of card.back.photos) assert.ok(slot.rect.x + slot.rect.w <= right + 0.01)
  // The headline band may use the free strip above the mailing panel, never the panel or barcode.
  const hits = (r: { x: number; y: number; w: number; h: number }) => spec.keepOuts.some((k) => r.x < k.trim.xInches + k.trim.widthInches && r.x + r.w > k.trim.xInches && r.y < k.trim.yInches + k.trim.heightInches && r.y + r.h > k.trim.yInches)
  for (const shape of card.back.shapes.filter((item) => item.role !== "paper" && item.rect.x >= right - 0.01)) assert.equal(hits(shape.rect), false, shape.id)
  for (const text of card.back.texts) assert.ok(text.rect.x + text.rect.w <= right + 0.01 || !hits(text.rect), text.text)
  assert.ok(card.back.texts.some((text) => text.role === "headline" && text.rect.x >= right))
  assert.ok(card.back.texts.some((text) => text.role === "offer"))
  assert.ok(card.back.texts.some((text) => text.role === "contact"))
})

test("coupon fronts get the soft-fade back too (no cream backs)", () => {
  const card = composeRoofingProCard({
    templateId: "roof_coupon",
    size: "5x8",
    spec: { headline: "Real savings.", offer: "$500 off", phone: "(512) 555-0190", website: "example.com" },
    businessName: "Hernandez Roofing",
  })
  assert.equal(isSoftFadeBack(card.back), true)
})

test("damage front starts the fade lower; voted-out headline never returns; editor defaults follow soft-fade", async () => {
  const { distinctRoofingHeadlines } = await import("@/lib/design-intelligence/persuasion")
  const lines = distinctRoofingHeadlines({ headlines: ["Roof work in Tacoma, priced to save."], offer: "$1,500 off a full roof replacement", businessName: "Acme Roofing" })
  assert.ok(!/priced to save/i.test(lines[0]!))
  const a = distinctRoofingHeadlines({ headlines: ["", ""], offer: "$1,500 off a full roof replacement", businessName: "Acme Roofing" })
  const b = distinctRoofingHeadlines({ headlines: ["", ""], offer: "$1,500 off a full roof replacement", businessName: "Summit Roof Co" })
  assert.equal(a.length, 2); assert.equal(b.length, 2)
  const { defaultBackSections } = await import("@/lib/campaign-creator/soft-fade-back")
  assert.equal(defaultBackSections(true).photo, true)
  assert.equal(defaultBackSections(false).photo, false)
})
