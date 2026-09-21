import assert from "node:assert/strict"
import { test } from "node:test"

import { studioCopyHierarchy, copyOfferLeads } from "./studio-copy-hierarchy"

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
