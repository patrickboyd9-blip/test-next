import assert from "node:assert/strict"
import { test } from "node:test"

import {
  businessNameForCard,
  displayWebsite,
  postcardIdentityFromBrief,
  resolveStudioContact,
} from "./studio-contact"

test("brief phone, URL, and business name replace toy spec chrome", () => {
  const contact = resolveStudioContact(
    {
      phone: "111-222-3344",
      website: "www.abc.com",
      qrDestination: "www.abc.com",
    },
    postcardIdentityFromBrief({
      businessInfo: {
        name: "Summit Roofing",
        phone: "619-555-0148",
        website: "https://summitroofing.com",
      },
      qrDestination: "https://summitroofing.com/inspect",
    })
  )

  assert.equal(contact.businessName, "Summit Roofing")
  assert.equal(contact.phone, "619-555-0148")
  assert.equal(contact.website, "https://summitroofing.com")
  assert.equal(contact.qrPayload, "https://summitroofing.com/inspect")
  assert.equal(displayWebsite(contact.website!), "summitroofing.com")
  assert.equal(businessNameForCard(contact.businessName, "Don't Wait, Inspect"), "Summit Roofing")
  assert.equal(businessNameForCard(contact.businessName, "Summit Roofing"), undefined)
})

test("toy contact is omitted when the brief has no real phone or URL", () => {
  const contact = resolveStudioContact({
    phone: "111-222-3344",
    website: "www.abc.com",
  })
  assert.equal(contact.phone, undefined)
  assert.equal(contact.website, undefined)
  assert.equal(contact.qrPayload, null)
})

test("phone and website stay separate fields", () => {
  const contact = resolveStudioContact({
    phone: "(619) 555-0148",
    website: "https://summitroofing.com/inspect",
  })
  assert.equal(contact.phone, "(619) 555-0148")
  assert.equal(contact.website, "https://summitroofing.com/inspect")
  assert.notEqual(contact.phone, contact.website)
})
