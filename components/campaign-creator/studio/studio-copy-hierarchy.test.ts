import assert from "node:assert/strict"
import { test } from "node:test"

import { studioCopyHierarchy } from "./studio-copy-hierarchy"

test("leadJob hierarchy is offer-hero, message-hero, or layout default", () => {
  assert.equal(studioCopyHierarchy(undefined), "layout-default")
  assert.equal(studioCopyHierarchy("offer"), "offer-hero")
  assert.equal(studioCopyHierarchy("problem"), "message-hero")
  assert.equal(studioCopyHierarchy("trust"), "message-hero")
  assert.equal(studioCopyHierarchy("urgency"), "message-hero")
})
