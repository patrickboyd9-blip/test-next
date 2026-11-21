import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { ScanChoice } from "./ScanChoice"

const FORBIDDEN = /redirect|hosted|analytics|tracking pixel|landing page/i

test("the scan choice is two plain cards and a simple comparison", () => {
  const html = renderToStaticMarkup(
    createElement(ScanChoice, { choice: "page", website: "" })
  )
  assert.match(html, /Send scans to a simple page we make for you/)
  assert.match(html, /Nothing to set up/)
  assert.match(html, /Already have a booking page you love\?/)
  assert.match(html, /Booking button taps/)
  assert.doesNotMatch(html, /a big button to call you/)
  assert.doesNotMatch(html, /appointment was booked|time was booked/i)
  assert.match(html, /Send scans to my own website/)
  assert.match(html, /they go straight to your website/)
  assert.match(html, /What&#x27;s the difference\?|What's the difference\?/)
  assert.match(html, /Scans counted/)
  assert.match(html, /Call taps/)
  assert.match(html, /Form leads/)
  assert.match(html, /Recommended/)
  assert.doesNotMatch(html, FORBIDDEN)
})

test("the same words are in setup, settings, results, and the reports reminder", () => {
  const setup = readFileSync("components/campaign-creator/QuantityTrackingStage.tsx", "utf8")
  const settings = readFileSync("components/campaign-creator/BriefSummaryCard.tsx", "utf8")
  const results = readFileSync("app/app/campaigns/[id]/results/page.tsx", "utf8")
  const reports = readFileSync("app/app/reports/page.tsx", "utf8")
  for (const source of [setup, settings, results]) {
    assert.match(source, /ScanChoice/)
  }
  assert.match(reports, /Want to see calls and form leads too\?/)
  assert.match(reports, /Switch to our free page/)
})
