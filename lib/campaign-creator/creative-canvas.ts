import type {
  MailPieceCatalogEntry,
  MailPieceCatalogId,
  MailPieceCatalogVersion,
  MailPieceFace,
  MailPieceFamily,
  MailPieceTrimSize,
  ReservedRegionRole,
} from "@/lib/mail-catalog/types"

/**
 * Derived creative-facing projection of a selected immutable catalog version.
 * Not MailPieceCatalogEntry. Not MailPieceSpec. Not persisted on CreativeSpec.
 *
 * Callers resolve the catalog first:
 * getMailPiece(mailPieceSpec.selectedCatalogId, selectedCatalogVersion)
 * then toCreativeCanvas(entry).
 */
export interface CreativeCanvas {
  /** Identity metadata only. Creative must not choose or mutate these. */
  catalogId: MailPieceCatalogId
  catalogVersion: MailPieceCatalogVersion
  family: MailPieceFamily
  displayName: string

  /** Honest trim pair. Not width×height; orientation is unknown in catalog v1. */
  trimSizeInches: MailPieceTrimSize

  faces: readonly MailPieceFace[]
  addressFace: MailPieceFace
  reservedRegionRoles: readonly ReservedRegionRole[]

  /** Design-to-trim-edge intent. Numeric bleed is not in catalog v1. */
  fullBleedExpected: boolean
}

/** Pure projection. Does not look up the catalog or invent missing geometry. */
export function toCreativeCanvas(entry: MailPieceCatalogEntry): CreativeCanvas {
  return {
    catalogId: entry.id,
    catalogVersion: entry.version,
    family: entry.family,
    displayName: entry.displayName,
    trimSizeInches: {
      shortInches: entry.physical.trimSizeInches.shortInches,
      longInches: entry.physical.trimSizeInches.longInches,
    },
    faces: entry.physical.faces,
    addressFace: entry.creativeCanvas.addressFace,
    reservedRegionRoles: entry.creativeCanvas.reservedRegionRoles,
    fullBleedExpected: entry.physical.fullBleedExpected,
  }
}
