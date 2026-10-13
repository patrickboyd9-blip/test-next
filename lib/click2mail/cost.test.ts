import assert from "node:assert/strict"
import { test } from "node:test"

import {
  POSTCARD_5X8_STANDARD_FIRST_CLASS_POSTAGE_DOLLARS,
  POSTCARD_NONSTANDARD_FIRST_CLASS_POSTAGE_DOLLARS,
  formatDollars,
  loadPostcardPostage,
  postageEstimate,
  postageEstimateLabel,
  standardPostageDollars,
} from "./cost"

test("5x8 First Class postage is the confirmed postcard rate", () => {
  assert.equal(POSTCARD_5X8_STANDARD_FIRST_CLASS_POSTAGE_DOLLARS, 0.495)
  assert.equal(POSTCARD_NONSTANDARD_FIRST_CLASS_POSTAGE_DOLLARS, 0.82)
  assert.equal(standardPostageDollars(1), 0.495)
  assert.equal(standardPostageDollars(2), 0.99)
  assert.equal(standardPostageDollars(100), 49.5)
  assert.equal(formatDollars(0.495), "$0.495")
  assert.equal(formatDollars(0.82), "$0.82")
  assert.equal(formatDollars(49.5), "$49.50")

  const one = postageEstimate(1)
  assert.equal(one.amountLabel, "$0.495")
  assert.match(one.detail, /5×8/)
  assert.match(one.detail, /\$0\.82/)
  assert.match(one.detail, /Production is additional/)
  assert.match(postageEstimateLabel(3), /\$1\.485/)
  assert.equal(postageEstimate(0).amountLabel, "—")
  const six = postageEstimate(1, {
    standardFirstClassDollars: POSTCARD_5X8_STANDARD_FIRST_CLASS_POSTAGE_DOLLARS,
    nonstandardFirstClassDollars: POSTCARD_NONSTANDARD_FIRST_CLASS_POSTAGE_DOLLARS,
  }, "6x9")
  assert.equal(six.amountLabel, "—")
  assert.match(six.detail, /6×9/)
  assert.match(six.detail, /5×8/)
})

test("postage rates can be overridden without editing the screen", () => {
  const rates = loadPostcardPostage({
    C2M_POSTAGE_5X8_STANDARD: "0.51",
    C2M_POSTAGE_NONSTANDARD: "0.90",
  } as NodeJS.ProcessEnv)
  assert.equal(rates.standardFirstClassDollars, 0.51)
  assert.equal(rates.nonstandardFirstClassDollars, 0.9)
  assert.equal(postageEstimate(2, rates).amountLabel, "$1.02")
  assert.equal(loadPostcardPostage({ C2M_POSTAGE_5X8_STANDARD: "nope" } as NodeJS.ProcessEnv).standardFirstClassDollars, 0.495)
})
