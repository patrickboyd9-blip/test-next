import assert from "node:assert/strict"
import { test } from "node:test"

import type { Recipient } from "@/lib/click2mail/recipients"

import { guessMapping, importMappedCsv, inspectCsv } from "./csv"

const ada: Recipient = {
  first: "Ada",
  last: "Lovelace",
  organization: "",
  address1: "1 Main St",
  address2: "",
  city: "Austin",
  state: "TX",
  zip: "78701",
}

test("headers are guessed and the first rows are previewed", () => {
  const csv = [
    "Full Name,Company,Street Address,Apt,City,State,Zip Code",
    "Ada Lovelace,Engines,1 Main St,,Austin,TX,78701",
    "Grace Hopper,,2 Main St,Unit 4,Austin,Texas,78702",
  ].join("\n")
  const preview = inspectCsv(csv)
  assert.equal(preview.error, null)
  assert.equal(preview.dataRows, 2)
  assert.equal(preview.sample.length, 2)
  assert.equal(preview.sample[0]?.row, 2)
  assert.equal(preview.mapping.fullName, 0)
  assert.equal(preview.mapping.organization, 1)
  assert.equal(preview.mapping.address1, 2)
  assert.equal(preview.mapping.address2, 3)
  assert.equal(preview.mapping.city, 4)
  assert.equal(preview.mapping.state, 5)
  assert.equal(preview.mapping.zip, 6)
  assert.equal(preview.mapping.first, null)
})

test("an upload drops exact duplicates and explains bad rows", () => {
  const csv = [
    "First Name,Last Name,Street,City,State,ZIP",
    "Ada,Lovelace,1 Main St,Austin,TX,78701",
    "Grace,Hopper,2 Main St,Austin,TX,78702",
    "Grace,Hopper,2 Main St,Austin,TX,78702",
    "Bo,Bad,3 Main St,Austin,TX,12",
  ].join("\n")
  const mapping = guessMapping(inspectCsv(csv).headers)
  const result = importMappedCsv(csv, mapping, [ada])
  assert.equal(result.headerError, null)
  assert.equal(result.accepted.length, 1)
  assert.equal(result.accepted[0]?.first, "Grace")
  assert.equal(result.duplicates.length, 2)
  assert.equal(result.duplicates[0]?.matches, "list")
  assert.equal(result.duplicates[1]?.matches, "file")
  assert.equal(result.duplicates[1]?.matchesRow, 3)
  assert.equal(result.invalid.length, 1)
  assert.match(result.invalid[0]?.messages.join(" ") ?? "", /Row 5/)
  assert.match(result.invalid[0]?.messages.join(" ") ?? "", /ZIP/)
})

test("a different apartment is not a duplicate", () => {
  const csv = ["first,last,address,city,state,zip", "Ada,Lovelace,1 Main St Apt 2,Austin,TX,78701"].join("\n")
  const mapping = guessMapping(["first", "last", "address", "city", "state", "zip"])
  const result = importMappedCsv(csv, mapping, [ada])
  assert.equal(result.accepted.length, 1)
  assert.equal(result.duplicates.length, 0)
  assert.equal(result.accepted[0]?.address1, "1 Main St Apt 2")
})

test("unmatched columns are named before any row is accepted", () => {
  const csv = "Name,City\nAda Lovelace,Austin\n"
  const preview = inspectCsv(csv)
  const result = importMappedCsv(csv, preview.mapping)
  assert.match(result.headerError ?? "", /street/)
  assert.equal(result.accepted.length, 0)
})
