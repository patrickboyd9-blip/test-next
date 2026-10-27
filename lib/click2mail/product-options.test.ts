import assert from "node:assert/strict"
import { test } from "node:test"

import { parseXml } from "./xml"
import { parseProductOptions, selectEddmProduct } from "./product-options"

test("a nested product list keeps the exact mail class text", () => {
  const root = parseXml(`<?xml version="1.0"?>
    <productOptions>
      <documentClass>
        <name>EDDM Mailer 6.5 x 9</name>
        <layout>
          <name>We Prep and Mail</name>
          <productionTime>
            <name>Next Day</name>
            <mailClass><name>Postage Paid in Advance</name></mailClass>
            <mailClass><name>PM EDDM (Full Service): includes the Click2Mail permit</name></mailClass>
          </productionTime>
        </layout>
      </documentClass>
    </productOptions>`)
  const rows = parseProductOptions(root)
  const chosen = selectEddmProduct(rows, "6.5x9")
  assert.equal(chosen.mailClass, "PM EDDM (Full Service): includes the Click2Mail permit")
  assert.equal(chosen.documentClass, "EDDM Mailer 6.5 x 9")
  assert.equal(chosen.layout, "We Prep and Mail")
})

test("postage paid is used when it is the only mail class the list returns", () => {
  const root = parseXml(`<?xml version="1.0"?>
    <productOptions>
      <productOption>
        <documentClass>EDDM Mailer 6.25 x 11</documentClass>
        <layout>We Prep and Mail</layout>
        <productionTime>Next Day</productionTime>
        <envelope> </envelope>
        <color>Full Color</color>
        <paperType>White Matte</paperType>
        <printOption>Printing both sides</printOption>
        <mailClass>Postage Paid in Advance</mailClass>
      </productOption>
    </productOptions>`)
  const chosen = selectEddmProduct(parseProductOptions(root), "6.25x11")
  assert.equal(chosen.mailClass, "Postage Paid in Advance")
})
