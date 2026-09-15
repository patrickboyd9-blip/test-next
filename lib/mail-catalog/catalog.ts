import { POSTCARD_5X8 } from "./pieces/postcard-5x8"
import type { MailPieceCatalogEntry, MailPieceCatalogId } from "./types"

export const MAIL_PIECE_CATALOG: Record<
  MailPieceCatalogId,
  MailPieceCatalogEntry
> = {
  postcard_5x8: POSTCARD_5X8,
}

export function getMailPiece(id: MailPieceCatalogId): MailPieceCatalogEntry {
  return MAIL_PIECE_CATALOG[id]
}
