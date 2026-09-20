/**
 * Canonical, vendor-neutral mail-piece catalog.
 *
 * Catalog answers: "What physical things can Modern Mail produce?"
 * A campaign-level MailPieceSpec (not defined here) will later answer:
 * "What physical thing did we select for this campaign?"
 *
 * This module must not contain Click2Mail (or any vendor) identifiers,
 * job options, or pricing.
 *
 * Catalog versions are immutable. Changing a mail piece means adding a new
 * version (e.g. postcard_5x8 v2), never editing an existing version.
 */

export type MailPieceCatalogId = "postcard_5x8"

/** Published immutable versions. Grows as new versions are added; never reused. */
export type MailPieceCatalogVersion = 1

export type MailPieceFamily = "postcard"

export type MailPieceFace = "front" | "back"

export type MailPieceOrientation = "landscape" | "portrait"

/**
 * Origin for catalog geometry in inches.
 * Keep-out rectangles use trim top-left, not artwork-canvas top-left.
 */
export type MailPieceGeometryOrigin = "trim_top_left"

/**
 * Roles that a mailed postcard must reserve on the address face.
 * Numeric keep-out geometry, when known, lives on `reservedKeepOut`.
 */
export type ReservedRegionRole =
  | "delivery_address"
  | "return_address"
  | "postage_indicia"
  | "barcode_clear_zone"

export interface MailPieceTrimSize {
  /** Smaller edge of the finished piece, in inches. */
  shortInches: number
  /** Longer edge of the finished piece, in inches. */
  longInches: number
}

export interface MailPieceInchesSize {
  widthInches: number
  heightInches: number
}

export interface MailPieceInchesRect {
  xInches: number
  yInches: number
  widthInches: number
  heightInches: number
}

export interface ReservedKeepOutRect extends MailPieceInchesRect {
  /** Stable catalog identifier for this rectangle. Not a vendor template id. */
  id: string
}

/**
 * Unprintable keep-out on the address face.
 * The keep-out is the union of `rectangles` (a stepped polygon when they overlap).
 * Content inside the union is not printed.
 */
export interface ReservedKeepOut {
  origin: MailPieceGeometryOrigin
  rectangles: readonly ReservedKeepOutRect[]
}

export interface MailPiecePhysicalSpec {
  trimSizeInches: MailPieceTrimSize
  /** Finished-piece orientation. Width is the horizontal edge. */
  orientation: MailPieceOrientation
  /** Finished trim as width × height, in inches. */
  finishedTrimInches: MailPieceInchesSize
  /** Bleed-inclusive artwork/document canvas as width × height, in inches. */
  artworkCanvasInches: MailPieceInchesSize
  /**
   * Bleed beyond finished trim on each of the four sides, in inches.
   * Distinct from `imageBleedExtensionMinimumInches`.
   */
  bleedInchesPerSide: number
  /**
   * Minimum distance images must extend past trim into the bleed, in inches.
   * Distinct from `bleedInchesPerSide`; not the artboard size.
   */
  imageBleedExtensionMinimumInches: number
  /** Two faces of the physical piece. Print-side job options are production-layer. */
  faces: readonly MailPieceFace[]
  /** This product is expected to print to the trimmed edge. */
  fullBleedExpected: boolean
}

export interface MailPieceCreativeCanvas {
  /** Face that carries USPS address, postage, and barcode regions when mailed. */
  addressFace: MailPieceFace
  reservedRegionRoles: readonly ReservedRegionRole[]
  /** Recommended text inset inside finished trim, in inches. Not bleed. */
  recommendedSafeTextInsetInches: number
  /**
   * Address-face keep-out. Coordinates are relative to `origin` (trim top-left),
   * not the top-left of the bleed-inclusive artwork canvas.
   *
   * Verified for the customer-designed address face (double-sided page 2).
   * Single-sided page-2 mailing-face coordinates are not encoded.
   */
  reservedKeepOut: ReservedKeepOut
}

export interface MailPieceCatalogProvenance {
  /** Evidence that supports this entry. */
  sources: readonly string[]
  notes: string
}

export interface MailPieceCatalogEntry {
  id: MailPieceCatalogId
  version: MailPieceCatalogVersion
  family: MailPieceFamily
  displayName: string
  /** Why this format is a meaningful customer-facing strategy choice. */
  strategicRationale: string
  physical: MailPiecePhysicalSpec
  creativeCanvas: MailPieceCreativeCanvas
  provenance: MailPieceCatalogProvenance
  openQuestions: readonly string[]
}
