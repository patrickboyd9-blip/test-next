"use server"

import { randomUUID } from "crypto"

import { mockCurrentUser } from "@/lib/auth/mock-user"

import {
  getActiveSpec,
  getNextVersion,
} from "./creative-state"
import {
  ConversationEngineNotConfiguredError,
  getConversationEngine,
} from "./conversation-engine"
import { getCreativeEngine } from "./creative-engine-provider"
import { getCampaignRepository } from "./repository"
import { buildSpecDiff, cloneSpec } from "./spec-diff"
import type { Campaign, CampaignBrief, CreativeRevision } from "./types"

const repository = getCampaignRepository()

export async function createDraftCampaign(): Promise<Campaign> {
  return repository.createCampaign(mockCurrentUser.email)
}

export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  return repository.getCampaign(campaignId)
}

export async function sendCampaignMessage(
  campaignId: string,
  message: string
): Promise<Campaign> {
  const trimmed = message.trim()
  if (!trimmed) throw new Error("Message cannot be empty")

  await repository.appendMessage(campaignId, {
    id: randomUUID(),
    role: "customer",
    content: trimmed,
    createdAt: new Date().toISOString(),
  })

  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)

  try {
    const engine = getConversationEngine()
    const result = await engine.nextTurn({
      brief: campaign.brief,
      transcript: campaign.transcript,
      message: trimmed,
    })

    await repository.updateBrief(campaignId, result.brief)
    await repository.setReadyForBriefReview(campaignId, result.readyForBriefReview)

    return repository.appendMessage(campaignId, {
      id: randomUUID(),
      role: "assistant",
      content: result.reply,
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof ConversationEngineNotConfiguredError) {
      return repository.appendMessage(campaignId, {
        id: randomUUID(),
        role: "system",
        content:
          "Modern Mail's conversation engine isn't connected yet, so I can't respond " +
          "intelligently to what you've written. You can fill in the campaign brief " +
          "manually below in the meantime.",
        createdAt: new Date().toISOString(),
      })
    }

    console.error("Campaign Creator conversation engine failed:", error)
    return repository.appendMessage(campaignId, {
      id: randomUUID(),
      role: "system",
      content:
        "Something went wrong reaching Modern Mail's conversation engine. Please try " +
        "sending that again, or fill in the campaign brief manually below in the meantime.",
      createdAt: new Date().toISOString(),
    })
  }
}

export async function updateCampaignBrief(
  campaignId: string,
  patch: Partial<CampaignBrief>
): Promise<Campaign> {
  return repository.updateBrief(campaignId, patch)
}

export async function confirmCampaignStrategy(campaignId: string): Promise<Campaign> {
  return repository.confirmStrategy(campaignId)
}

/** @deprecated Prefer confirmCampaignStrategy — name retained for in-flight UI migration. */
export async function confirmCampaignBrief(campaignId: string): Promise<Campaign> {
  return confirmCampaignStrategy(campaignId)
}

export async function confirmCampaignAudience(campaignId: string): Promise<Campaign> {
  return repository.confirmAudience(campaignId)
}

export async function confirmCampaignQuantity(campaignId: string): Promise<Campaign> {
  return repository.confirmQuantity(campaignId)
}

export async function initializeStudioCreative(campaignId: string): Promise<Campaign> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)

  const result = await getCreativeEngine().generateDirections({
    brief: campaign.brief,
  })
  return repository.initializeStudioCreative(
    campaignId,
    result.directions,
    result.recommendation
  )
}

export async function selectCreativeDirection(
  campaignId: string,
  directionId: string
): Promise<Campaign> {
  return repository.selectDirection(campaignId, directionId)
}

export async function applyRefinement(
  campaignId: string,
  prompt: string
): Promise<Campaign> {
  const trimmed = prompt.trim()
  if (!trimmed) throw new Error("Prompt cannot be empty")

  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)

  const directionId = campaign.creative.selectedDirectionId
  if (!directionId) throw new Error("No direction selected")

  const direction = campaign.creative.directions.find((item) => item.id === directionId)
  if (!direction) throw new Error("Selected direction not found")

  const currentSpec =
    campaign.creative.activeSpec ?? getActiveSpec(campaign.creative, directionId)
  if (!currentSpec) throw new Error("No active spec")

  const result = await getCreativeEngine().refineDirection({
    brief: campaign.brief,
    direction: { ...direction, spec: currentSpec },
    revisions: campaign.creative.revisions,
    prompt: trimmed,
  })

  const now = new Date().toISOString()
  const revision: CreativeRevision = {
    ...result.revision,
    id: randomUUID(),
    createdAt: now,
    version:
      result.revision.type === "conflict"
        ? null
        : getNextVersion(campaign.creative, directionId),
  }
  return repository.appendRevision(campaignId, revision, result.spec)
}

export async function restoreRevision(
  campaignId: string,
  revisionId: string
): Promise<Campaign> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)

  const source = campaign.creative.revisions.find((r) => r.id === revisionId)
  if (!source) throw new Error(`Revision ${revisionId} not found`)
  if (source.version === null) throw new Error("Cannot restore a conflict entry")

  const directionId = source.directionId
  const currentSpec =
    campaign.creative.activeSpec ?? getActiveSpec(campaign.creative, directionId)
  if (!currentSpec) throw new Error("No active spec")

  const restoredSpec = cloneSpec(source.spec)
  const version = getNextVersion(campaign.creative, directionId)
  const now = new Date().toISOString()

  const revision: CreativeRevision = {
    id: randomUUID(),
    directionId,
    version,
    spec: restoredSpec,
    customerPrompt: `Restored v${source.version}`,
    studioResponse: `Restored v${source.version} — your design from earlier.`,
    type: "restore",
    specDiff: buildSpecDiff(currentSpec, restoredSpec),
    createdAt: now,
  }

  return repository.appendRevision(campaignId, revision, restoredSpec, { directionId })
}

export async function approveCreative(campaignId: string): Promise<Campaign> {
  return repository.approveCreative(campaignId)
}

export async function unapproveCreative(campaignId: string): Promise<Campaign> {
  return repository.unapproveCreative(campaignId)
}
