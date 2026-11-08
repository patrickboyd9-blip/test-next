"use server"

import { redirect } from "next/navigation"

import { CampaignAccessError, requireOwnedCampaign } from "@/lib/auth/campaign-access"
import { getSession } from "@/lib/auth/session"

import { approvalCovers, createApproval } from "./approval"
import { getJourneyStore, jobFromApproval } from "./job"
import { reviewCustomerList, listIdentity } from "./list-import"
import { buildQuote, readApprovedSchedule } from "./pricing"
import { freezeProof } from "./proof"

export async function reviewListAction(formData: FormData): Promise<void> {
  const session = await getSession()
  if (!session) throw new CampaignAccessError(401, "Sign in required.")
  const campaignId = String(formData.get("campaignId") ?? "")
  await requireOwnedCampaign(campaignId)
  const csv = String(formData.get("csv") ?? "")
  await getJourneyStore().saveListReview({
    campaignId,
    ownerId: session.userId,
    csv,
    createdAt: new Date().toISOString(),
  })
  redirect(`/app/campaigns/${campaignId}/order`)
}

export async function startCheckoutAction(formData: FormData): Promise<void> {
  const session = await getSession()
  if (!session) throw new CampaignAccessError(401, "Sign in required.")
  const campaignId = String(formData.get("campaignId") ?? "")
  const campaign = await requireOwnedCampaign(campaignId)
  const stored = await getJourneyStore().getListReview(campaignId, session.userId)
  const review = reviewCustomerList(stored?.csv ?? "")
  const proof = freezeProof(campaign)
  const identity = listIdentity(review.accepted)
  const now = new Date().toISOString()
  const quote = buildQuote(readApprovedSchedule(), identity.count, now)
  if (!proof.ok || review.headerError || review.invalid.length > 0 || !quote.ok) {
    redirect(`/app/campaigns/${campaignId}/order`)
  }
  const approval = createApproval({
    campaignId,
    ownerId: session.userId,
    proof: proof.proof,
    listHash: identity.hash,
    listCount: identity.count,
    quote: quote.quote,
    acceptedAt: now,
  })
  const covered = approvalCovers(approval, {
    proofHash: proof.proof.proofHash,
    listHash: identity.hash,
    listCount: identity.count,
    quote: quote.quote,
    nowIso: now,
  })
  if (!covered.ok) redirect(`/app/campaigns/${campaignId}/order`)
  const store = getJourneyStore()
  await store.saveApproval(approval)
  const idempotencyKey = `checkout-${approval.id.slice(0, 24)}`
  const opened = await store.createJob(jobFromApproval(approval, idempotencyKey, now))
  await store.saveListReview({
    campaignId,
    ownerId: session.userId,
    csv: stored?.csv ?? "",
    createdAt: stored?.createdAt ?? now,
    jobId: opened.job.id,
  })
  redirect(`/app/campaigns/${campaignId}/order`)
}
