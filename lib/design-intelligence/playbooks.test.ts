import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { GOLD_INDUSTRIES, industryForBrief } from "@/lib/research-library/industry"
import { tradePalette } from "@/lib/postcard-layouts/trade-palettes"
import { contrastRatio } from "@/lib/postcard-layouts/palette"
import { offerPhotoSubject } from "@/lib/campaign-creator/offer-photo-subject"

import { emotionByOfferGuidance, emotionRowForBrief } from "./emotion-by-offer"
import { offerRowFor, playbookFor, playbookSlugFor, PLAYBOOK_SLUGS } from "./playbooks"
import { isFillerSubline, offerSubline } from "./trade-subline"

const brief = (name: string, offer: string, goal = ""): CampaignBrief =>
  ({ offer, goal, businessInfo: { name, city: "Austin" } }) as unknown as CampaignBrief

test("every synced playbook file is loaded (no hand-kept list)", () => {
  const files = readdirSync(join(process.cwd(), "lib/design-intelligence/playbooks")).filter((f) => f.endsWith(".json"))
  assert.equal(PLAYBOOK_SLUGS.length, files.length)
  assert.ok(PLAYBOOK_SLUGS.length >= 35)
  for (const slug of PLAYBOOK_SLUGS) assert.ok(playbookFor(slug)!.emotion_by_offer.length > 0, slug)
})

test("every playbook slug is a gold industry", () => {
  for (const slug of PLAYBOOK_SLUGS) assert.ok((GOLD_INDUSTRIES as readonly string[]).includes(slug), slug)
})

test("app verticals map to playbooks", () => {
  assert.equal(playbookSlugFor("real_estate"), "real-estate-agents")
  assert.equal(playbookSlugFor("pest"), "pest-control")
  assert.equal(playbookSlugFor("medicare_insurance"), "medicare")
  assert.equal(playbookSlugFor("final_expense"), "life-insurance")
  assert.equal(playbookSlugFor("med_spa"), "med-spa-chiro")
  assert.equal(playbookSlugFor("dental"), "dental")
  assert.equal(playbookSlugFor("general_local_service"), null)
})

test("a realtor with a cleaning credit stays real estate", () => {
  const b = brief("Summit Key Real Estate", "Free pre-listing cleaning credit up to $500", "Win listing appointments")
  assert.equal(industryForBrief(b), "real-estate-agents")
  assert.equal(emotionRowForBrief(b)!.slug, "real-estate-agents")
})

test("offer type picks the matching emotion_by_offer row", () => {
  assert.equal(offerRowFor(playbookFor("dental")!, "New patient special: $79 exam, cleaning and x-rays").offer_type, "new_patient_special")
  assert.equal(offerRowFor(playbookFor("pest-control")!, "Free termite inspection").offer_type, "free_inspection")
  assert.equal(offerRowFor(playbookFor("real-estate-agents")!, "Free home valuation").offer_type, "free_home_valuation_cma")
  const guidance = emotionByOfferGuidance(brief("Bug Busters Pest Control", "Free termite inspection"))
  assert.match(guidance, /pest-control/)
  assert.match(guidance, /Lead emotion \(required\)/)
  assert.match(guidance, /Never print/)
})

test("non-roofing trades get their own palette with readable offer ink", () => {
  const roof = tradePalette("roofing")
  for (const slug of PLAYBOOK_SLUGS.filter((s) => s !== "roofing")) {
    const p = tradePalette(slug)
    assert.ok(p.offerTile !== roof.offerTile || p.field !== roof.field, slug)
    assert.ok(contrastRatio(p.offerInk, p.offerTile) >= 4.5, `${slug} offer ink`)
  }
})

test("offer decides the photo subject", () => {
  assert.match(offerPhotoSubject("plumbing", "$300 off a new water heater")!, /water heater/)
  assert.match(offerPhotoSubject("real-estate-agents", "Free home valuation")!, /exterior/)
  assert.match(offerPhotoSubject("dental", "$79 new patient exam")!, /operatory/)
  assert.equal(offerPhotoSubject("roofing", "$500 off a roof"), null)
})

test("sublines are offer-specific, never filler", () => {
  assert.ok(isFillerSubline("Call today."))
  assert.ok(!isFillerSubline("Hot showers again, installed and hauled away the same day."))
  const line = offerSubline({ brief: brief("Rapid Rooter Plumbing", "$300 off a new water heater"), seed: 0 })
  assert.ok(!isFillerSubline(line))
  assert.match(line, /hot|water|shower/i)
})
