import type { MailPieceCatalogEntry } from "../types"

/**
 * 5×8 Postcard, catalog version 1. Immutable going forward.
 *
 * Numeric production geometry below is the verified 5×8 template / product-sheet
 * definition. Further changes ship as POSTCARD_5X8_V2, not edits to this object.
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
      rectangles: [
        {
          id: "mailing_panel",
          xInches: 4.3125,
          yInches: 2.125,
          widthInches: 3.6875,
          heightInches: 2.875,
        },
        {
          id: "barcode_strip",
          xInches: 2.0,
          yInches: 4.375,
          widthInches: 6.0,
          heightInches: 0.625,
        },
      ],
    },
  },
  provenance: {
    sources: [
      "Click2Mail 5×8 template files (finished trim, artwork canvas, 0.25 in bleed per side, double-sided reserved keep-out)",
      "Click2Mail 5×8 product sheet (8 in × 5 in landscape; 8.5 in × 5.5 in document size)",
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
