import assert from "node:assert/strict"
import test from "node:test"

import { offerSubline, polishTradeCopy, stripFillerSentences, sublineMismatchesOffer } from "./trade-subline"

const plumber: any = { goal: "Book plumbing jobs", offer: "$75 off any drain cleaning", businessInfo: { name: "Flow Plumbing", city: "Austin", state: "TX" } }

test("a drain offer never gets a water-heater subline", () => {
  assert.equal(sublineMismatchesOffer("Hot water you can count on.", "$75 off any drain cleaning"), true)
  for (let seed = 0; seed < 12; seed += 1) {
    const line = offerSubline({ brief: plumber, offer: plumber.offer, headline: "Slow drain?", seed })
    assert.doesNotMatch(line, /hot water|water heater|tankless|shower/i, line)
  }
})

test("Call today filler leaves headlines and sublines", () => {
  assert.equal(stripFillerSentences("Mud tubes on the foundation? Call today."), "Mud tubes on the foundation?")
  const out = polishTradeCopy({
    brief: plumber,
    spec: { headline: "Slow drain? Call today.", subheadline: "Call today to book your drain cleaning.", offer: plumber.offer },
    fallbackHeadline: () => "fallback",
  })
  assert.equal(out.headline, "Slow drain?")
  assert.doesNotMatch(out.subheadline ?? "", /call today/i)
  assert.ok((out.subheadline ?? "").length > 0)
})

test("the generic listing-consultation line is replaced", () => {
  const agent: any = { goal: "Get listing appointments", offer: "Free home value report", businessInfo: { name: "Lane Realty" } }
  const out = polishTradeCopy({ brief: agent, spec: { headline: "What is your home worth?", subheadline: "Schedule your free listing consultation today.", offer: agent.offer }, fallbackHeadline: () => "x" })
  assert.doesNotMatch(out.subheadline ?? "", /schedule|today/i)
})
