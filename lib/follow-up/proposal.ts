import { createHash } from "node:crypto"

import type { JobCreative } from "@/lib/campaign-creator/types"
import { readApprovedSchedule, PRICE_UNCONFIGURED_MESSAGE, type QuoteResult } from "@/lib/mail-journey/pricing"

import { audienceHash, type FollowUpEvent } from "./import"
import { policyGaps, SUGGESTED_PLAY, type FollowUpPolicy } from "./policy"
import { selectEvents, type Selection } from "./select"

export interface FrozenRefs {
  play: typeof SUGGESTED_PLAY
  audienceHash: string
  includedCount: number
  creativeVersion: string
  offer: string
  quoteStatus: "configured" | "unconfigured"
}

export interface FollowUpProposal {
  id: string
  ownerId: string
  campaignId: string
  status: "draft" | "approved"
  policy: FollowUpPolicy
  frozen: FrozenRefs
  includedIds: string[]
  rows: Selection["rows"]
  createdAt: string
  approvedAt: string | null
}

export interface Handoff {
  sent: false
  charged: false
  externalCalls: 0
  ready: boolean
  blockers: string[]
}

export function creativeVersion(input: { offer: string; job: JobCreative | null; guidanceVersion: string | null }): string {
  const photo = input.job?.photos.find((item) => item.id === input.job?.frontPhotoId)
  return createHash("sha256")
    .update(
      JSON.stringify({
        offer: input.offer,
        guidanceVersion: input.guidanceVersion,
        frontPhotoId: input.job?.frontPhotoId ?? null,
        back: input.job?.back ?? null,
        keep: photo?.keep ?? null,
        rights: input.job?.rightsConfirmedAt ?? null,
      })
    )
    .digest("hex")
    .slice(0, 16)
}

export function buildProposal(input: {
  ownerId: string
  campaignId: string
  policy: FollowUpPolicy
  events: readonly FollowUpEvent[]
  offer: string
  trade: string
  job: JobCreative | null
  guidanceVersion: string | null
  nowIso: string
  quote?: QuoteResult
}): { proposal: FollowUpProposal; selection: Selection } {
  const selection = selectEvents(input.events, input.policy, input.nowIso)
  const quote = input.quote ?? { ok: false as const, code: "unconfigured" as const, message: PRICE_UNCONFIGURED_MESSAGE }
  const frozen: FrozenRefs = {
    play: SUGGESTED_PLAY,
    audienceHash: audienceHash(selection.included),
    includedCount: selection.included.length,
    creativeVersion: creativeVersion({ offer: input.offer, job: input.job, guidanceVersion: input.guidanceVersion }),
    offer: input.offer,
    quoteStatus: quote.ok ? "configured" : "unconfigured",
  }
  const id = createHash("sha256")
    .update([input.ownerId, input.campaignId, frozen.play, frozen.audienceHash, frozen.creativeVersion, JSON.stringify(input.policy)].join("\n"))
    .digest("hex")
    .slice(0, 32)
  return {
    selection,
    proposal: {
      id,
      ownerId: input.ownerId,
      campaignId: input.campaignId,
      status: "draft",
      policy: input.policy,
      frozen,
      includedIds: selection.included.map((event) => event.externalId),
      rows: selection.rows,
      createdAt: input.nowIso,
      approvedAt: null,
    },
  }
}

export function handoffBlockers(input: {
  proposal: FollowUpProposal
  trade: string
  offer: string
  job: JobCreative | null
  guidanceVersion: string | null
  scheduleConfigured: boolean
}): Handoff {
  const blockers = [...policyGaps(input.proposal.policy)]
  if (input.proposal.frozen.includedCount === 0) blockers.push("No rows are included, so there is nothing to review for mailing.")
  if (!input.trade || input.trade.toLowerCase() === "unknown") {
    blockers.push("Trade is unknown. No home-service creative was substituted.")
  }
  if (!input.job?.rightsConfirmedAt) blockers.push("Job-photo permission is not confirmed.")
  if (!input.job?.frontPhotoId) blockers.push("Choose one of your own job photos before this can move to order review.")
  const current = creativeVersion({ offer: input.offer, job: input.job, guidanceVersion: input.guidanceVersion })
  if (current !== input.proposal.frozen.creativeVersion || input.offer !== input.proposal.frozen.offer) {
    blockers.push("The offer, photo, or guidance changed after this proposal. Approve it again.")
  }
  if (!input.scheduleConfigured || input.proposal.frozen.quoteStatus === "unconfigured") {
    blockers.push(PRICE_UNCONFIGURED_MESSAGE)
  }
  return { sent: false, charged: false, externalCalls: 0, ready: blockers.length === 0, blockers }
}

export function scheduleConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return readApprovedSchedule(env) != null
}
