import { randomUUID } from "node:crypto"

import type { Campaign, CampaignCreative, UploadedDesign } from "./types"

/** One copied design on a new draft. Approval, payment, and mail status stay behind. */
export function duplicateCampaign(
  source: Campaign,
  now: string,
  id: string = randomUUID(),
  name?: string
): Campaign {
  const baseName = (source.name || source.brief.businessInfo?.name || "Campaign").replace(/\s+/g, " ").trim() || "Campaign"
  const copyName = (name?.replace(/\s+/g, " ").trim() || `${baseName} (copy)`).slice(0, 80)
  const creative = oneDesign(structuredClone(source.creative))
  const uploaded = freshUpload(source.uploadedDesign)
  const hasDesign = creative.directions.length > 0 || Boolean(uploaded?.front || uploaded?.back)
  return {
    id,
    ownerId: source.ownerId,
    name: copyName,
    entry: source.entry,
    status: hasDesign ? "creative_ready" : "draft",
    brief: structuredClone(source.brief),
    creative,
    transcript: [],
    designSource: source.designSource,
    uploadedDesign: uploaded,
    mailPieceSpec: source.mailPieceSpec ? structuredClone(source.mailPieceSpec) : undefined,
    jobCreative: source.jobCreative ? structuredClone(source.jobCreative) : undefined,
    readyForBriefReview: false,
    createdAt: now,
    updatedAt: now,
  }
}

function oneDesign(creative: CampaignCreative): CampaignCreative {
  const selected = creative.directions.find((direction) => direction.id === creative.selectedDirectionId)
  const directions = (selected ? [selected] : creative.directions.slice(0, 1)).map((direction) => ({ ...direction }))
  const kept = new Set(directions.map((direction) => direction.id))
  return {
    directions,
    recommendation: creative.recommendation && kept.has(creative.recommendation.directionId) ? creative.recommendation : undefined,
    recommendedDirectionId: directions[0]?.id,
    selectedDirectionId: directions[0]?.id,
    revisions: creative.revisions.filter((revision) => kept.has(revision.directionId)),
    activeSpec: creative.activeSpec ? structuredClone(creative.activeSpec) : undefined,
    activeRevisionId: creative.revisions.find((revision) => revision.id === creative.activeRevisionId && kept.has(revision.directionId))?.id,
  }
}

function freshUpload(design: UploadedDesign | undefined): UploadedDesign | undefined {
  if (!design) return undefined
  return {
    front: design.front,
    back: design.back,
    issues: [...design.issues],
    checkedAt: design.checkedAt,
    review: design.review,
  }
}
