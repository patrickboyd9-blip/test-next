import { eddmAudienceDescription, eddmAudienceIssue } from "@/lib/eddm/validate"
import { isEddmSize, type EddmSize } from "@/lib/eddm/geometry"
import { toNeighborhoodCopy } from "@/lib/eddm/copy"
import { summarizeSelection } from "@/lib/eddm/routes"
import { getMailPiece } from "@/lib/mail-catalog/catalog"
import type { MailPieceCatalogId } from "@/lib/mail-catalog/types"

import { cloneSpec } from "./spec-diff"
import { getActiveRevision, getActiveSpec } from "./creative-state"
import { applyAiDesignOnStrategyConfirm } from "./start-path"
import type { Campaign, MailPiece } from "./types"

/**
 * Write the beta 5×8 mail piece when a campaign does not have one yet.
 * Write-once: an existing spec is never patched, including legacy records.
 */
const EDDM_CATALOG: Record<EddmSize, MailPieceCatalogId> = {
  "6.5x9": "postcard_6_5x9",
  "6.25x11": "postcard_6_25x11",
}

export function assignDefaultMailPieceSpec(
  campaign: Campaign,
  now: string,
  catalogId: MailPieceCatalogId = "postcard_5x8"
): void {
  if (campaign.mailPieceSpec) return
  const catalogPiece = getMailPiece(catalogId, 1)
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

/**
 * The customer chose an EDDM flat after the 5×8 default was written.
 * The recommended id stays. The selected id becomes the flat they will mail.
 */
export function applyEddmCatalog(campaign: Campaign, size: EddmSize, now: string): void {
  const catalogPiece = getMailPiece(EDDM_CATALOG[size], 1)
  if (!campaign.mailPieceSpec) {
    assignDefaultMailPieceSpec(campaign, now, catalogPiece.id)
  }
  const spec = campaign.mailPieceSpec
  if (!spec) return
  const changed = spec.selectedCatalogId !== catalogPiece.id
  campaign.mailPieceSpec = {
    ...spec,
    selectedCatalogId: catalogPiece.id,
    selectedCatalogVersion: catalogPiece.version,
    customerOverride: changed || spec.customerOverride,
    decidedAt: now,
  }
  if (campaign.mailPiece) {
    campaign.mailPiece = {
      ...campaign.mailPiece,
      catalogId: catalogPiece.id,
      catalogVersion: catalogPiece.version,
      spec: neighborhoodSpec(campaign.mailPiece.spec, campaign.brief.audience?.eddm?.neighborhood),
    }
  }
}

export function assertEddmAudience(campaign: Campaign): void {
  const audience = campaign.brief.audience
  if (audience?.delivery !== "eddm") return
  const text = [
    campaign.brief.goal,
    campaign.brief.offer,
    audience.description,
    audience.eddm?.neighborhood,
    campaign.brief.otherRequirements,
  ]
    .filter(Boolean)
    .join(" ")
  const issue = eddmAudienceIssue({ text, audience: audience.eddm })
  if (issue) throw new Error(issue)
  if (!audience.eddm || !isEddmSize(audience.eddm.size)) return
  const summary = summarizeSelection(audience.eddm.routes, audience.eddm.coverage)
  audience.quantity = summary.pieces
  if (!audience.description.trim() || audience.description === "Every door in this area") {
    audience.description = eddmAudienceDescription(audience.eddm)
  }
}

function neighborhoodSpec<T extends { headline?: string; subheadline?: string; body?: string; offer?: string; callToAction?: string }>(
  spec: T,
  neighborhood?: string
): T {
  return {
    ...spec,
    headline: spec.headline ? toNeighborhoodCopy(spec.headline, neighborhood) : spec.headline,
    subheadline: spec.subheadline ? toNeighborhoodCopy(spec.subheadline, neighborhood) : spec.subheadline,
    body: spec.body ? toNeighborhoodCopy(spec.body, neighborhood) : spec.body,
    offer: spec.offer ? toNeighborhoodCopy(spec.offer, neighborhood) : spec.offer,
    callToAction: spec.callToAction ? toNeighborhoodCopy(spec.callToAction, neighborhood) : spec.callToAction,
  }
}

export function applyStrategyConfirmation(campaign: Campaign, now: string): void {
  assignDefaultMailPieceSpec(campaign, now)
  applyAiDesignOnStrategyConfirm(campaign)
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
