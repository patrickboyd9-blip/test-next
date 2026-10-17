import { createHash } from "node:crypto"

import type { DocumentStore } from "@/lib/storage/document-store"
import { createAppDocumentStore, createFileDocumentStore } from "@/lib/storage/document-store"

import type { TasteSignals } from "./taste-retrieval"

/**
 * Thumbs on a concept, stored per campaign and per user.
 * The user id is the campaign owner. There is no separate account yet.
 */

export interface ConceptVote {
  campaignId: string
  directionId: string
  ownerId: string
  vote: "up" | "down"
  reason: string
  compositionFamily: string
  updatedAt: string
}

interface CampaignFeedbackDoc {
  campaignId: string
  ownerId: string
  votes: ConceptVote[]
}

interface UserFeedbackDoc {
  ownerId: string
  votes: ConceptVote[]
}

export function conceptFeedbackStore(options?: { dataDir?: string; store?: DocumentStore }): DocumentStore {
  if (options?.store) return options.store
  if (options?.dataDir) return createFileDocumentStore(options.dataDir)
  return createAppDocumentStore("concept_feedback")
}

export function feedbackUserKey(ownerId: string): string {
  const digest = createHash("sha256").update(ownerId).digest("hex").slice(0, 32)
  return `u-${digest}`
}

export function feedbackCampaignKey(campaignId: string): string {
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(campaignId)) {
    throw new Error("Campaign id cannot be stored.")
  }
  return `c-${campaignId}`
}

export async function saveConceptVote(input: {
  store?: DocumentStore
  campaignId: string
  directionId: string
  ownerId: string
  vote: "up" | "down"
  reason?: string
  compositionFamily?: string
  now?: string
}): Promise<ConceptVote> {
  if (!input.directionId.trim() || input.directionId.length > 80) {
    throw new Error("Direction id is missing.")
  }
  const store = input.store ?? conceptFeedbackStore()
  const vote: ConceptVote = {
    campaignId: input.campaignId,
    directionId: input.directionId,
    ownerId: input.ownerId,
    vote: input.vote,
    reason: (input.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
    compositionFamily: (input.compositionFamily ?? "").slice(0, 80),
    updatedAt: input.now ?? new Date().toISOString(),
  }
  const campaignKey = feedbackCampaignKey(input.campaignId)
  const campaignDoc = await readCampaignDoc(store, campaignKey, input.campaignId, input.ownerId)
  campaignDoc.votes = upsert(campaignDoc.votes, vote)
  await store.put(campaignKey, campaignDoc)

  const userKey = feedbackUserKey(input.ownerId)
  const userDoc = await readUserDoc(store, userKey, input.ownerId)
  userDoc.votes = upsert(userDoc.votes, vote)
  await store.put(userKey, userDoc)
  return vote
}

export async function listCampaignVotes(campaignId: string, store?: DocumentStore): Promise<ConceptVote[]> {
  const docs = store ?? conceptFeedbackStore()
  const raw = await docs.get(feedbackCampaignKey(campaignId))
  const parsed = parseCampaignDoc(raw)
  return parsed?.votes ?? []
}

export async function tasteSignalsForOwner(ownerId: string, store?: DocumentStore): Promise<TasteSignals> {
  if (!ownerId.trim()) return emptySignals()
  const docs = store ?? conceptFeedbackStore()
  const raw = await docs.get(feedbackUserKey(ownerId))
  const parsed = parseUserDoc(raw)
  return signalsFromVotes(parsed?.votes ?? [])
}

export function signalsFromVotes(votes: readonly ConceptVote[]): TasteSignals {
  const liked = votes.filter((vote) => vote.vote === "up")
  const disliked = votes.filter((vote) => vote.vote === "down")
  return {
    likedFamilies: unique(liked.map((vote) => vote.compositionFamily).filter(Boolean)),
    dislikedFamilies: unique(disliked.map((vote) => vote.compositionFamily).filter(Boolean)),
    likedNotes: liked.map((vote) => vote.reason).filter(Boolean).slice(-4),
    dislikedNotes: disliked.map((vote) => vote.reason).filter(Boolean).slice(-4),
  }
}

function upsert(votes: ConceptVote[], next: ConceptVote): ConceptVote[] {
  const rest = votes.filter((vote) => !(vote.campaignId === next.campaignId && vote.directionId === next.directionId))
  return [...rest, next]
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function emptySignals(): TasteSignals {
  return { likedFamilies: [], dislikedFamilies: [], likedNotes: [], dislikedNotes: [] }
}

async function readCampaignDoc(store: DocumentStore, key: string, campaignId: string, ownerId: string): Promise<CampaignFeedbackDoc> {
  return parseCampaignDoc(await store.get(key)) ?? { campaignId, ownerId, votes: [] }
}

async function readUserDoc(store: DocumentStore, key: string, ownerId: string): Promise<UserFeedbackDoc> {
  return parseUserDoc(await store.get(key)) ?? { ownerId, votes: [] }
}

function parseCampaignDoc(raw: unknown): CampaignFeedbackDoc | null {
  if (!raw || typeof raw !== "object") return null
  const doc = raw as Partial<CampaignFeedbackDoc>
  if (typeof doc.campaignId !== "string" || !Array.isArray(doc.votes)) return null
  return { campaignId: doc.campaignId, ownerId: typeof doc.ownerId === "string" ? doc.ownerId : "", votes: doc.votes.filter(isVote) }
}

function parseUserDoc(raw: unknown): UserFeedbackDoc | null {
  if (!raw || typeof raw !== "object") return null
  const doc = raw as Partial<UserFeedbackDoc>
  if (!Array.isArray(doc.votes)) return null
  return { ownerId: typeof doc.ownerId === "string" ? doc.ownerId : "", votes: doc.votes.filter(isVote) }
}

function isVote(value: unknown): value is ConceptVote {
  if (!value || typeof value !== "object") return false
  const vote = value as ConceptVote
  return (vote.vote === "up" || vote.vote === "down") && typeof vote.directionId === "string" && typeof vote.campaignId === "string"
}
