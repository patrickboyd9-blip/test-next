import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import type { CampaignBrief } from "@/lib/campaign-creator/types"

import { LIST_RESPONSE_BANDS, RESPONSE_ESTIMATE_DISCLAIMER } from "./assumptions"
import { estimateResponse } from "./estimate"

const roofingProspect: CampaignBrief = {
  goal: "Book roof inspections",
  offer: "A spring checkup",
  primarySuccessMetric: { type: "phone_call", description: "Calls from the postcard" },
  audience: {
    description: "Homeowners within 5 miles of 92025",
    quantity: 2_000,
    quantityKind: "requested",
    listType: "prospect",
  },
}

test("a prospect roofing mailing of 2,000 cards is a range, not a promise", () => {
  const estimate = estimateResponse(roofingProspect)

  assert.equal(estimate.lowCount, 4)
  assert.equal(estimate.highCount, 12)
  assert.match(estimate.headline, /Expect roughly 4–12 calls from 2,000 cards/)
  assert.match(estimate.quantityNote, /not a counted list/)
  assert.match(estimate.why, /prospect list/i)
  assert.match(estimate.disclaimer, /vary/)
  assert.match(estimate.disclaimer, /not a guarantee/)
  assert.equal(estimate.disclaimer, RESPONSE_ESTIMATE_DISCLAIMER)
  assert.doesNotMatch(estimate.headline, /guarantee|will get|promised/i)
})

test("the range stays a range when the count would otherwise collapse", () => {
  const estimate = estimateResponse({
    ...roofingProspect,
    audience: { ...roofingProspect.audience!, quantity: 1, listType: "every_door" },
  })
  assert.ok(estimate.highCount > estimate.lowCount)
  assert.match(estimate.headline, /\d+–\d+/)
})

test("a missing quantity does not invent a campaign total", () => {
  const estimate = estimateResponse({
    ...roofingProspect,
    audience: { description: "Homeowners", listType: "prospect" },
  })
  assert.match(estimate.headline, /per 1,000 cards/)
  assert.match(estimate.quantityNote, /not set/)
  assert.doesNotMatch(estimate.headline, /from \d/)
})

test("house lists sit above prospect lists, and Every Door sits below", () => {
  const house = estimateResponse({
    ...roofingProspect,
    audience: { ...roofingProspect.audience!, listType: "house" },
  })
  const prospect = estimateResponse(roofingProspect)
  const everyDoor = estimateResponse({
    ...roofingProspect,
    audience: { ...roofingProspect.audience!, listType: "every_door" },
  })
  assert.ok(house.lowCount > prospect.lowCount)
  assert.ok(prospect.lowCount > everyDoor.lowCount)
})

test("a concrete offer lifts the range and a missing offer keeps it lower", () => {
  const strong = estimateResponse({ ...roofingProspect, offer: "Free inspection" })
  const light = estimateResponse({ ...roofingProspect, offer: undefined })
  assert.equal(strong.offerStrength, "strong")
  assert.equal(light.offerStrength, "light")
  const middle = estimateResponse(roofingProspect)
  assert.ok(strong.lowCount >= middle.lowCount)
  assert.ok(strong.highCount > middle.highCount)
  assert.ok(light.highCount < estimateResponse(roofingProspect).highCount)
})

test("vertical judgment moves insurance below home services without a fake stat", () => {
  const insurance = estimateResponse({
    ...roofingProspect,
    goal: "Explain Medicare choices",
    offer: "A plan conversation",
  })
  assert.equal(insurance.vertical, "medicare_insurance")
  assert.ok(insurance.highCount < estimateResponse(roofingProspect).highCount)
  assert.match(insurance.why, /judgment/)
  assert.doesNotMatch(insurance.why, /\d+(\.\d+)?%/)
})

test("planning bands stay under the cited ANA/DMA medians", () => {
  assert.ok(LIST_RESPONSE_BANDS.house.high < 9_000)
  assert.ok(LIST_RESPONSE_BANDS.prospect.high < 4_900)
  assert.ok(LIST_RESPONSE_BANDS.every_door.high < LIST_RESPONSE_BANDS.prospect.high)
  assert.ok(LIST_RESPONSE_BANDS.every_door.low < LIST_RESPONSE_BANDS.prospect.low)
  assert.ok(LIST_RESPONSE_BANDS.prospect.high < LIST_RESPONSE_BANDS.house.low)
  const source = readFileSync(new URL("./assumptions.ts", import.meta.url), "utf8")
  assert.match(source, /ANA\/DMA Response Rate Report 2018/)
  assert.match(source, /9%/)
  assert.match(source, /4\.9%/)
  assert.match(source, /Every Door/)
  assert.match(source, /not a guarantee/)
})
