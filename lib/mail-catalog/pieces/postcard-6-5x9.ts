import { eddmKeepOuts, eddmTrim, EDDM_BLEED_INCHES } from "@/lib/eddm/geometry"

import type { MailPieceCatalogEntry } from "../types"

/**
 * 6.5×9 postcard, catalog version 1. Immutable going forward.
 * Landscape trim is 9 × 6.5 in, which clears the EDDM flat minimum.
 * Bleed matches the other Modern Mail postcards until Click2Mail publishes
 * a template for this size.
 */
const trim = eddmTrim("6.5x9")

export const POSTCARD_6_5X9_V1: MailPieceCatalogEntry = {
  id: "postcard_6_5x9",
  version: 1,
  family: "postcard",
  displayName: "6.5×9 Postcard",
  strategicRationale:
    "An Every Door Direct Mail flat. Large enough for a neighborhood offer, with a Postal Customer address and an EDDM indicia zone.",
  physical: {
    trimSizeInches: { shortInches: 6.5, longInches: 9 },
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
      "Click2Mail lists a 6.5×9 Every Door card. The vendor bleed file is not published here.",
    ],
    notes:
      "Finished trim is 9 in × 6.5 in landscape. Artwork canvas adds 0.25 in bleed on each side, the same bleed as the 5×8 postcard, until a vendor template replaces it. The indicia keep-out is the USPS zone. The Postal Customer block sits to its left and slightly lower, so the indicia is above and to the right of the address. There is no per-address barcode strip.",
  },
  openQuestions: [
    "Click2Mail has not confirmed the bleed, safe zone, or the exact Postal Customer line for this size.",
    "Whether Click2Mail prints the EDDM indicia on top of the reserved zone is not confirmed.",
  ],
}
