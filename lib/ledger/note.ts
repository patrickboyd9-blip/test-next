import { requireOwnedCampaign } from "@/lib/auth/campaign-access"
import type { CampaignRepository } from "@/lib/campaign-creator/repository"
import { getSession } from "@/lib/auth/session"

import { getLedgerStore, ledgerEventId, type LedgerEvent, type LedgerOutcome, type LedgerStore } from "./event"

export async function noteEvent(
  store: LedgerStore,
  input: Omit<LedgerEvent, "id">
): Promise<{ event: LedgerEvent; created: boolean }> {
  const id = ledgerEventId(input.ownerId, input.campaignId, input.type, input.versionKey)
  return store.record({ ...input, id })
}

export async function noteForSession(input: Omit<LedgerEvent, "id" | "ownerId" | "occurredAt"> & { occurredAt?: string }): Promise<void> {
  const session = await getSession()
  if (!session) return
  await noteEvent(getLedgerStore(), {
    ...input,
    ownerId: session.userId,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  })
}

export async function historyForCampaign(
  campaignId: string,
  repository: CampaignRepository,
  ledger: LedgerStore
) {
  const campaign = await requireOwnedCampaign(campaignId, repository)
  const session = await getSession()
  const events = session ? await ledger.list(session.userId, campaign.id) : []
  return { campaign, events }
}

export function outcomeLabel(outcome: LedgerOutcome): string {
  if (outcome === "completed") return "Recorded"
  if (outcome === "failed") return "Did not succeed"
  return "Unknown"
}
