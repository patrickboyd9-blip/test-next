import { cloneSpec } from "./spec-diff"
import { getActiveRevision, getActiveSpec } from "./creative-state"
import type { Campaign, MailPiece } from "./types"

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
