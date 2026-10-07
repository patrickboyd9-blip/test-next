import assert from "node:assert/strict"
import { test } from "node:test"

import { studioCopyHierarchy, copyOfferLeads, copyRestatesLead } from "./studio-copy-hierarchy"

test("leadJob hierarchy is offer-hero, message-hero, or layout default", () => {
  assert.equal(studioCopyHierarchy(undefined), "layout-default")
  assert.equal(studioCopyHierarchy("offer"), "offer-hero")
  assert.equal(studioCopyHierarchy("problem"), "message-hero")
  assert.equal(studioCopyHierarchy("trust"), "message-hero")
  assert.equal(studioCopyHierarchy("urgency"), "message-hero")
})

test("offer leads only when leadJob is offer", () => {
  assert.equal(copyOfferLeads(studioCopyHierarchy(undefined)), false)
  assert.equal(copyOfferLeads(studioCopyHierarchy("offer")), true)
  assert.equal(copyOfferLeads(studioCopyHierarchy("problem")), false)
  assert.equal(copyOfferLeads(studioCopyHierarchy("trust")), false)
  assert.equal(copyOfferLeads(studioCopyHierarchy("urgency")), false)
})

test("a headline that restates the offer is one line", () => {
  assert.equal(
    copyRestatesLead("Free roofing inspection", "Free Roofing Inspection. No Catch."),
    true
  )
  assert.equal(
    copyRestatesLead("Free Roofing Inspection. No Catch.", "Free roofing inspection"),
    true
  )
  assert.equal(copyRestatesLead("Free inspection", "Neighbors trust the crew"), false)
  assert.equal(copyRestatesLead("Free", "Free Roofing Inspection. No Catch."), false)
})
