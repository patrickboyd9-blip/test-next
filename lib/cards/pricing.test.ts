import assert from "node:assert/strict"
import { test } from "node:test"

import { priceCompanyCard, pricePersonalCard, tierForCount } from "./pricing"

test("personal tiers are the full price and never a postage line", () => {
  assert.equal(tierForCount(1).perCardCents, 500)
  assert.equal(tierForCount(4).perCardCents, 500)
  assert.equal(tierForCount(5).perCardCents, 450)
  assert.equal(tierForCount(9).perCardCents, 450)
  assert.equal(tierForCount(10).perCardCents, 400)
  assert.equal(tierForCount(24).perCardCents, 400)
  assert.equal(tierForCount(25).perCardCents, 350)
  assert.equal(tierForCount(100).perCardCents, 350)
  const price = pricePersonalCard(5)
  assert.equal(price.postageOnly, false)
  assert.equal(price.perCardCents, 450)
  assert.match(price.message, /Not postage by itself/)
  assert.equal("postageCents" in price, false)
})

test("company pricing stays unset", () => {
  const price = priceCompanyCard()
  assert.equal(price.configured, false)
  assert.equal(price.perCardCents, null)
  assert.equal(price.postageOnly, false)
  assert.match(price.message, /Nothing is charged/)
})
