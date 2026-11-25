import assert from "node:assert/strict"
import { test } from "node:test"

import { unverifiedAddressCheck } from "./cass"

test("address verification is a seam and does not call a paid check", async () => {
  const checker = unverifiedAddressCheck()
  assert.equal(checker.configured, false)
  const report = await checker.verify([
    {
      first: "Ada",
      last: "Lovelace",
      organization: "",
      address1: "1 Main St",
      address2: "",
      city: "Austin",
      state: "TX",
      zip: "78701",
    },
  ])
  assert.equal(report.status, "not_checked")
  assert.match(report.note, /not a postal delivery check/)
})
