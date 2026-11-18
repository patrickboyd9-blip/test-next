import assert from "node:assert/strict"
import { test } from "node:test"

import { applyBrand, defaultWhiteLabel, parseWhiteLabel, POWERED_BY, STOCK_APP_NAME } from "./brand"

test("white label is on by default and still says Modern Mail until the account changes it", () => {
  const brand = applyBrand(null)
  assert.equal(brand.enabled, true)
  assert.equal(brand.appName, STOCK_APP_NAME)
  assert.equal(brand.poweredBy, POWERED_BY)
  assert.equal(defaultWhiteLabel().enabled, true)
  assert.equal("domain" in defaultWhiteLabel(), false)
})

test("a saved brand renames the app, the accent, and the support line, and can hide the credit", () => {
  const parsed = parseWhiteLabel({
    enabled: true,
    appName: "Northwind Mail",
    accent: "#F0A202",
    hidePoweredBy: true,
    supportEmail: "hello@northwind.example",
    supportName: "Northwind desk",
    logoDataUrl: "data:image/png;base64,aaaa",
    faviconDataUrl: null,
  })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const brand = applyBrand(parsed.value)
  assert.equal(brand.appName, "Northwind Mail")
  assert.equal(brand.accent, "#f0a202")
  assert.equal(brand.poweredBy, null)
  assert.equal(brand.supportEmail, "hello@northwind.example")
  assert.equal(brand.supportName, "Northwind desk")
  assert.equal(brand.logoDataUrl?.startsWith("data:image/png"), true)
})

test("turning the flag off ignores the custom name and shows Modern Mail", () => {
  const parsed = parseWhiteLabel({
    enabled: false,
    appName: "Northwind Mail",
    accent: "#112233",
    hidePoweredBy: true,
    supportEmail: "hello@northwind.example",
    supportName: "Desk",
  })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const brand = applyBrand(parsed.value)
  assert.equal(brand.enabled, false)
  assert.equal(brand.appName, STOCK_APP_NAME)
  assert.equal(brand.accent, "#5ce1ff")
  assert.equal(brand.poweredBy, POWERED_BY)
  assert.equal(brand.supportEmail, "")
})

test("a bad color, a bad email, and a non-image are refused", () => {
  assert.equal(parseWhiteLabel({ accent: "blue" }).ok, false)
  assert.equal(parseWhiteLabel({ supportEmail: "not-an-email" }).ok, false)
  assert.equal(parseWhiteLabel({ logoDataUrl: "https://example.com/logo.png" }).ok, false)
})
