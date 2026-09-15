/**
 * Canonical, vendor-neutral mail-piece catalog.
 *
 * Catalog answers: "What physical things can Modern Mail produce?"
 * A campaign-level MailPieceSpec (not defined here) will later answer:
 * "What physical thing did we select for this campaign?"
 *
 * This module must not contain Click2Mail (or any vendor) identifiers,
 * job options, or pricing.
 */

export type MailPieceCatalogId = "postcard_5x8"

export type MailPieceFamily = "postcard"

export type MailPieceFace = "front" | "back"

/**
 * Roles that a mailed postcard must reserve on the address face.
 * Geometry (inches, DPI, color) is intentionally omitted until a
 * 5×8-specific spec sheet exists — see diligence §8, §9, and §15.1.
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

export interface MailPiecePhysicalSpec {
  trimSizeInches: MailPieceTrimSize
  /** Two faces of the physical piece. Print-side job options are production-layer. */
  faces: readonly MailPieceFace[]
  /**
   * This product is expected to print to the trimmed edge.
   * Confirmed for the 5×8 postcard; numeric bleed allowance is not.
   */
  fullBleedExpected: boolean
}

export interface MailPieceCreativeCanvas {
  /** Face that carries USPS address, postage, and barcode regions when mailed. */
  addressFace: MailPieceFace
  reservedRegionRoles: readonly ReservedRegionRole[]
}

export interface MailPieceCatalogProvenance {
  /** Paths into docs/CLICK2MAIL_DUE_DILIGENCE.md that support this entry. */
  sources: readonly string[]
  notes: string
}

export interface MailPieceCatalogEntry {
  id: MailPieceCatalogId
  family: MailPieceFamily
  displayName: string
  /** Why this format is a meaningful customer-facing strategy choice. */
  strategicRationale: string
  physical: MailPiecePhysicalSpec
  creativeCanvas: MailPieceCreativeCanvas
  provenance: MailPieceCatalogProvenance
  openQuestions: readonly string[]
}
