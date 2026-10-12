import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type { DesignRequest } from "@/lib/design-requests/types"

import { DesignRequestList, formatRequestDate } from "./DesignRequestList"

test("the requests page lists a company and its uploads", () => {
  const request: DesignRequest = {
    id: "req-1",
    companyName: "Harbor Roofing",
    address: "100 Main St, Austin, TX 78701",
    vibe: "Calm and local",
    offer: "Free inspection this month",
    responseMethods: ["qr", "phone"],
    qrUrl: "https://harborroofing.com/inspect",
    phone: "(512) 555-0148",
    size: "5x8",
    notes: "Blue logo",
    uploads: [
      {
        id: "up-1",
        role: "logo",
        fileName: "logo.png",
        mediaType: "image/png",
        byteLength: 12,
        key: "logo.png",
      },
    ],
    createdAt: "2026-10-12T15:00:00.000Z",
  }

  const html = renderToStaticMarkup(createElement(DesignRequestList, { requests: [request] }))
  assert.match(html, /Design requests/)
  assert.match(html, /Harbor Roofing/)
  assert.match(html, /Free inspection this month/)
  assert.match(html, /Calm and local/)
  assert.match(html, /5×8/)
  assert.match(html, /QR code/)
  assert.match(html, /\/api\/design-requests\/req-1\/logo.png/)
  assert.match(html, /Nothing here is emailed/)
  assert.equal(formatRequestDate(request.createdAt), "Oct 12, 2026")
})

test("an empty request list says so", () => {
  const html = renderToStaticMarkup(createElement(DesignRequestList, { requests: [] }))
  assert.match(html, /No design requests yet/)
})
