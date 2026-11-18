import assert from "node:assert/strict"
import { test } from "node:test"

import { parseBirthday, reviewCardList } from "./import"

test("a pasted line and a csv become rows for review and do not keep a birth year", () => {
  const pasted = reviewCardList("Jane Doe, 3/14/1990, 123 Main St, Austin, TX 78701")
  assert.equal(pasted.headerError, null)
  assert.equal(pasted.accepted.length, 1)
  assert.equal(pasted.accepted[0]?.name, "Jane Doe")
  assert.equal(pasted.accepted[0]?.month, 3)
  assert.equal(pasted.accepted[0]?.day, 14)
  assert.equal(pasted.accepted[0]?.state, "TX")
  assert.equal("year" in (pasted.accepted[0] ?? {}), false)

  const csv = reviewCardList(["name,birthday,address,city,state,zip", "Ada Lovelace,2/29,1 Main St,Austin,TX,78701"].join("\n"))
  assert.equal(csv.accepted[0]?.day, 29)
  assert.equal(parseBirthday("February 31"), null)
})

test("a bad row and a duplicate stay out of the accepted list", () => {
  const review = reviewCardList(["Jane Doe, 3/14, 123 Main St, Austin, TX 78701", "Jane Doe, 3/14, 123 Main St, Austin, TX 78701", "No Address, 3/14"].join("\n"))
  assert.equal(review.accepted.length, 1)
  assert.equal(review.duplicates.length, 1)
  assert.equal(review.invalid.length, 1)
})
