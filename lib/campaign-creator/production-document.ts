import { getMailPiece } from "@/lib/mail-catalog/catalog"
import type { MailPieceFace } from "@/lib/mail-catalog/types"

import type { Campaign, ProductionDocument } from "./types"

function hasClosedFrontBackPair(faces: readonly MailPieceFace[]): boolean {
  return (
    faces.length === 2 && faces.includes("front") && faces.includes("back")
  )
}

/**
 * Deterministic production interpretation of the current MailPiece.
 * Does not mutate or persist Campaign.
 */
export function deriveProductionDocument(
  campaign: Campaign,
  now: string
): ProductionDocument {
  const mailPiece = campaign.mailPiece
  if (!mailPiece) {
    throw new Error(`Campaign ${campaign.id} is missing a current mail piece.`)
  }

  const mailPieceSpec = campaign.mailPieceSpec
  if (!mailPieceSpec) {
    throw new Error(`Campaign ${campaign.id} is missing a mail piece spec.`)
  }

  const addressFaceAuthorship = mailPieceSpec.addressFaceAuthorship
  if (
    addressFaceAuthorship !== "customer" &&
    addressFaceAuthorship !== "fulfillment"
  ) {
    throw new Error(
      `Campaign ${campaign.id} is missing a valid address-face authorship.`
    )
  }

  const catalogEntry = getMailPiece(mailPiece.catalogId, mailPiece.catalogVersion)

  if (!hasClosedFrontBackPair(catalogEntry.physical.faces)) {
    throw new Error(
      `Catalog ${mailPiece.catalogId} v${mailPiece.catalogVersion} does not expose a closed front/back face pair.`
    )
  }

  if (catalogEntry.creativeCanvas.addressFace !== "back") {
    throw new Error(
      `Catalog ${mailPiece.catalogId} v${mailPiece.catalogVersion} address face is not back.`
    )
  }

  if (
    mailPieceSpec.selectedCatalogId !== mailPiece.catalogId ||
    mailPieceSpec.selectedCatalogVersion !== mailPiece.catalogVersion
  ) {
    throw new Error(
      `Campaign ${campaign.id} mail piece catalog identity does not match the selected catalog.`
    )
  }

  return {
    id: crypto.randomUUID(),
    mailPieceId: mailPiece.id,
    mailPieceVersion: mailPiece.version,
    catalogId: mailPiece.catalogId,
    catalogVersion: mailPiece.catalogVersion,
    faces: {
      front: "customer",
      back: addressFaceAuthorship,
    },
    derivedAt: now,
  }
}
