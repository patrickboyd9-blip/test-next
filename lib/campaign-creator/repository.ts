import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import { normalizeCampaignStatus } from "./campaign-status"
import { getActiveRevision, getActiveSpec } from "./creative-state"
import { cloneSpec } from "./spec-diff"
import type {
  Campaign,
  CampaignBrief,
  ConversationMessage,
  CreativeDirection,
  CreativeRecommendation,
  CreativeRevision,
  CreativeSpec,
} from "./types"
import { createEmptyCampaignCreative } from "./types"

export interface CampaignRepository {
  createCampaign(ownerId: string): Promise<Campaign>
  getCampaign(id: string): Promise<Campaign | null>
  appendMessage(id: string, message: ConversationMessage): Promise<Campaign>
  updateBrief(id: string, patch: Partial<CampaignBrief>): Promise<Campaign>
  setReadyForBriefReview(id: string, ready: boolean): Promise<Campaign>
  confirmStrategy(id: string): Promise<Campaign>
  confirmAudience(id: string): Promise<Campaign>
  confirmQuantity(id: string): Promise<Campaign>
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
  approveCreative(id: string): Promise<Campaign>
  unapproveCreative(id: string): Promise<Campaign>
}

const DATA_DIR = path.join(process.cwd(), ".data", "campaigns")

function normalizeCampaign(raw: Campaign): Campaign {
  const creative = raw.creative ?? createEmptyCampaignCreative()
  return {
    ...raw,
    status: normalizeCampaignStatus(raw.status),
    creative: {
      ...creative,
      revisions: (creative.revisions ?? []).map((revision) => ({
        ...revision,
        version:
          revision.type === "conflict" ? null : (revision.version ?? 1),
        type: revision.type ?? "refinement",
      })),
    },
  }
}

/**
 * File-backed store for the beta vertical slice. Durable across a dev-server
 * restart, but not the long-term store — swap this class for a real database
 * implementation later; callers only depend on the CampaignRepository
 * interface above, so nothing upstream needs to change.
 */
class FileCampaignRepository implements CampaignRepository {
  private async ensureDir() {
    await mkdir(DATA_DIR, { recursive: true })
  }

  private filePath(id: string) {
    return path.join(DATA_DIR, `${id}.json`)
  }

  private async read(id: string): Promise<Campaign | null> {
    try {
      const raw = await readFile(this.filePath(id), "utf-8")
      return normalizeCampaign(JSON.parse(raw) as Campaign)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
      throw error
    }
  }

  private async write(campaign: Campaign): Promise<Campaign> {
    await this.ensureDir()
    await writeFile(this.filePath(campaign.id), JSON.stringify(campaign, null, 2), "utf-8")
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
    campaign.transcript = [...campaign.transcript, message]
    campaign.updatedAt = new Date().toISOString()
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
    campaign.status = "strategy_confirmed"
    campaign.updatedAt = new Date().toISOString()
    return this.write(campaign)
  }

  async confirmAudience(id: string): Promise<Campaign> {
    const campaign = await this.require(id)
    campaign.status = "audience_confirmed"
    campaign.updatedAt = new Date().toISOString()
    return this.write(campaign)
  }

  async confirmQuantity(id: string): Promise<Campaign> {
    const campaign = await this.require(id)
    campaign.status = "quantity_confirmed"
    campaign.updatedAt = new Date().toISOString()
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

  async approveCreative(id: string): Promise<Campaign> {
    const campaign = await this.require(id)
    const directionId = campaign.creative.selectedDirectionId
    if (!directionId) throw new Error("No direction selected")

    const activeRevision = getActiveRevision(campaign.creative, directionId)
    if (!activeRevision) throw new Error("No active revision to approve")

    campaign.creative.approvedRevisionId = activeRevision.id
    campaign.status = "creative_approved"
    campaign.updatedAt = new Date().toISOString()
    return this.write(campaign)
  }

  async unapproveCreative(id: string): Promise<Campaign> {
    const campaign = await this.require(id)
    campaign.creative.approvedRevisionId = undefined
    campaign.status = "creative_ready"
    campaign.updatedAt = new Date().toISOString()
    return this.write(campaign)
  }
}

let repository: CampaignRepository | null = null

export function getCampaignRepository(): CampaignRepository {
  if (!repository) repository = new FileCampaignRepository()
  return repository
}
