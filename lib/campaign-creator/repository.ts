import { randomUUID } from "crypto"

import { createAppDocumentStore, type DocumentStore } from "@/lib/storage/document-store"

import type { MailOrderRecord } from "@/lib/click2mail/order-record"

import { normalizeCampaignStatus } from "./campaign-status"
import { getActiveRevision, getActiveSpec, getApprovedSpec, getNextVersion } from "./creative-state"
import {
  applyUploadedDesignApproval,
  clearUploadedDesignApproval,
} from "@/lib/bring-your-own-design/approval"
import { applyLeaveUploadPath, applyUploadPathStart, type UploadPathBasics } from "@/lib/bring-your-own-design/upload-path"
import { applyTemplateStart } from "@/lib/mail-templates/apply"
import { getMailTemplate } from "@/lib/mail-templates/query"
import {
  applyCreativeApproval,
  applyCreativeUnapproval,
  applyStrategyConfirmation,
} from "./mail-piece"
import { applyAiGenerationStart, applyAiStart } from "./start-path"
import { cloneSpec } from "./spec-diff"
import type {
  Campaign,
  CampaignBrief,
  CampaignCreative,
  ConversationMessage,
  CreativeDirection,
  CreativeRecommendation,
  CreativeRevision,
  CreativeSpec,
  DesignSource,
  UploadedDesign,
  UploadedDesignReview,
} from "./types"
import { createEmptyCampaignCreative } from "./types"

function requireCurrentMailPiece(campaign: Campaign): void {
  if (!campaign.mailPiece) {
    throw new Error(`Campaign ${campaign.id} is missing a current mail piece.`)
  }
}

/** Write precondition for confirmAudience. Does not create or repair a MailPiece. */
export function applyAudienceConfirmation(campaign: Campaign, now: string): void {
  requireCurrentMailPiece(campaign)
  campaign.status = "audience_confirmed"
  campaign.updatedAt = now
}

/** Write precondition for confirmQuantity. Does not create or repair a MailPiece. */
export function applyQuantityConfirmation(campaign: Campaign, now: string): void {
  requireCurrentMailPiece(campaign)
  campaign.status = "quantity_confirmed"
  campaign.updatedAt = now
}

/**
 * Records the customer's explicit Launch commitment.
 * Requires a current MailPiece and quantity_confirmed. Does not create or
 * repair a MailPiece, derive a ProductionDocument, or call fulfillment.
 */
export function applyLaunch(campaign: Campaign, now: string): void {
  requireCurrentMailPiece(campaign)
  if (campaign.status !== "quantity_confirmed") {
    throw new Error(
      `Campaign ${campaign.id} cannot be launched until quantity is confirmed.`
    )
  }
  campaign.status = "launched"
  campaign.updatedAt = now
}

/**
 * Status-only recovery when a current MailPiece is missing but Studio can
 * render persisted directions. Does not unapprove, generate, or mint a MailPiece.
 */
export function applyRecoverMissingMailPiece(campaign: Campaign, now: string): void {
  if (campaign.mailPiece) {
    throw new Error(`Campaign ${campaign.id} already has a current mail piece.`)
  }
  if (campaign.creative.directions.length === 0) {
    throw new Error(
      `Campaign ${campaign.id} does not have persisted creative to review.`
    )
  }

  campaign.status = "creative_ready"
  campaign.updatedAt = now
}

export interface CampaignRepository {
  createCampaign(ownerId: string): Promise<Campaign>
  getCampaign(id: string): Promise<Campaign | null>
  appendMessage(id: string, message: ConversationMessage): Promise<Campaign>
  updateBrief(id: string, patch: Partial<CampaignBrief>): Promise<Campaign>
  setReadyForBriefReview(id: string, ready: boolean): Promise<Campaign>
  confirmStrategy(id: string): Promise<Campaign>
  markGeneratingCreative(id: string): Promise<Campaign>
  confirmAudience(id: string): Promise<Campaign>
  confirmQuantity(id: string): Promise<Campaign>
  launch(id: string): Promise<Campaign>
  recoverMissingMailPiece(id: string): Promise<Campaign>
  initializeStudioCreative(
    id: string,
    directions: CreativeDirection[],
    recommendation: CreativeRecommendation
  ): Promise<Campaign>
  selectDirection(id: string, directionId: string): Promise<Campaign>
  appendRevision(
    id: string,
    revision: CreativeRevision,
    activeSpec: CreativeSpec,
    options?: { directionId?: string }
  ): Promise<Campaign>
  replaceDirectionSpec(id: string, directionId: string, spec: CreativeSpec, note: string): Promise<Campaign>
  approveCreative(id: string): Promise<Campaign>
  unapproveCreative(id: string): Promise<Campaign>
  setDesignSource(id: string, source: DesignSource): Promise<Campaign>
  beginUploadPath(id: string, basics: Partial<UploadPathBasics>): Promise<Campaign>
  beginTemplatePath(id: string, templateId: string): Promise<Campaign>
  leaveUploadPath(id: string): Promise<Campaign>
  saveUploadedDesign(id: string, design: UploadedDesign): Promise<Campaign>
  saveUploadedDesignReview(id: string, review: UploadedDesignReview): Promise<Campaign>
  approveUploadedDesign(id: string, printFileKey: string): Promise<Campaign>
  saveMailOrder(id: string, order: MailOrderRecord): Promise<Campaign>
}

function backfillDirectionRevisions(
  directions: CreativeDirection[],
  revisions: CreativeRevision[]
): CreativeRevision[] {
  const next = [...revisions]

  for (const direction of directions) {
    const hasOriginalRevision = next.some(
      (revision) =>
        revision.directionId === direction.id &&
        revision.version === 1 &&
        revision.type !== "conflict"
    )

    if (hasOriginalRevision) continue

    next.push({
      id: randomUUID(),
      directionId: direction.id,
      version: 1,
      spec: cloneSpec(direction.spec),
      customerPrompt: "Original concept",
      studioResponse: "",
      type: "refinement",
      createdAt: direction.createdAt,
    })
  }

  return next
}

function normalizeCreative(raw: CampaignCreative | undefined): CampaignCreative {
  const base = raw ?? createEmptyCampaignCreative()
  const directions = base.directions ?? []
  const normalizedRevisions = backfillDirectionRevisions(
    directions,
    (base.revisions ?? []).map((revision) => ({
      ...revision,
      version: revision.type === "conflict" ? null : (revision.version ?? 1),
      type: revision.type ?? "refinement",
    }))
  )

  const creative: CampaignCreative = {
    ...base,
    directions,
    revisions: normalizedRevisions,
  }

  if (creative.approvedRevisionId && !creative.approvedSpec) {
    const approvedSpec = getApprovedSpec(creative)
    if (approvedSpec) {
      creative.approvedSpec = cloneSpec(approvedSpec)
    }
  }

  if (
    creative.selectedDirectionId &&
    !creative.activeSpec
  ) {
    const activeSpec = getActiveSpec(creative, creative.selectedDirectionId)
    if (activeSpec) {
      creative.activeSpec = cloneSpec(activeSpec)
    }
  }

  if (
    creative.selectedDirectionId &&
    !creative.activeRevisionId
  ) {
    const activeRevision = getActiveRevision(creative, creative.selectedDirectionId)
    if (activeRevision) {
      creative.activeRevisionId = activeRevision.id
    }
  }

  return creative
}

/** Load-time campaign shaping only. Does not rewrite persisted CreativeSpec tokens. */
export function normalizeCampaign(raw: Campaign): Campaign {
  return {
    ...raw,
    status: normalizeCampaignStatus(raw.status),
    creative: normalizeCreative(raw.creative),
  }
}

/**
 * Campaign mutations over a DocumentStore.
 * Local JSON files when no database URL is set. Postgres otherwise.
 * Callers depend only on CampaignRepository.
 */
class StoredCampaignRepository implements CampaignRepository {
  constructor(private readonly store: DocumentStore) {}

  private async read(id: string): Promise<Campaign | null> {
    const raw = await this.store.get(id)
    if (!raw || typeof raw !== "object") return null
    return normalizeCampaign(raw as Campaign)
  }

  private async write(campaign: Campaign): Promise<Campaign> {
    await this.store.put(campaign.id, campaign)
    return campaign
  }

  private async require(id: string): Promise<Campaign> {
    const campaign = await this.read(id)
    if (!campaign) throw new Error(`Campaign ${id} not found`)
    return campaign
  }

  async createCampaign(ownerId: string): Promise<Campaign> {
    const now = new Date().toISOString()
    const campaign: Campaign = {
      id: randomUUID(),
      ownerId,
      status: "draft",
      brief: {},
      creative: createEmptyCampaignCreative(),
      transcript: [],
      readyForBriefReview: false,
      createdAt: now,
      updatedAt: now,
    }
    return this.write(campaign)
  }

  async getCampaign(id: string): Promise<Campaign | null> {
    return this.read(id)
  }

  async appendMessage(id: string, message: ConversationMessage): Promise<Campaign> {
    const campaign = await this.require(id)
    const now = new Date().toISOString()
    campaign.transcript = [...campaign.transcript, message]
    applyAiStart(campaign, now)
    campaign.updatedAt = now
    return this.write(campaign)
  }

  async updateBrief(id: string, patch: Partial<CampaignBrief>): Promise<Campaign> {
    const campaign = await this.require(id)
    campaign.brief = { ...campaign.brief, ...patch }
    campaign.updatedAt = new Date().toISOString()
    return this.write(campaign)
  }

  async setReadyForBriefReview(id: string, ready: boolean): Promise<Campaign> {
    const campaign = await this.require(id)
    campaign.readyForBriefReview = ready
    campaign.updatedAt = new Date().toISOString()
    return this.write(campaign)
  }

  async confirmStrategy(id: string): Promise<Campaign> {
    const campaign = await this.require(id)
    applyStrategyConfirmation(campaign, new Date().toISOString())
    return this.write(campaign)
  }

  async markGeneratingCreative(id: string): Promise<Campaign> {
    const campaign = await this.require(id)
    if (!applyAiGenerationStart(campaign)) return campaign
    campaign.updatedAt = new Date().toISOString()
    return this.write(campaign)
  }

  async confirmAudience(id: string): Promise<Campaign> {
    const campaign = await this.require(id)
    applyAudienceConfirmation(campaign, new Date().toISOString())
    return this.write(campaign)
  }

  async confirmQuantity(id: string): Promise<Campaign> {
    const campaign = await this.require(id)
    applyQuantityConfirmation(campaign, new Date().toISOString())
    return this.write(campaign)
  }

  async launch(id: string): Promise<Campaign> {
    const campaign = await this.require(id)
    applyLaunch(campaign, new Date().toISOString())
    return this.write(campaign)
  }

  async recoverMissingMailPiece(id: string): Promise<Campaign> {
    const campaign = await this.require(id)
    applyRecoverMissingMailPiece(campaign, new Date().toISOString())
    return this.write(campaign)
  }

  async initializeStudioCreative(
    id: string,
    directions: CreativeDirection[],
    recommendation: CreativeRecommendation
  ): Promise<Campaign> {
    const campaign = await this.require(id)
    const now = new Date().toISOString()
    const lead = directions.find((d) => d.recommended) ?? directions[0]

    const revisions: CreativeRevision[] = directions.map((direction) => ({
      id: randomUUID(),
      directionId: direction.id,
      version: 1,
      spec: cloneSpec(direction.spec),
      customerPrompt: "Original concept",
      studioResponse: "",
      type: "refinement",
      createdAt: now,
    }))

    const leadRevision = revisions.find((r) => r.directionId === lead.id)

    campaign.creative = {
      directions,
      recommendation,
      recommendedDirectionId: lead.id,
      selectedDirectionId: lead.id,
      revisions,
      activeSpec: cloneSpec(lead.spec),
      activeRevisionId: leadRevision?.id,
    }
    campaign.status = "creative_ready"
    campaign.updatedAt = now
    return this.write(campaign)
  }

  async selectDirection(id: string, directionId: string): Promise<Campaign> {
    const campaign = await this.require(id)
    const spec = getActiveSpec(campaign.creative, directionId)
    if (!spec) throw new Error(`Direction ${directionId} not found`)

    const activeRevision = getActiveRevision(campaign.creative, directionId)
    campaign.creative.selectedDirectionId = directionId
    campaign.creative.activeSpec = cloneSpec(spec)
    campaign.creative.activeRevisionId = activeRevision?.id
    campaign.updatedAt = new Date().toISOString()
    return this.write(campaign)
  }

  async appendRevision(
    id: string,
    revision: CreativeRevision,
    activeSpec: CreativeSpec,
    options?: { directionId?: string }
  ): Promise<Campaign> {
    const campaign = await this.require(id)
    const directionId = options?.directionId ?? revision.directionId

    campaign.creative.revisions = [...campaign.creative.revisions, revision]
    campaign.creative.selectedDirectionId = directionId
    campaign.creative.activeSpec = cloneSpec(activeSpec)
    campaign.creative.activeRevisionId =
      revision.version !== null ? revision.id : campaign.creative.activeRevisionId
    campaign.updatedAt = new Date().toISOString()
    return this.write(campaign)
  }

  async replaceDirectionSpec(id: string, directionId: string, spec: CreativeSpec, note: string): Promise<Campaign> {
    const campaign = await this.require(id)
    const direction = campaign.creative.directions.find((item) => item.id === directionId)
    if (!direction) throw new Error(`Direction ${directionId} not found`)
    const next = cloneSpec(spec)
    direction.spec = next
    const now = new Date().toISOString()
    const revision: CreativeRevision = {
      id: randomUUID(),
      directionId,
      version: getNextVersion(campaign.creative, directionId),
      spec: next,
      customerPrompt: "Use a blueprint",
      studioResponse: note,
      type: "refinement",
      createdAt: now,
    }
    campaign.creative.revisions = [...campaign.creative.revisions, revision]
    campaign.creative.selectedDirectionId = directionId
    campaign.creative.activeSpec = cloneSpec(next)
    campaign.creative.activeRevisionId = revision.id
    campaign.updatedAt = now
    return this.write(campaign)
  }

  async approveCreative(id: string): Promise<Campaign> {
    const campaign = await this.require(id)
    applyCreativeApproval(campaign, new Date().toISOString())
    return this.write(campaign)
  }

  async unapproveCreative(id: string): Promise<Campaign> {
    const campaign = await this.require(id)
    applyCreativeUnapproval(campaign, new Date().toISOString())
    clearUploadedDesignApproval(campaign)
    return this.write(campaign)
  }

  async beginUploadPath(id: string, basics: Partial<UploadPathBasics>): Promise<Campaign> {
    const campaign = await this.require(id)
    applyUploadPathStart(campaign, basics, new Date().toISOString())
    return this.write(campaign)
  }

  async beginTemplatePath(id: string, templateId: string): Promise<Campaign> {
    const template = getMailTemplate(templateId)
    if (!template) throw new Error("That template is no longer available.")
    const campaign = await this.require(id)
    applyTemplateStart(campaign, template, new Date().toISOString())
    return this.write(campaign)
  }

  async leaveUploadPath(id: string): Promise<Campaign> {
    const campaign = await this.require(id)
    applyLeaveUploadPath(campaign, new Date().toISOString())
    return this.write(campaign)
  }

  async setDesignSource(id: string, source: DesignSource): Promise<Campaign> {
    const campaign = await this.require(id)
    if (!campaign.mailPieceSpec) {
      throw new Error("Confirm the strategy before choosing a design.")
    }
    if (campaign.mailPiece || campaign.status === "creative_approved") {
      throw new Error("Unapprove the postcard before changing how it is designed.")
    }
    campaign.designSource = source
    campaign.updatedAt = new Date().toISOString()
    return this.write(campaign)
  }

  async saveUploadedDesign(id: string, design: UploadedDesign): Promise<Campaign> {
    const campaign = await this.require(id)
    if (campaign.designSource !== "upload") {
      throw new Error("Choose upload before adding a design.")
    }
    if (campaign.mailPiece || campaign.status === "creative_approved") {
      throw new Error("Unapprove the postcard before replacing the design.")
    }
    campaign.uploadedDesign = design
    campaign.updatedAt = new Date().toISOString()
    return this.write(campaign)
  }

  async saveUploadedDesignReview(id: string, review: UploadedDesignReview): Promise<Campaign> {
    const campaign = await this.require(id)
    const design = campaign.uploadedDesign
    if (campaign.designSource !== "upload" || !design?.front || !design.back) {
      throw new Error("Upload the front and the back before asking for a review.")
    }
    campaign.uploadedDesign = { ...design, review }
    campaign.updatedAt = new Date().toISOString()
    return this.write(campaign)
  }

  async approveUploadedDesign(id: string, printFileKey: string): Promise<Campaign> {
    const campaign = await this.require(id)
    applyUploadedDesignApproval(campaign, new Date().toISOString(), printFileKey)
    return this.write(campaign)
  }

  async saveMailOrder(id: string, order: MailOrderRecord): Promise<Campaign> {
    const campaign = await this.require(id)
    if (campaign.mailOrder && campaign.mailOrder.id !== order.id) {
      const history = campaign.mailOrderHistory ?? []
      campaign.mailOrderHistory = [...history, campaign.mailOrder].slice(-20)
    }
    campaign.mailOrder = order
    campaign.updatedAt = order.updatedAt
    return this.write(campaign)
  }
}

let repository: CampaignRepository | null = null

export function createCampaignRepository(store: DocumentStore): CampaignRepository {
  return new StoredCampaignRepository(store)
}

export function getCampaignRepository(): CampaignRepository {
  if (!repository) {
    repository = createCampaignRepository(createAppDocumentStore("campaigns"))
  }
  return repository
}
