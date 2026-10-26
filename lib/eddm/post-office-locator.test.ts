import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import { applyPostOfficeContacts, lookupPostOfficeContacts, parseLocatorContacts } from "./post-office-locator"
import type { EddmRoute } from "./routes"

const locatorBody = {
  locations: [
    {
      locationName: "JAMES A FARLEY",
      address1: "421 8TH AVE",
      city: "NEW YORK",
      state: "NY",
      zip5: "10001",
      phone: "2123303296",
    },
    {
      locationName: "ANOTHER OFFICE",
      address1: "1 MAIN ST",
      city: "NEW YORK",
      state: "NY",
      zip5: "10001",
      phone: "",
    },
  ],
}

test("the locator response keeps offices that have a street and a phone", () => {
  const contacts = parseLocatorContacts(locatorBody)
  assert.equal(contacts.length, 1)
  assert.equal(contacts[0]?.street, "421 8TH AVE")
  assert.equal(contacts[0]?.phone, "212-330-3296")
})

test("a live locator result is saved and fills the route", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "eddm-po-"))
  try {
    const contacts = await lookupPostOfficeContacts({
      zip: "10001",
      cacheDir: directory,
      now: Date.parse("2026-10-26T00:00:00.000Z"),
      fetchImpl: async () => new Response(JSON.stringify(locatorBody), { status: 200 }),
    })
    assert.equal(contacts[0]?.name, "JAMES A FARLEY")
    const [route] = applyPostOfficeContacts([bareRoute()], contacts)
    assert.equal(route?.postOfficeStreet, "421 8TH AVE")
    assert.equal(route?.postOfficePhone, "212-330-3296")

    let called = false
    const cached = await lookupPostOfficeContacts({
      zip: "10001",
      cacheDir: directory,
      now: Date.parse("2026-10-27T00:00:00.000Z"),
      fetchImpl: async () => {
        called = true
        throw new Error("offline")
      },
    })
    assert.equal(called, false)
    assert.equal(cached[0]?.street, "421 8TH AVE")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("the saved table supplies the post office when the locator is down", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "eddm-po-empty-"))
  try {
    const contacts = await lookupPostOfficeContacts({
      zip: "10001",
      cacheDir: directory,
      fetchImpl: async () => {
        throw new Error("offline")
      },
    })
    assert.equal(contacts.some((office) => office.name === "JAMES A FARLEY" && office.phone === "212-330-3296"), true)
    const [route] = applyPostOfficeContacts([bareRoute()], contacts)
    assert.equal(route?.postOfficeStreet, "421 8TH AVE")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

function bareRoute(): EddmRoute {
  return {
    id: "10001C071",
    zip: "10001",
    route: "C071",
    cityState: "NEW YORK, NY",
    residential: 400,
    business: 20,
    total: 420,
    medianAge: 50,
    medianIncome: 160000,
    householdSize: 1.7,
    postOfficeName: "JAMES A FARLEY",
    postOfficeStreet: "",
    postOfficePhone: "",
    lines: [],
  }
}
