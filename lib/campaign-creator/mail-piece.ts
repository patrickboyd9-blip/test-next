import { getMailPiece } from "@/lib/mail-catalog/catalog"

import { cloneSpec } from "./spec-diff"
import { getActiveRevision, getActiveSpec } from "./creative-state"
import type { Campaign, MailPiece } from "./types"

/**
 * Persist MailPieceSpec at Confirm strategy if missing. Write-once: an existing
 * spec is never patched, including legacy records that omit newer fields.
 */
export function applyStrategyConfirmation(campaign: Campaign, now: string): void {
  if (!campaign.mailPieceSpec) {
    // Beta: only postcard_5x8 v1 exists. Not a product rule that 5×8 is always recommended.
    const catalogPiece = getMailPiece("postcard_5x8", 1)
    campaign.mailPieceSpec = {
      recommendedCatalogId: catalogPiece.id,
      recommendedCatalogVersion: catalogPiece.version,
      selectedCatalogId: catalogPiece.id,
      selectedCatalogVersion: catalogPiece.version,
      customerOverride: false,
      decidedAt: now,
      decidedBy: campaign.ownerId,
      addressFaceAuthorship: "fulfillment",
    }
  }

  campaign.status = "strategy_confirmed"
  campaign.updatedAt = now
}

export function nextMailPieceVersion(
  history: readonly MailPiece[] | undefined
): number {
  if (!history || history.length === 0) return 1
  return Math.max(...history.map((piece) => piece.version)) + 1
}

export function getCurrentMailPiece(campaign: Campaign): MailPiece | undefined {
  return campaign.mailPiece
}

export function applyCreativeApproval(campaign: Campaign, now: string): MailPiece {
  const directionId = campaign.creative.selectedDirectionId
  if (!directionId) throw new Error("No direction selected")

  const activeRevision = getActiveRevision(campaign.creative, directionId)
  if (!activeRevision) throw new Error("No active revision to approve")

  const activeSpec =
    campaign.creative.activeSpec ?? getActiveSpec(campaign.creative, directionId)
  if (!activeSpec) throw new Error("No active spec to approve")

  const mailPieceSpec = campaign.mailPieceSpec
  if (!mailPieceSpec) {
    throw new Error(
      `Campaign ${campaign.id} is missing a mail piece spec. Confirm strategy before approving creative.`
    )
  }

  const spec = cloneSpec(activeSpec)
  const piece: MailPiece = {
    id: crypto.randomUUID(),
    version: nextMailPieceVersion(campaign.mailPieceVersions),
    approvedAt: now,
    directionId,
    revisionId: activeRevision.id,
    catalogId: mailPieceSpec.selectedCatalogId,
    catalogVersion: mailPieceSpec.selectedCatalogVersion,
    spec,
  }

  campaign.mailPieceVersions = [...(campaign.mailPieceVersions ?? []), piece]
  campaign.mailPiece = piece
  campaign.creative.approvedRevisionId = piece.revisionId
  campaign.creative.approvedSpec = cloneSpec(spec)
  campaign.status = "creative_approved"
  campaign.updatedAt = now
  return piece
}

export function applyCreativeUnapproval(campaign: Campaign, now: string): void {
  campaign.mailPiece = undefined
  campaign.creative.approvedRevisionId = undefined
  campaign.creative.approvedSpec = undefined
  campaign.status = "creative_ready"
  campaign.updatedAt = now
}
