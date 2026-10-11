import { nextMailPieceVersion } from "@/lib/campaign-creator/mail-piece"
import { cloneSpec } from "@/lib/campaign-creator/spec-diff"
import type { Campaign, CreativeSpec, MailPiece } from "@/lib/campaign-creator/types"

import { preflightBlocksApproval } from "./preflight"

export function applyUploadedDesignApproval(
  campaign: Campaign,
  now: string,
  printFileKey: string
): MailPiece {
  if (campaign.designSource !== "upload") {
    throw new Error("This campaign is not using an uploaded design.")
  }
  const design = campaign.uploadedDesign
  if (!design?.front || !design.back) {
    throw new Error("Upload the front and the back before approving.")
  }
  if (preflightBlocksApproval(design.issues)) {
    throw new Error("Fix the file problems before approving.")
  }
  const mailPieceSpec = campaign.mailPieceSpec
  if (!mailPieceSpec) {
    throw new Error("Confirm the strategy before approving the design.")
  }

  const spec: CreativeSpec = {
    headline: campaign.brief.businessInfo?.name?.trim() || "Uploaded design",
    visualDirection: "Customer-uploaded artwork",
  }
  const piece: MailPiece = {
    id: crypto.randomUUID(),
    version: nextMailPieceVersion(campaign.mailPieceVersions),
    approvedAt: now,
    directionId: "uploaded-design",
    revisionId: "uploaded-design",
    catalogId: mailPieceSpec.selectedCatalogId,
    catalogVersion: mailPieceSpec.selectedCatalogVersion,
    spec,
  }

  campaign.mailPieceVersions = [...(campaign.mailPieceVersions ?? []), piece]
  campaign.mailPiece = piece
  campaign.creative.approvedSpec = cloneSpec(spec)
  campaign.creative.approvedRevisionId = piece.revisionId
  campaign.uploadedDesign = {
    ...design,
    approvedAt: now,
    printFileKey,
  }
  campaign.status = "creative_approved"
  campaign.updatedAt = now
  return piece
}

export function clearUploadedDesignApproval(campaign: Campaign): void {
  if (!campaign.uploadedDesign) return
  campaign.uploadedDesign = {
    ...campaign.uploadedDesign,
    approvedAt: undefined,
    printFileKey: undefined,
  }
}
