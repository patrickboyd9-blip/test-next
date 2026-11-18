import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { homePrice, homeSamples } from "./home"

const future = "2099-01-01T00:00:00.000Z"
const now = "2026-11-18T00:00:00.000Z"

test("the homepage shows an approved full price and never a postage-only number", () => {
  const price = homePrice(
    {
      MAIL_APPROVED_PRICE_JSON: JSON.stringify({
        id: "sched-1",
        status: "approved",
        currency: "usd",
        perPieceCents: 189,
        termsVersion: "v1",
        effectiveUntil: future,
      }),
    } as unknown as NodeJS.ProcessEnv,
    now
  )
  assert.equal(price.ready, true)
  if (!price.ready) return
  assert.equal(price.amount, "$1.89")
  assert.match(price.note, /Not postage by itself/)
  assert.doesNotMatch(price.note, /postage only|per piece postage/i)
})

test("without an approved price the homepage does not invent a number", () => {
  const price = homePrice({} as unknown as NodeJS.ProcessEnv, now)
  assert.equal(price.ready, false)
  assert.equal(price.amount, "See pricing at checkout")
  assert.doesNotMatch(JSON.stringify(price), /\$\d/)
})

test("sample designs come from the Mailer Gallery and the front door does not send people to Campaigns", () => {
  const samples = homeSamples()
  assert.ok(samples.length >= 4)
  assert.ok(samples.every((sample) => sample.src.startsWith("/gallery/")))
  const page = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8")
  assert.match(page, /redirect\("\/app"\)/)
  assert.match(page, /href="\/sign-up"/)
  assert.match(page, /href="\/sign-in"/)
  assert.doesNotMatch(page, /preview-demo|\/app\/campaigns/)
})
