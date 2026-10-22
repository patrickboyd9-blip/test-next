import { eddmKeepOuts, eddmTrim, EDDM_BLEED_INCHES } from "@/lib/eddm/geometry"

import type { MailPieceCatalogEntry } from "../types"

/**
 * 6.25×11 postcard, catalog version 1. Immutable going forward.
 * Landscape trim is 11 × 6.25 in. One side is longer than 10.5 in, so it
 * qualifies as an EDDM flat.
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
      rectangles: eddmKeepOuts(trim.widthInches),
    },
  },
  provenance: {
    sources: [
      "USPS EDDM Retail indicia zone: 1.625 in from the right edge and 1.375 in from the top, with 1/8 in clearance",
      "Click2Mail lists a 6.25×11 Every Door card. The vendor bleed file is not published here.",
    ],
    notes:
      "Finished trim is 11 in × 6.25 in landscape. Artwork canvas adds 0.25 in bleed on each side, the same bleed as the 5×8 postcard, until a vendor template replaces it. The indicia keep-out is the USPS zone. The Postal Customer block sits to its left and slightly lower. There is no per-address barcode strip.",
  },
  openQuestions: [
    "Click2Mail has not confirmed the bleed, safe zone, or the exact Postal Customer line for this size.",
    "Whether Click2Mail prints the EDDM indicia on top of the reserved zone is not confirmed.",
  ],
}
