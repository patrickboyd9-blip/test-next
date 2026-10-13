import assert from "node:assert/strict"
import { test } from "node:test"

import { loadClick2MailConfig } from "./config"
import { Click2MailError } from "./errors"
import {
  POSTCARD_DOCUMENT_CLASS,
  POSTCARD_NO_ENVELOPE,
  assertPostcardJobProduct,
  postcardJobProduct,
  resolvePostcardProduct,
} from "./products"

test("5x8 and 6x9 jobs use postcard product, layout, and First Class", () => {
  for (const size of ["5x8", "6x9"] as const) {
    const product = postcardJobProduct(size)
    assert.equal(product.documentClass, POSTCARD_DOCUMENT_CLASS[size])
    assert.match(product.documentClass, /^Postcard /)
    assert.equal(product.layout, "Double Sided Postcard")
    assert.equal(product.mailClass, "First Class")
    assert.equal(product.printOption, "Printing both sides")
    assert.equal(product.paperType, "White Matte with Gloss UV Finish")
    assert.equal(product.envelope, POSTCARD_NO_ENVELOPE)
    assert.equal(product.envelope.trim(), "")
    assert.doesNotMatch(product.documentClass, /Letter/)
  }
  assert.equal(POSTCARD_DOCUMENT_CLASS["5x8"], "Postcard 5 x 8")
  assert.equal(POSTCARD_DOCUMENT_CLASS["6x9"], "Postcard 6 x 9")
})

test("6x9 does not inherit a 5x8 or letter document class from the environment", () => {
  const configured = loadClick2MailConfig({
    C2M_DOCUMENT_CLASS: "Letter 8.5 x 11",
    C2M_LAYOUT: "Address on Separate Page",
    C2M_ENVELOPE: "#10 Double Window",
    C2M_MAIL_CLASS: "First Class",
    C2M_COLOR: "Full Color",
  } as NodeJS.ProcessEnv).product
  const product = resolvePostcardProduct("6x9", configured)
  assert.equal(product.documentClass, "Postcard 6 x 9")
  assert.equal(product.layout, "Double Sided Postcard")
  assert.equal(product.envelope, POSTCARD_NO_ENVELOPE)
  assert.equal(product.color, "Full Color")
  assert.throws(() => assertPostcardJobProduct({ ...product, envelope: "#10 Double Window" }), Click2MailError)
})

test("an explicit postcard override still has to be a postcard", () => {
  const configured = loadClick2MailConfig({} as NodeJS.ProcessEnv).product
  const product = resolvePostcardProduct("5x8", configured, {
    paperType: "White 80# Gloss with UV Coating",
  })
  assert.equal(product.documentClass, "Postcard 5 x 8")
  assert.equal(product.paperType, "White 80# Gloss with UV Coating")
  assert.doesNotThrow(() => assertPostcardJobProduct(product))
})
