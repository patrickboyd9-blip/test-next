import { randomUUID } from "crypto"

import { isAtOrPastStatus } from "@/lib/campaign-creator/campaign-status"
import { assignDefaultMailPieceSpec } from "@/lib/campaign-creator/mail-piece"
import { cloneSpec } from "@/lib/campaign-creator/spec-diff"
import type {
  Campaign,
  CreativeDirection,
  CreativeRevision,
} from "@/lib/campaign-creator/types"

import type { MailTemplate } from "./types"
import { TEMPLATE_INDUSTRY_LABELS } from "./types"

/**
 * Loads a catalog mailer into the existing Studio path.
 * Writes the 5×8 mail piece the printer already uses. Does not edit that
 * geometry, and does not touch the 6×9 print spec.
 */
export function applyTemplateStart(
  campaign: Campaign,
  template: MailTemplate,
  now: string
): void {
  const approved =
    Boolean(campaign.mailPiece) || isAtOrPastStatus(campaign.status, "creative_approved")
  if (approved) {
    throw new Error("Unapprove the postcard before starting from a template.")
  }

  const fresh = campaign.status === "draft" && !campaign.designSource
  if (!fresh) {
    throw new Error("Start from the first screen to use a template.")
  }

  const spec = cloneSpec(template.spec)
  const directionId = randomUUID()
  const revisionId = randomUUID()
  const direction: CreativeDirection = {
    id: directionId,
    name: template.name,
    rationale: template.summary,
    oneLineDifference: template.summary,
    designedToDrive: spec.callToAction ?? template.summary,
    tags: [TEMPLATE_INDUSTRY_LABELS[template.industry], "Template"],
    spec,
    recommended: true,
    createdAt: now,
  }
  const revision: CreativeRevision = {
    id: revisionId,
    directionId,
    version: 1,
    spec: cloneSpec(spec),
    customerPrompt: "Original template",
    studioResponse: "",
    type: "refinement",
    createdAt: now,
  }

  campaign.name = template.name
  campaign.entry = "template"
  campaign.designSource = "studio"
  campaign.brief = {
    ...campaign.brief,
    goal: template.summary,
    offer: spec.offer,
    phone: spec.phone,
    website: spec.website,
    qrDestination: spec.qrDestination,
    emotionalTone: spec.tone,
    desiredRecipientAction: spec.callToAction,
    businessInfo: {
      ...campaign.brief.businessInfo,
      name: template.sampleBusinessName,
      phone: spec.phone,
      website: spec.website,
    },
  }
  assignDefaultMailPieceSpec(campaign, now)
  campaign.creative = {
    directions: [direction],
    recommendation: {
      directionId,
      headline: template.name,
      rationale: template.summary,
    },
    recommendedDirectionId: directionId,
    selectedDirectionId: directionId,
    revisions: [revision],
    activeSpec: cloneSpec(spec),
    activeRevisionId: revisionId,
  }
  campaign.status = "creative_ready"
  campaign.readyForBriefReview = false
  campaign.updatedAt = now
}
