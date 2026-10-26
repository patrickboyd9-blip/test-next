import { eddmKeepOuts, eddmTrim, EDDM_BLEED_INCHES } from "@/lib/eddm/geometry"

import type { MailPieceCatalogEntry } from "../types"

/**
 * 6.25×11 postcard, catalog version 1.
 * Landscape trim is 11 × 6.25 in. One side is longer than 10.5 in, so it
 * qualifies as an Every Door flat. Bleed and the address block come from
 * the Click2Mail Word template.
 */
const trim = eddmTrim("6.25x11")

export const POSTCARD_6_25X11_V1: MailPieceCatalogEntry = {
  id: "postcard_6_25x11",
  version: 1,
  family: "postcard",
  displayName: "6.25×11 Postcard",
  strategicRationale:
    "The larger Every Door Direct Mail flat. Room for a neighborhood offer, a Postal Customer address, and the EDDM indicia zone.",
  physical: {
    trimSizeInches: { shortInches: 6.25, longInches: 11 },
    orientation: "landscape",
    finishedTrimInches: { widthInches: trim.widthInches, heightInches: trim.heightInches },
    artworkCanvasInches: {
      widthInches: trim.widthInches + EDDM_BLEED_INCHES * 2,
      heightInches: trim.heightInches + EDDM_BLEED_INCHES * 2,
    },
    bleedInchesPerSide: EDDM_BLEED_INCHES,
    imageBleedExtensionMinimumInches: 0.125,
    faces: ["front", "back"],
    fullBleedExpected: true,
  },
  creativeCanvas: {
    addressFace: "back",
    reservedRegionRoles: ["delivery_address", "postage_indicia", "return_address"],
    recommendedSafeTextInsetInches: 0.25,
    reservedKeepOut: {
      origin: "trim_top_left",
      rectangles: eddmKeepOuts(trim),
    },
  },
  provenance: {
    sources: [
      "Click2Mail Every Door Word template, 6.25×11, downloaded Oct 26, 2026 from https://templates.click2mail.com/every-door-direct-mail/6.25x11",
    ],
    notes:
      "Finished trim is 11 in × 6.25 in landscape. The template page is 11.5 in × 6.75 in, so bleed is 0.25 in on each side. The white address block on the back is 4 in × 2 in, flush to the bottom-right of the trim. Click2Mail prints Postal Customer and the indicia there. The print file leaves that rectangle blank. There is no per-address barcode strip.",
  },
  openQuestions: [
    "Click2Mail's live product-name strings for this size still need a staging job to confirm.",
  ],
}
