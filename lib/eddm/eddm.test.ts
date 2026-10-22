import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import { PDFDocument } from "pdf-lib"

import { getMailPiece } from "@/lib/mail-catalog/catalog"
import { renderTemplatedPostcardPdf } from "@/lib/print-spec/render-template-postcard-pdf"
import { composePostcardFace } from "@/lib/postcard-layouts/compose"
import { rectsOverlap } from "@/lib/postcard-layouts/templates"

import { hasRecipientPersonalization, toNeighborhoodCopy } from "./copy"
import {
  EDDM_CLEARANCE_INCHES,
  EDDM_INDICIA_FROM_RIGHT_INCHES,
  EDDM_INDICIA_FROM_TOP_INCHES,
  qualifiesAsEddmFlat,
} from "./geometry"
import { EDDM_MAX_PIECES_PER_ZIP_PER_DAY, EDDM_MIN_PIECES, eddmLimitMessages } from "./limits"
import { eddmPostageEstimate } from "./postage"
import { routeMatchesFilter, snapshotRoute, summarizeSelection, type EddmRoute } from "./routes"
import { extractZip, loadEddmRoutes, parseUspsRoutes, toLngLat } from "./usps"

const SAMPLE = {
  results: [
    {
      value: {
        features: [
          {
            attributes: {
              ZIP_CRID: "10001C071",
              ZIP_CODE: "10001",
              CRID_ID: "C071",
              CITY_STATE: "NEW YORK, NY",
              BUS_CNT: 37,
              RES_CNT: 400,
              TOT_CNT: 437,
              FACILITY_NAME: "JAMES A FARLEY",
              MED_INCOME: 160065,
              MED_AGE: 50,
              AVG_HH_SIZ: 1.7,
            },
            geometry: { paths: [[[-8237741, 4975864], [-8237804, 4975749]]] },
          },
          {
            attributes: {
              ZIP_CRID: "10001C001",
              ZIP_CODE: "10001",
              CRID_ID: "C001",
              CITY_STATE: "NEW YORK, NY",
              BUS_CNT: 4,
              RES_CNT: 80,
              TOT_CNT: 84,
              FACILITY_NAME: "JAMES A FARLEY",
              MED_INCOME: null,
              MED_AGE: 30,
              AVG_HH_SIZ: null,
            },
            geometry: { paths: [] },
          },
        ],
      },
    },
  ],
}

test("6.5×9 and 6.25×11 are EDDM flats and 5×8 is not", () => {
  const wide = getMailPiece("postcard_6_5x9", 1)
  const jumbo = getMailPiece("postcard_6_25x11", 1)
  const small = getMailPiece("postcard_5x8", 1)
  assert.equal(qualifiesAsEddmFlat(wide.physical.finishedTrimInches.widthInches, wide.physical.finishedTrimInches.heightInches), true)
  assert.equal(qualifiesAsEddmFlat(jumbo.physical.finishedTrimInches.widthInches, jumbo.physical.finishedTrimInches.heightInches), true)
  assert.equal(qualifiesAsEddmFlat(small.physical.finishedTrimInches.widthInches, small.physical.finishedTrimInches.heightInches), false)
  assert.equal(wide.physical.finishedTrimInches.widthInches, 9)
  assert.equal(wide.physical.finishedTrimInches.heightInches, 6.5)
  assert.equal(jumbo.physical.finishedTrimInches.widthInches, 11)
  assert.equal(jumbo.physical.finishedTrimInches.heightInches, 6.25)
  assert.equal(wide.physical.artworkCanvasInches.widthInches, 9.5)
  assert.equal(jumbo.physical.artworkCanvasInches.heightInches, 6.75)
})

test("the indicia zone is above and to the right of Postal Customer", () => {
  for (const id of ["postcard_6_5x9", "postcard_6_25x11"] as const) {
    const entry = getMailPiece(id, 1)
    const trim = entry.physical.finishedTrimInches.widthInches
    const indicia = entry.creativeCanvas.reservedKeepOut.rectangles.find((rect) => rect.id === "eddm_indicia")
    const address = entry.creativeCanvas.reservedKeepOut.rectangles.find((rect) => rect.id === "postal_customer")
    assert.ok(indicia)
    assert.ok(address)
    assert.equal(indicia.widthInches, EDDM_INDICIA_FROM_RIGHT_INCHES)
    assert.equal(indicia.heightInches, EDDM_INDICIA_FROM_TOP_INCHES)
    assert.equal(indicia.xInches + indicia.widthInches, trim)
    assert.equal(indicia.yInches, 0)
    assert.ok(indicia.widthInches > 0.5)
    assert.ok(indicia.heightInches > 0.5)
    assert.equal(address.xInches + address.widthInches + EDDM_CLEARANCE_INCHES, indicia.xInches)
    assert.ok(address.yInches > indicia.yInches)
    assert.equal(
      rectsOverlap(
        { x: address.xInches, y: address.yInches, w: address.widthInches, h: address.heightInches },
        { x: indicia.xInches, y: indicia.yInches, w: indicia.widthInches, h: indicia.heightInches }
      ),
      false
    )
  }
})

test("the EDDM back says Postal Customer and leaves the indicia zone clear of the offer", () => {
  const back = composePostcardFace({
    templateId: "deadline_coupon",
    size: "6.5x9",
    face: "back",
    businessName: "Corner Oven",
    spec: {
      headline: "Dear Jane, a free side",
      body: "Every home on this route can use the coupon.",
      offer: "Free side with any meal",
      callToAction: "Bring this card in",
      phone: "(512) 555-0144",
      website: "corneroven.example",
      qrDestination: "https://corneroven.example/coupon",
    },
  })
  const postal = back.texts.find((text) => text.text === "POSTAL CUSTOMER")
  const indicia = back.texts.find((text) => text.text === "ECRWSS")
  const offer = back.texts.find((text) => text.role === "offer")
  assert.ok(postal)
  assert.ok(indicia)
  assert.ok(offer)
  assert.equal(back.overflows, false)
  assert.equal(hasRecipientPersonalization(offer.text), false)
  assert.match(offer.text, /Free side/)
  assert.equal(rectsOverlap(postal.rect, indicia.rect), false)
  assert.equal(rectsOverlap(offer.rect, indicia.rect), false)
  assert.equal(rectsOverlap(offer.rect, postal.rect), false)
})

test("a 6.5×9 print file is two pages at the bleed size", async () => {
  const rendered = await renderTemplatedPostcardPdf({
    templateId: "neighbor_letter",
    size: "6.5x9",
    paletteId: "general",
    copy: {
      headline: "Dear Jane, a roof check",
      body: "Homeowners on this route can book a look.",
      offer: "Free roof inspection",
      callToAction: "Book a roof check",
      businessName: "Harbor Roofing",
      phone: "(619) 555-0148",
      website: "harborroofing.com",
      qrPayload: "https://harborroofing.com/inspect",
    },
  })
  const doc = await PDFDocument.load(rendered.bytes)
  assert.equal(doc.getPageCount(), 2)
  const page = doc.getPage(0).getSize()
  assert.ok(Math.abs(page.width - 9.5 * 72) < 0.1)
  assert.ok(Math.abs(page.height - 7 * 72) < 0.1)
  const back = doc.getPage(1).getSize()
  assert.ok(Math.abs(back.width - 9.5 * 72) < 0.1)
  assert.ok(Math.abs(back.height - 7 * 72) < 0.1)
})

test("postage is labeled an estimate and is not a full checkout price", () => {
  const estimate = eddmPostageEstimate(200)
  assert.equal(estimate.label, "Postage estimate")
  assert.equal(estimate.amountLabel, "$52.00")
  assert.match(estimate.detail, /not a checkout price/i)
  assert.match(estimate.detail, /\$0\.26/)
})

test("retail limits are 200 pieces and 5,000 per ZIP", () => {
  assert.deepEqual(eddmLimitMessages({ pieces: 199, perZip: [{ zip: "10001", pieces: 199 }] }), [
    `Every Door Direct Mail needs at least ${EDDM_MIN_PIECES.toLocaleString("en-US")} pieces. Select more routes.`,
  ])
  const over = eddmLimitMessages({
    pieces: 5001,
    perZip: [{ zip: "10001", pieces: EDDM_MAX_PIECES_PER_ZIP_PER_DAY + 1 }],
  })
  assert.match(over.join(" "), /5,000 pieces per ZIP per day/)
  assert.match(over.join(" "), /10001/)
})

test("filters use age, income, and household size, and a blank figure stays", () => {
  const routes = parseUspsRoutes(SAMPLE)
  assert.equal(routes.length, 2)
  assert.equal(routes[0]?.route, "C001")
  const older = routes.filter((route) => routeMatchesFilter(route, { minMedianAge: 40 }))
  assert.deepEqual(older.map((route) => route.route), ["C071"])
  const rich = routes.filter((route) => routeMatchesFilter(route, { minMedianIncome: 100000 }))
  assert.deepEqual(rich.map((route) => route.route).sort(), ["C001", "C071"])
  const homes = routes.filter((route) => routeMatchesFilter(route, { minHouseholdSize: 1.6 }))
  assert.deepEqual(homes.map((route) => route.route).sort(), ["C001", "C071"])
  const summary = summarizeSelection(routes.map(snapshotRoute), "residential")
  assert.equal(summary.residential, 480)
  assert.equal(summary.business, 41)
  assert.equal(summary.pieces, 480)
  const withBusiness = summarizeSelection(routes.map(snapshotRoute), "residential_and_business")
  assert.equal(withBusiness.pieces, 521)
})

test("web mercator route lines become longitude and latitude", () => {
  const [lng, lat] = toLngLat(-8237741, 4975864)
  assert.ok(lng < -73 && lng > -75)
  assert.ok(lat > 40 && lat < 41)
  const routes = parseUspsRoutes(SAMPLE)
  assert.equal(routes.find((route) => route.route === "C071")?.lines.length, 1)
})

test("a ZIP in an address is used, and a failed feed falls back to the saved routes", async () => {
  assert.equal(extractZip("10001"), "10001")
  assert.equal(extractZip("350 5th Ave, New York, NY 10001"), "10001")
  assert.equal(extractZip("Springfield"), null)

  const directory = await mkdtemp(path.join(tmpdir(), "eddm-cache-"))
  try {
    const saved = await loadEddmRoutes({
      query: "10001",
      cacheDir: directory,
      fetchImpl: async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
      now: Date.parse("2026-10-01T00:00:00.000Z"),
    })
    assert.equal(saved.ok, true)
    assert.equal(saved.source, "usps")
    assert.equal(saved.routes.length, 2)

    const fallback = await loadEddmRoutes({
      query: "10001",
      cacheDir: directory,
      fetchImpl: async () => {
        throw new Error("offline")
      },
      now: Date.parse("2026-10-22T00:00:00.000Z"),
    })
    assert.equal(fallback.ok, true)
    assert.equal(fallback.source, "cache")
    assert.equal(fallback.routes.length, 2)
    assert.match(fallback.message, /isn't available/i)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("neighborhood copy drops a first name", () => {
  assert.equal(toNeighborhoodCopy("Dear Jane, the roof can wait"), "Neighbors, the roof can wait")
  assert.equal(hasRecipientPersonalization("Hi Sam"), true)
  assert.equal(hasRecipientPersonalization("Neighbors on this route"), false)
})

function routeMatches(route: EddmRoute): boolean {
  return route.zip === "10001"
}

test("parsed routes keep the ZIP", () => {
  assert.equal(parseUspsRoutes(SAMPLE).every(routeMatches), true)
})
