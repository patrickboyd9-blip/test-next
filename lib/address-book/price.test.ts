import assert from "node:assert/strict"
import { test } from "node:test"

import { formatFullPrice } from "./price"

test("the price shown is the full price for the people on the list", () => {
  const open = formatFullPrice(12, null)
  assert.equal(open.label, "Placeholder")
  assert.match(open.detail, /12 people/)
  assert.match(open.detail, /Full price/)
  assert.match(open.detail, /Not postage by itself/)
  assert.doesNotMatch(open.detail, /\$0\.495|postage only/i)

  const quoted = formatFullPrice(2, 250)
  assert.equal(quoted.label, "$5.00")
  assert.match(quoted.detail, /Full price for 2 people/)
  assert.match(quoted.detail, /Not postage by itself/)
  assert.doesNotMatch(quoted.label, /postage/i)

  const empty = formatFullPrice(0, 250)
  assert.equal(empty.label, "Placeholder")
})
