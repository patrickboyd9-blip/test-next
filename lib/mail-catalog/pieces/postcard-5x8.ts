import type { MailPieceCatalogEntry } from "../types"

/**
 * 5×8 Postcard, catalog version 1. Immutable.
 *
 * Facts below are limited to what docs/CLICK2MAIL_DUE_DILIGENCE.md
 * establishes for this product, plus vendor-neutral mailed-postcard
 * canvas intent. Click2Mail SKUs, paper, coating, mail class, pricing,
 * production windows, and unverified inch measurements are omitted.
 *
 * Future changes ship as POSTCARD_5X8_V2, not edits to this object.
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
  },
  provenance: {
    sources: [
      "docs/CLICK2MAIL_DUE_DILIGENCE.md §8 (5×8 postcard specifications)",
      "docs/CLICK2MAIL_DUE_DILIGENCE.md §9 (mailed address-side region roles; numeric geometry not adopted)",
    ],
    notes:
      "Trim size, oversized positioning, two-sided availability, and full-bleed as the expected design are [DOC] for the 5×8 product. Address-side region roles are the vendor-neutral mailed-postcard canvas, not Click2Mail layout enums. Which edge is width vs height is not stated in the diligence; only the 5×8 pair is recorded. A 5×8 product note places return address 1/4″ from the top-left if included, and a no-bleed alternative uses a 1/8″ border — both omitted so partial measurements are not treated as canonical geometry.",
  },
  openQuestions: [
    "5×8-specific numeric spec sheet (bleed, safe area, trim tolerance, resolution, color, address-panel geometry) is outstanding — diligence §8, §9, §15.1. General Click2Mail blog measurements are not confirmed for this size and are not part of this definition.",
    "Landscape vs portrait (8×5 vs 5×8 as width×height) is not established in the diligence.",
  ],
}
