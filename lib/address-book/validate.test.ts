import assert from "node:assert/strict"
import { test } from "node:test"

import { validateAddress } from "./validate"

test("a complete address is accepted, including ZIP+4 and an optional company", () => {
  const parsed = validateAddress({
    first: "Ada",
    last: "Lovelace",
    organization: "Analytical Engines",
    address1: "1 Main St",
    address2: "Apt 4",
    city: "Austin",
    state: "TX",
    zip: "787011234",
  })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.recipient.zip, "78701-1234")
  assert.equal(parsed.recipient.state, "TX")
  assert.equal(parsed.recipient.organization, "Analytical Engines")
  assert.equal(parsed.recipient.address2, "Apt 4")
})

test("missing fields are named in plain language", () => {
  const parsed = validateAddress({ first: "", last: "", address1: "", city: "", state: "", zip: "12" })
  assert.equal(parsed.ok, false)
  if (parsed.ok) return
  assert.equal(parsed.errors.first, "Add a first name.")
  assert.equal(parsed.errors.last, "Add a last name.")
  assert.equal(parsed.errors.address1, "Add the street address.")
  assert.equal(parsed.errors.city, "Add the city.")
  assert.equal(parsed.errors.state, "Choose a U.S. state.")
  assert.equal(parsed.errors.zip, "Use a 5-digit ZIP, or ZIP+4 like 78701-1234.")
  assert.equal(parsed.errors.organization, undefined)
})

test("company can be left blank", () => {
  const parsed = validateAddress({
    first: "Grace",
    last: "Hopper",
    address1: "1 Navy Way",
    city: "Arlington",
    state: "Virginia",
    zip: "22201",
  })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.recipient.organization, "")
  assert.equal(parsed.recipient.address2, "")
  assert.equal(parsed.recipient.state, "VA")
})
