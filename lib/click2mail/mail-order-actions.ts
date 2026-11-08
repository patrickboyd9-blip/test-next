"use server"

import { requireOwnedCampaign } from "@/lib/auth/campaign-access"
import { PRINT_TEST_REFUSAL } from "@/lib/mail-journey/mail-gate"
import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import type { Campaign } from "@/lib/campaign-creator/types"

import { assertClick2MailCallable, loadClick2MailConfig } from "./config"
import { createClick2MailClient } from "./client"
import { refreshClick2MailOrder } from "./order"
import type { MailOrderRecord } from "./order-record"

const repository = getCampaignRepository()

export interface PrintMailActionResult {
  campaign: Campaign
  issues: string[]
}

export async function submitPrintMailTest(
  campaignId: string,
  _input:
    | { kind: "csv"; csvText: string }
    | {
        kind: "self"
        first: string
        last: string
        address1: string
        address2?: string
        city: string
        state: string
        zip: string
      }
): Promise<PrintMailActionResult> {
  const campaign = await requireOwnedCampaign(campaignId)
  return { campaign, issues: [PRINT_TEST_REFUSAL] }
}

export async function continuePrintMailTest(campaignId: string): Promise<PrintMailActionResult> {
  const campaign = await requireOwnedCampaign(campaignId)
  return { campaign, issues: [PRINT_TEST_REFUSAL] }
}

export async function refreshPrintMailStatus(campaignId: string): Promise<PrintMailActionResult> {
  const campaign = await requireOwnedCampaign(campaignId)
  const order = campaign.mailOrder
  if (!order) return { campaign, issues: [] }

  try {
    const { client } = clientFromEnv()
    if (!order.jobId && order.addressListId) {
      const list = await client.getAddressList(order.addressListId)
      const next: MailOrderRecord = {
        ...order,
        addressListStatus: list.status,
        resultDescription: list.description || order.resultDescription,
        lastPolledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        error: undefined,
      }
      const saved = await repository.saveMailOrder(campaignId, next)
      return { campaign: saved, issues: [] }
    }
    if (!order.jobId) return { campaign, issues: [] }
    const refreshed = await refreshClick2MailOrder({ client, order })
    const saved = await repository.saveMailOrder(campaignId, refreshed)
    return { campaign: saved, issues: refreshed.error ? [refreshed.error] : [] }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status check failed."
    return { campaign, issues: [message] }
  }
}

function clientFromEnv() {
  const config = loadClick2MailConfig()
  assertClick2MailCallable(config)
  return { config, client: createClick2MailClient({ config }) }
}


