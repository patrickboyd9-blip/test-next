import assert from "node:assert/strict"
import { test } from "node:test"

import { applyMockRefinement } from "./mock-refinement-engine"
import {
  applyPersonalizationToSpec,
  briefPatchFromPersonalization,
  personalizationFromPrompt,
} from "./prompt-personalization"
import type { CampaignBrief, CreativeSpec } from "./types"

const brief: CampaignBrief = {
  offer: "Free roof inspection",
  phone: "(619) 555-0148",
  website: "https://harborroofing.com/inspect",
  businessInfo: { name: "Harbor Roofing" },
}

const spec: CreativeSpec = {
  layoutVariant: "image_grounded",
  headline: "Free Roof Inspection",
  body: "Harbor Roofing looks at what can wait.",
  offer: "Free roof inspection",
  phone: "(619) 555-0148",
  website: "https://harborroofing.com/inspect",
  qrDestination: "https://harborroofing.com/inspect",
  visualDirection: "Rooflines after rain.",
  imagery: "stock_generic_local",
  imageryRole: "neighborhood",
  leadJob: "offer",
}

test("a chat prompt can name the business, phone, website, offer, and photo", () => {
  const prompt =
    "Our business is Apex Roofing and the phone is (512) 555-0199. " +
    "The website is apexroof.com and the offer is 20% off a tune-up. " +
    "Use a photo of a shaded condenser beside the house."

  const facts = personalizationFromPrompt(prompt)
  assert.equal(facts.businessName, "Apex Roofing")
  assert.equal(facts.phone, "(512) 555-0199")
  assert.equal(facts.website, "https://apexroof.com")
  assert.equal(facts.offer, "20% off a tune-up")
  assert.match(facts.photoDirection ?? "", /shaded condenser/)

  const next = applyPersonalizationToSpec(spec, brief, facts)
  assert.equal(next.body, "Apex Roofing looks at what can wait.")
  assert.equal(next.phone, "(512) 555-0199")
  assert.equal(next.website, "https://apexroof.com")
  assert.equal(next.offer, "20% off a tune-up")
  assert.match(next.visualDirection ?? "", /shaded condenser/)

  const patch = briefPatchFromPersonalization(brief, facts)
  assert.equal(patch?.businessInfo?.name, "Apex Roofing")
  assert.equal(patch?.phone, "(512) 555-0199")
  assert.equal(patch?.businessInfo?.phone, "(512) 555-0199")
})

test("the mock editor applies those facts onto the postcard", () => {
  const outcome = applyMockRefinement({
    brief,
    currentSpec: spec,
    prompt: "Our name is Apex Roofing and the phone is (512) 555-0100.",
  })
  assert.equal(outcome.kind, "success")
  if (outcome.kind !== "success") return
  assert.equal(outcome.spec.body, "Apex Roofing looks at what can wait.")
  assert.equal(outcome.spec.phone, "(512) 555-0100")
})

test("a layout-only prompt does not invent contact details", () => {
  const facts = personalizationFromPrompt("Make the headline bigger")
  assert.deepEqual(facts, {})
  assert.equal(briefPatchFromPersonalization(brief, facts), null)
})
