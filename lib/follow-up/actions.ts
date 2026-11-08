"use server"

import { redirect } from "next/navigation"

import { CampaignAccessError, requireOwnedCampaign } from "@/lib/auth/campaign-access"
import { getSession } from "@/lib/auth/session"
import { noteForSession } from "@/lib/ledger/note"

import { importEvents } from "./import"
import { emptyPolicy, type FollowUpPolicy } from "./policy"
import { buildProposal, handoffBlockers, scheduleConfigured } from "./proposal"
import { getFollowUpStore } from "./store"

export async function previewFollowUpAction(campaignId: string, formData: FormData): Promise<void> {
  const session = await requireSession()
  const campaign = await requireOwnedCampaign(campaignId)
  const imported = importEvents(String(formData.get("csv") ?? ""))
  const policy = policyFromForm(formData)
  const { proposal } = buildProposal({
    ownerId: session.userId,
    campaignId,
    policy,
    events: imported.events,
    offer: campaign.brief.offer ?? "",
    trade: campaign.jobCreative?.trade ?? "unknown",
    job: campaign.jobCreative ?? null,
    guidanceVersion: campaign.strategyGuidance?.sourceVersion ?? null,
    nowIso: new Date().toISOString(),
  })
  await getFollowUpStore().save({ ...proposal, rows: proposal.rows })
  await noteForSession({
    campaignId,
    type: "proposal_previewed",
    outcome: imported.headerError ? "failed" : "completed",
    versionKey: `follow-up:${proposal.id}`,
    creativeVersion: proposal.frozen.creativeVersion,
    listHash: proposal.frozen.audienceHash,
    listCount: proposal.frozen.includedCount,
    amountCents: null,
    note: `${proposal.frozen.includedCount} follow-up rows included. Addresses are not stored in this history. Nothing was sent.`,
  })
  const error = imported.headerError ? `?error=${encodeURIComponent(imported.headerError)}` : ""
  redirect(`/app/campaigns/${campaignId}/follow-up${error}`)
}

export async function approveFollowUpAction(campaignId: string): Promise<void> {
  const session = await requireSession()
  const campaign = await requireOwnedCampaign(campaignId)
  const current = await getFollowUpStore().latest(session.userId, campaignId)
  if (!current) redirect(`/app/campaigns/${campaignId}/follow-up?error=${encodeURIComponent("Import a list before approving a proposal.")}`)
  const handoff = handoffBlockers({
    proposal: current,
    trade: campaign.jobCreative?.trade ?? "unknown",
    offer: campaign.brief.offer ?? "",
    job: campaign.jobCreative ?? null,
    guidanceVersion: campaign.strategyGuidance?.sourceVersion ?? null,
    scheduleConfigured: scheduleConfigured(),
  })
  if (!handoff.ready) {
    redirect(`/app/campaigns/${campaignId}/follow-up?error=${encodeURIComponent(handoff.blockers[0] ?? "This proposal cannot move to order review.")}`)
  }
  await getFollowUpStore().markApproved(current)
  await noteForSession({
    campaignId,
    type: "proposal_approved",
    outcome: "completed",
    versionKey: `follow-up-approved:${current.id}`,
    creativeVersion: current.frozen.creativeVersion,
    listHash: current.frozen.audienceHash,
    listCount: current.frozen.includedCount,
    amountCents: null,
    note: "Proposal approved for later order review. Nothing was charged and nothing was mailed.",
  })
  redirect(`/app/campaigns/${campaignId}/order`)
}

function policyFromForm(formData: FormData): FollowUpPolicy {
  const policy = emptyPolicy()
  policy.playSelected = formData.get("play") === "yes"
  policy.cap = integerOrNull(formData.get("cap"))
  policy.recentContactDays = integerOrNull(formData.get("recentDays"))
  policy.excludeConverted = yesNo(formData.get("excludeConverted"))
  policy.excludeOptOut = yesNo(formData.get("excludeOptOut"))
  policy.mailPermission = formData.get("mailPermission") === "yes"
  policy.photoPermission = formData.get("photoPermission") === "yes"
  policy.storyPermission = formData.get("storyPermission") === "yes"
  return policy
}

function integerOrNull(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim()
  if (!text) return null
  const parsed = Number(text)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}

function yesNo(value: FormDataEntryValue | null): boolean | null {
  if (value === "yes") return true
  if (value === "no") return false
  return null
}

async function requireSession() {
  const session = await getSession()
  if (!session) throw new CampaignAccessError(401, "Sign in required.")
  return session
}
