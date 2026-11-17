import { getCampaignRepository, type CampaignRepository } from "@/lib/campaign-creator/repository"
import type { Campaign } from "@/lib/campaign-creator/types"

import { ownerMatches } from "./ownership"
import { getSession } from "./session"

export class CampaignAccessError extends Error {
  readonly status: 401 | 404

  constructor(status: 401 | 404, message: string) {
    super(message)
    this.status = status
    this.name = "CampaignAccessError"
  }
}

/**
 * Server-side owner check. No session is 401. A missing campaign, a different
 * owner, and a blank owner are all 404, so one account cannot learn that
 * another account's id exists.
 */
export async function requireOwnedCampaign(
  campaignId: string,
  repository: CampaignRepository = getCampaignRepository()
): Promise<Campaign> {
  const session = await getSession()
  if (!session) throw new CampaignAccessError(401, "Sign in required.")
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign || !ownerMatches(campaign.ownerId, session)) {
    throw new CampaignAccessError(404, "Campaign not found.")
  }
  return campaign
}

/** Response to return before a campaign file is read. Null means the caller may continue. */
export async function denyUnlessCampaignOwner(campaignId: string): Promise<Response | null> {
  try {
    await requireOwnedCampaign(campaignId)
    return null
  } catch (error) {
    if (error instanceof CampaignAccessError) {
      return new Response(error.message, {
        status: error.status,
        headers: { "Cache-Control": "private, no-store" },
      })
    }
    throw error
  }
}
