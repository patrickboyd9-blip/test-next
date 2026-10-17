"use server"

import { randomUUID } from "crypto"
import { after } from "next/server"

import { mockCurrentUser } from "@/lib/auth/mock-user"

import {
  getActiveSpec,
  getNextVersion,
} from "./creative-state"
import {
  ConversationEngineNotConfiguredError,
  getConversationEngine,
} from "./conversation-engine"
import { toCreativeCanvas } from "./creative-canvas"
import { getCreativeEngine } from "./creative-engine-provider"
import { generateLeadDirectionImage as runGenerateLeadDirectionImage } from "./generate-lead-direction-image"
import type { GeneratedAsset } from "./image-generation"
import { createOpenAIImageGenerationAdapter } from "./openai-image-generation"
import type { StudioImageLoad } from "./studio-image-cache"
import { scheduleAfterResponse, syncStudioDirectionImages } from "./studio-image-jobs"
import {
  briefPatchFromPersonalization,
  personalizationFromPrompt,
} from "./prompt-personalization"
import { campaignForCustomer } from "./customer-campaign"
import { getCampaignRepository } from "./repository"
import { buildSpecDiff, cloneSpec } from "./spec-diff"
import type { Campaign, CampaignBrief, CreativeRevision, MailPieceSpec } from "./types"
import type {
  MailPieceCatalogId,
  MailPieceCatalogVersion,
} from "@/lib/mail-catalog/types"
import { getMailPiece } from "@/lib/mail-catalog/catalog"
import { generateCampaignStrategy } from "@/lib/campaign-strategy/strategy-generator"
import { listCampaignVotes, saveConceptVote } from "@/lib/design-intelligence/concept-feedback"

const repository = getCampaignRepository()

/** Drop the private research score before a campaign reaches the browser. */
function forCustomer(campaign: Campaign): Campaign {
  return campaignForCustomer(campaign)
}

function requireCreativeCanvas(
  mailPieceSpec: MailPieceSpec | undefined,
  campaignId: string
) {
  if (!mailPieceSpec) {
    throw new Error(
      `Campaign ${campaignId} is missing a mail piece spec. Confirm strategy before generating or refining creative.`
    )
  }

  return toCreativeCanvas(
    getMailPiece(
      mailPieceSpec.selectedCatalogId,
      mailPieceSpec.selectedCatalogVersion
    )
  )
}

export async function createDraftCampaign(): Promise<Campaign> {
  return forCustomer(await repository.createCampaign(mockCurrentUser.email))
}

/** Opens a catalog mailer in Studio on this draft. */
export async function beginFromTemplate(
  campaignId: string,
  templateId: string
): Promise<Campaign> {
  return forCustomer(await repository.beginTemplatePath(campaignId, templateId))
}

export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  const campaign = await repository.getCampaign(campaignId)
  return campaign ? forCustomer(campaign) : null
}

export interface MailPieceFormatRecommendationView {
  catalogId: MailPieceCatalogId
  catalogVersion: MailPieceCatalogVersion
  displayName: string
  rationale: string
}

/** Read-only. Does not persist Strategy or change Campaign. */
export async function getMailPieceFormatRecommendation(
  brief: CampaignBrief
): Promise<MailPieceFormatRecommendationView> {
  const { formatRecommendation } = generateCampaignStrategy(brief)
  const catalogPiece = getMailPiece(
    formatRecommendation.catalogId,
    formatRecommendation.catalogVersion
  )

  return {
    catalogId: catalogPiece.id,
    catalogVersion: catalogPiece.version,
    displayName: catalogPiece.displayName,
    rationale: formatRecommendation.rationale,
  }
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
    const engine = await getConversationEngine()
    const result = await engine.nextTurn({
      brief: campaign.brief,
      transcript: campaign.transcript,
      message: trimmed,
    })

    await repository.updateBrief(campaignId, result.brief)
    await repository.setReadyForBriefReview(campaignId, result.readyForBriefReview)

    return forCustomer(await repository.appendMessage(campaignId, {
      id: randomUUID(),
      role: "assistant",
      content: result.reply,
      createdAt: new Date().toISOString(),
    }))
  } catch (error) {
    if (error instanceof ConversationEngineNotConfiguredError) {
      return forCustomer(await repository.appendMessage(campaignId, {
        id: randomUUID(),
        role: "system",
        content:
          "Modern Mail's conversation engine isn't connected yet, so I can't respond " +
          "intelligently to what you've written. You can fill in the campaign brief " +
          "manually below in the meantime.",
        createdAt: new Date().toISOString(),
      }))
    }

    console.error("Campaign Creator conversation engine failed:", error)
    return forCustomer(await repository.appendMessage(campaignId, {
      id: randomUUID(),
      role: "system",
      content:
        "Something went wrong reaching Modern Mail's conversation engine. Please try " +
        "sending that again, or fill in the campaign brief manually below in the meantime.",
      createdAt: new Date().toISOString(),
    }))
  }
}

export async function updateCampaignBrief(
  campaignId: string,
  patch: Partial<CampaignBrief>
): Promise<Campaign> {
  return forCustomer(await repository.updateBrief(campaignId, patch))
}

export async function confirmCampaignStrategy(campaignId: string): Promise<Campaign> {
  return forCustomer(await repository.confirmStrategy(campaignId))
}

/** @deprecated Prefer confirmCampaignStrategy — name retained for in-flight UI migration. */
export async function confirmCampaignBrief(campaignId: string): Promise<Campaign> {
  return confirmCampaignStrategy(campaignId)
}

export async function confirmCampaignAudience(campaignId: string): Promise<Campaign> {
  return forCustomer(await repository.confirmAudience(campaignId))
}

export async function confirmCampaignQuantity(campaignId: string): Promise<Campaign> {
  return forCustomer(await repository.confirmQuantity(campaignId))
}

export async function launchCampaign(campaignId: string): Promise<Campaign> {
  return forCustomer(await repository.launch(campaignId))
}

const generationLocks = new Map<string, Promise<Campaign>>()

export async function generateStudioCreative(campaignId: string): Promise<Campaign> {
  const inFlight = generationLocks.get(campaignId)
  if (inFlight) return forCustomer(await inFlight)

  const work = (async () => {
    const campaign = await repository.getCampaign(campaignId)
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`)
    if (campaign.creative.directions.length > 0) return campaign
    requireCreativeCanvas(campaign.mailPieceSpec, campaignId)

    await repository.markGeneratingCreative(campaignId)

    const latest = await repository.getCampaign(campaignId)
    if (!latest) throw new Error(`Campaign ${campaignId} not found`)

    const canvas = requireCreativeCanvas(latest.mailPieceSpec, campaignId)
    const engine = await getCreativeEngine()
    const result = await engine.generateDirections({
      brief: latest.brief,
      canvas,
      ownerId: latest.ownerId,
    })
    return repository.initializeStudioCreative(
      campaignId,
      result.directions,
      result.recommendation
    )
  })()

  generationLocks.set(campaignId, work)
  try {
    return forCustomer(await work)
  } finally {
    generationLocks.delete(campaignId)
  }
}

/** @deprecated Prefer generateStudioCreative — kept for in-flight callers. */
export async function initializeStudioCreative(campaignId: string): Promise<Campaign> {
  return generateStudioCreative(campaignId)
}

/**
 * Ephemeral lead-image execution. Does not persist GeneratedAsset.
 * Does not change campaign creative-generation state.
 */
/**
 * Cached photographs for every direction that has an image brief.
 * Does not write GeneratedAsset onto Campaign or CreativeSpec.
 * Missing OpenAI configuration returns an empty list so Studio keeps the curated shelf.
 */
export async function loadStudioDirectionImages(
  campaignId: string
): Promise<StudioImageLoad> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)

  return syncStudioDirectionImages({
    campaignId,
    creative: campaign.creative,
    campaignBrief: campaign.brief,
    createAdapter: createOpenAIImageGenerationAdapter,
    schedule(work) {
      scheduleAfterResponse(after, work)
    },
  })
}

export async function generateLeadDirectionImage(
  campaignId: string,
  directionId: string
): Promise<{ directionId: string; generated: GeneratedAsset | null }> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)

  return runGenerateLeadDirectionImage(
    campaign,
    directionId,
    createOpenAIImageGenerationAdapter
  )
}

export async function selectCreativeDirection(
  campaignId: string,
  directionId: string
): Promise<Campaign> {
  return forCustomer(await repository.selectDirection(campaignId, directionId))
}

export async function applyRefinement(
  campaignId: string,
  prompt: string
): Promise<Campaign> {
  const trimmed = prompt.trim()
  if (!trimmed) throw new Error("Prompt cannot be empty")
  const personalization = personalizationFromPrompt(trimmed)

  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)

  const directionId = campaign.creative.selectedDirectionId
  if (!directionId) throw new Error("No direction selected")

  const direction = campaign.creative.directions.find((item) => item.id === directionId)
  if (!direction) throw new Error("Selected direction not found")

  const currentSpec =
    campaign.creative.activeSpec ?? getActiveSpec(campaign.creative, directionId)
  if (!currentSpec) throw new Error("No active spec")

  const canvas = requireCreativeCanvas(campaign.mailPieceSpec, campaignId)
  const engine = await getCreativeEngine()
  const result = await engine.refineDirection({
    brief: campaign.brief,
    canvas,
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
  const saved = await repository.appendRevision(campaignId, revision, result.spec)
  if (revision.type === "conflict") return forCustomer(saved)

  const briefPatch = briefPatchFromPersonalization(campaign.brief, personalization)
  if (!briefPatch) return forCustomer(saved)
  return forCustomer(await repository.updateBrief(campaignId, briefPatch))
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

  return forCustomer(
    await repository.appendRevision(campaignId, revision, restoredSpec, { directionId })
  )
}

export async function approveCreative(campaignId: string): Promise<Campaign> {
  return forCustomer(await repository.approveCreative(campaignId))
}

export async function unapproveCreative(campaignId: string): Promise<Campaign> {
  return forCustomer(await repository.unapproveCreative(campaignId))
}

export async function recoverMissingMailPiece(
  campaignId: string
): Promise<Campaign> {
  return forCustomer(await repository.recoverMissingMailPiece(campaignId))
}

export interface ConceptFeedbackView {
  directionId: string
  vote: "up" | "down"
  reason: string
}

/** Thumbs for the concepts in one campaign. The owner is taken from the campaign, not from the browser. */
export async function loadConceptFeedback(campaignId: string): Promise<ConceptFeedbackView[]> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) return []
  const votes = await listCampaignVotes(campaignId)
  return votes
    .filter((vote) => vote.ownerId === campaign.ownerId)
    .map((vote) => ({ directionId: vote.directionId, vote: vote.vote, reason: vote.reason }))
}

export async function saveConceptFeedback(input: {
  campaignId: string
  directionId: string
  vote: "up" | "down"
  reason?: string
}): Promise<ConceptFeedbackView> {
  if (input.vote !== "up" && input.vote !== "down") {
    throw new Error("Vote must be up or down.")
  }
  const campaign = await repository.getCampaign(input.campaignId)
  if (!campaign) throw new Error(`Campaign ${input.campaignId} not found`)
  const direction = campaign.creative.directions.find((item) => item.id === input.directionId)
  if (!direction) throw new Error("That concept is not on this campaign.")
  const saved = await saveConceptVote({
    campaignId: campaign.id,
    directionId: direction.id,
    ownerId: campaign.ownerId,
    vote: input.vote,
    reason: input.reason,
    compositionFamily: direction.spec.designRationale?.grid.intentional_break ?? "",
  })
  return { directionId: saved.directionId, vote: saved.vote, reason: saved.reason }
}
