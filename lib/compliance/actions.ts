"use server"

import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import type { Recipient } from "@/lib/click2mail/recipients"

import { COMPLIANCE_TEXT, EMPTY_CERTIFICATION_BOXES } from "./legal-text"
import { gateCampaignContinue, gateCampaignSubmit, writeAccountAcceptance } from "./record"
import { readRequestMeta } from "./request-meta"

const repository = getCampaignRepository()

export async function acceptAccountTerms(
  agreed: boolean
): Promise<{ ok: boolean; message?: string }> {
  if (agreed !== true) {
    return { ok: false, message: "Check the box to agree." }
  }
  await writeAccountAcceptance(await readRequestMeta())
  return { ok: true }
}

/** Whether an earlier approval still covers this exact list and category. */
export async function previewCampaignSend(
  campaignId: string,
  industryId: string,
  recipients: Recipient[]
): Promise<{ covered: boolean; message: string | null }> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) return { covered: false, message: null }
  const decision = await gateCampaignSubmit({
    campaign,
    recipients,
    certification: {
      textVersionId: COMPLIANCE_TEXT.versionId,
      industryId,
      boxes: EMPTY_CERTIFICATION_BOXES,
    },
  })
  if (decision.ok && decision.mode === "prior") {
    return { covered: true, message: null }
  }
  if (!decision.ok && (decision.code === "stale" || decision.code === "actor" || decision.code === "version")) {
    return { covered: false, message: decision.message }
  }
  return { covered: false, message: null }
}

export async function previewContinueSend(
  campaignId: string
): Promise<{ ok: boolean; message: string | null }> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) return { ok: false, message: "That campaign could not be found." }
  const decision = await gateCampaignContinue(campaign)
  if (decision.ok) return { ok: true, message: null }
  return { ok: false, message: decision.message }
}
