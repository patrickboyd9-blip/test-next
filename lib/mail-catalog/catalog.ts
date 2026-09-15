import { POSTCARD_5X8_V1 } from "./pieces/postcard-5x8"
import type {
  MailPieceCatalogEntry,
  MailPieceCatalogId,
  MailPieceCatalogVersion,
} from "./types"

/**
 * Nested by catalog id, then immutable version.
 * A future postcard_5x8 v2 is added as a sibling of v1, not a replacement.
 */
export const MAIL_PIECE_CATALOG: {
  [Id in MailPieceCatalogId]: {
    [Version in MailPieceCatalogVersion]?: MailPieceCatalogEntry
  }
} = {
  postcard_5x8: {
    1: POSTCARD_5X8_V1,
  },
}

export function getMailPiece(
  id: MailPieceCatalogId,
  version: MailPieceCatalogVersion
): MailPieceCatalogEntry {
  const entry = MAIL_PIECE_CATALOG[id][version]
  if (!entry) {
    throw new Error(`Unknown mail piece catalog version: ${id} v${version}`)
  }
  return entry
}
