import { randomUUID } from "crypto"

import { isAtOrPastStatus } from "@/lib/campaign-creator/campaign-status"
import { assignDefaultMailPieceSpec } from "@/lib/campaign-creator/mail-piece"
import type { MailPieceCatalogId } from "@/lib/mail-catalog/types"
import { isEddmSize } from "@/lib/eddm/geometry"
import { cloneSpec } from "@/lib/campaign-creator/spec-diff"
import type {
  Campaign,
  CreativeDirection,
  CreativeRevision,
} from "@/lib/campaign-creator/types"

import type { MailTemplate } from "./types"
import { TEMPLATE_INDUSTRY_LABELS } from "./types"

/**
 * Loads a catalog mailer into Studio.
 * A 5×8 template keeps the addressed postcard. An Every Door template
 * selects the 6.5×9 or 6.25×11 catalog piece.
 */
function catalogIdForTemplate(template: MailTemplate): MailPieceCatalogId {
  if (template.size === "6.5x9") return "postcard_6_5x9"
  if (template.size === "6.25x11") return "postcard_6_25x11"
  return "postcard_5x8"
}

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
  assignDefaultMailPieceSpec(campaign, now, catalogIdForTemplate(template))
  if (isEddmSize(template.size)) {
    campaign.brief = {
      ...campaign.brief,
      audience: {
        description: "Every door in this area",
        delivery: "eddm",
        eddm: {
          query: "",
          zip: "",
          coverage: "residential",
          size: template.size,
          filters: {},
          selectedRouteIds: [],
          routes: [],
        },
      },
    }
  }
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
