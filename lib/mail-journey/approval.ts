import { createHash } from "node:crypto"

import type { CustomerQuote } from "./pricing"
import type { FrozenProof } from "./proof"

/** Written once. A later edit does not change this record; it makes it stale. */
export interface MailApproval {
  id: string
  campaignId: string
  ownerId: string
  proofHash: string
  frontKey: string
  backKey: string
  listHash: string
  listCount: number
  quote: CustomerQuote
  acceptedAt: string
}

export function approvalIdFor(input: {
  campaignId: string
  ownerId: string
  proofHash: string
  listHash: string
  quote: CustomerQuote
  acceptedAt: string
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        campaignId: input.campaignId,
        ownerId: input.ownerId,
        proofHash: input.proofHash,
        listHash: input.listHash,
        totalCents: input.quote.totalCents,
        currency: input.quote.currency,
        termsVersion: input.quote.termsVersion,
        expiresAt: input.quote.expiresAt,
        acceptedAt: input.acceptedAt,
      })
    )
    .digest("hex")
    .slice(0, 32)
}

export function createApproval(input: {
  campaignId: string
  ownerId: string
  proof: FrozenProof
  listHash: string
  listCount: number
  quote: CustomerQuote
  acceptedAt: string
}): MailApproval {
  const draft = {
    campaignId: input.campaignId,
    ownerId: input.ownerId,
    proofHash: input.proof.proofHash,
    listHash: input.listHash,
    quote: input.quote,
    acceptedAt: input.acceptedAt,
  }
  return {
    id: approvalIdFor(draft),
    ...draft,
    frontKey: input.proof.front.key,
    backKey: input.proof.back.key,
    listCount: input.listCount,
  }
}

export function approvalCovers(
  approval: MailApproval,
  current: {
    proofHash: string
    listHash: string
    listCount: number
    quote: CustomerQuote
    nowIso: string
  }
): { ok: true } | { ok: false; message: string } {
  if (Date.parse(approval.quote.expiresAt) <= Date.parse(current.nowIso)) {
    return {
      ok: false,
      message: "The approved total expired. Review the proof, the list, and the price again.",
    }
  }
  if (approval.proofHash !== current.proofHash) {
    return {
      ok: false,
      message: "The proof changed after it was approved. Review the front and the back again.",
    }
  }
  if (approval.listHash !== current.listHash || approval.listCount !== current.listCount) {
    return {
      ok: false,
      message: "The address list changed after it was approved. Review the accepted rows again.",
    }
  }
  const sameQuote =
    approval.quote.scheduleId === current.quote.scheduleId &&
    approval.quote.totalCents === current.quote.totalCents &&
    approval.quote.currency === current.quote.currency &&
    approval.quote.termsVersion === current.quote.termsVersion &&
    approval.quote.expiresAt === current.quote.expiresAt
  if (!sameQuote) {
    return {
      ok: false,
      message: "The price or the terms changed. Approve the new total before checkout.",
    }
  }
  return { ok: true }
}
