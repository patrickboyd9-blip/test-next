import assert from "node:assert/strict"
import { test } from "node:test"

import { returnAddressFromBusiness } from "./return-address"

test("a name-only business still sends the organization return address", () => {
  assert.deepEqual(returnAddressFromBusiness({ name: "Northwind HVAC" }), {
    rtnOrganization: "Northwind HVAC",
  })
})

test("the upload form's return address is sent to Click2Mail", () => {
  assert.deepEqual(
    returnAddressFromBusiness({
      name: "Northwind HVAC",
      street: "100 Main St",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
    }),
    {
      rtnOrganization: "Northwind HVAC",
      rtnaddress1: "100 Main St",
      rtnCity: "Austin",
      rtnState: "TX",
      rtnZip: "78701",
    }
  )
})

test("a missing business name falls back for the mailer", () => {
  assert.equal(returnAddressFromBusiness(undefined).rtnOrganization, "Modern Mail Test")
})
