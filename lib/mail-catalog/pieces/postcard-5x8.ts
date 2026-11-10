import { click2MailKeepOuts } from "@/lib/print-spec/click2mail-keep-outs"

import type { MailPieceCatalogEntry } from "../types"

/**
 * 5×8 Postcard, catalog version 1. Immutable going forward.
 *
 * Page size stays the verified template. The address panel and barcode clear
 * zone use the point sizes confirmed on 2026-11-10, still on version 1.
 *
 * Click2Mail SKUs, paper, coating, mail class, pricing, production windows,
 * API identifiers, and unverified measurements are omitted.
 */
export const POSTCARD_5X8_V1: MailPieceCatalogEntry = {
  id: "postcard_5x8",
  version: 1,
  family: "postcard",
  displayName: "5×8 Postcard",
  strategicRationale:
    "Oversized relative to a standard postcard, with enough room for a before/after story and offer.",
  physical: {
    trimSizeInches: {
      shortInches: 5,
      longInches: 8,
    },
    orientation: "landscape",
    finishedTrimInches: {
      widthInches: 8,
      heightInches: 5,
    },
    artworkCanvasInches: {
      widthInches: 8.5,
      heightInches: 5.5,
    },
    bleedInchesPerSide: 0.25,
    imageBleedExtensionMinimumInches: 0.125,
    faces: ["front", "back"],
    fullBleedExpected: true,
  },
  creativeCanvas: {
    addressFace: "back",
    reservedRegionRoles: [
      "delivery_address",
      "return_address",
      "postage_indicia",
      "barcode_clear_zone",
    ],
    recommendedSafeTextInsetInches: 0.25,
    reservedKeepOut: {
      origin: "trim_top_left",
      rectangles: click2MailKeepOuts("5x8", 8, 5),
    },
  },
  provenance: {
    sources: [
      "Click2Mail 5×8 template files (finished trim, artwork canvas, 0.25 in bleed per side, double-sided reserved keep-out)",
      "Click2Mail 5×8 product sheet (8 in × 5 in landscape; 8.5 in × 5.5 in document size)",
      "David Webster, Click2Mail, email 2026-11-10: address box 265.5 × 208 pt and barcode clear zone 433 × 46 pt, from the bottom-right of the trim",
    ],
    notes:
      "Physical geometry is the verified 5×8 template and product-sheet definition, not the general Click2Mail blog 1/8 in bleed. Artwork canvas is 8.5 in × 5.5 in because bleed is 0.25 in on all four sides. Image-extension minimum of 1/8 in into the bleed is a separate template callout and is not the bleed or the artboard. Keep-out rectangles are relative to the top-left of finished trim, not artwork-canvas origin. Their union is the unprintable address-face keep-out (stepped polygon). Address-side region roles are the vendor-neutral mailed-postcard canvas, not Click2Mail layout enums. Two vendor template layouts exist (single-sided and double-sided); they are not catalog architecture. Double-sided page 2 is a creative face with this reserved mailing region (postal address, delivery barcode, and associated mailing information). Single-sided customer content is page 1 only; page-2 mailing-face coordinates are not encoded.",
  },
  openQuestions: [
    "Exact indicia rectangle and return-address typography-box coordinates are not verified and are not part of this definition.",
    "Single-sided page-2 reserved coordinates are not verified; that mailing face is vendor-generated and is not encoded.",
    "Resolution, color space, and trim tolerance are not part of this definition.",
  ],
}
