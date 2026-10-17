import type { CampaignBrief } from "@/lib/campaign-creator/types"
import type { DocumentStore } from "@/lib/storage/document-store"
import { createAppDocumentStore, createFileDocumentStore } from "@/lib/storage/document-store"

import { familyFromRationale, type CompositionFamily } from "./composition-read"
import type { DesignRationale } from "./rationale"
import { feelForBrief, industryForBrief, offerTypeForBrief } from "./taste-retrieval"

/**
 * Thumbs on a concept, stored per user and campaign.
 * The art director reads them back as taste, not as a score on the card.
 */

export interface TasteSignal {
  userId: string
  campaignId: string
  directionId: string
  vote: "up" | "down"
  reason?: string
  industry?: string
  offerType?: string
  feel?: string
  family?: string
  principle?: string
  updatedAt: string
}

export interface ConceptVoteInput {
  userId: string
  campaignId: string
  directionId: string
  vote: "up" | "down" | "clear"
  reason?: string
  brief?: CampaignBrief
  rationale?: DesignRationale
  principle?: string
  now?: string
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,180}$/

export function feedbackStore(options?: { dataDir?: string; store?: DocumentStore }): DocumentStore {
  if (options?.store) return options.store
  if (options?.dataDir) return createFileDocumentStore(options.dataDir)
  return createAppDocumentStore("design_feedback")
}

export function voteDocumentId(userId: string, campaignId: string, directionId: string): string {
  const id = [userId, campaignId, directionId].map(sanitize).join("--")
  if (!SAFE_ID.test(id)) throw new Error("Vote id cannot be stored.")
  return id
}

export async function saveConceptVote(input: ConceptVoteInput, store?: DocumentStore): Promise<TasteSignal | null> {
  const documents = store ?? feedbackStore()
  const id = voteDocumentId(input.userId, input.campaignId, input.directionId)
  const index = indexIds(await documents.get("index"))
  if (input.vote === "clear") {
    await documents.put(id, { cleared: true })
    await documents.put("index", { ids: index.filter((item) => item !== id) })
    return null
  }
  const reason = input.reason?.replace(/\s+/g, " ").trim().slice(0, 160)
  const signal: TasteSignal = {
    userId: input.userId,
    campaignId: input.campaignId,
    directionId: input.directionId,
    vote: input.vote,
    reason: reason || undefined,
    industry: input.brief ? industryForBrief(input.brief) : undefined,
    offerType: input.brief ? offerTypeForBrief(input.brief) : undefined,
    feel: input.rationale ? feelForFamily(familyFromRationale(input.rationale)) : input.brief ? feelForBrief(input.brief) : undefined,
    family: input.rationale ? familyFromRationale(input.rationale) : undefined,
    principle: input.principle?.slice(0, 180),
    updatedAt: input.now ?? new Date().toISOString(),
  }
  await documents.put(id, signal)
  if (!index.includes(id)) index.push(id)
  const capped = index.slice(-80)
  await documents.put("index", { ids: capped })
  return signal
}

export async function loadTasteSignals(userId: string, store?: DocumentStore): Promise<TasteSignal[]> {
  const documents = store ?? feedbackStore()
  const signals: TasteSignal[] = []
  for (const id of indexIds(await documents.get("index"))) {
    const raw = await documents.get(id)
    if (!isSignal(raw) || raw.userId !== userId) continue
    signals.push(raw)
  }
  return signals
}

function isSignal(value: unknown): value is TasteSignal {
  if (!value || typeof value !== "object") return false
  const row = value as Partial<TasteSignal>
  return (row.vote === "up" || row.vote === "down") && typeof row.userId === "string" && typeof row.campaignId === "string"
}

function indexIds(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return []
  const ids = (raw as { ids?: unknown }).ids
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []
}

function feelForFamily(family: CompositionFamily): string {
  if (family === "cutout-right" || family === "cutout-left" || family === "stacked-open" || family === "offer-float") return "integrated"
  return "panel"
}

function sanitize(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, "_").replace(/_+/g, "_").slice(0, 48)
  return cleaned || "x"
}
