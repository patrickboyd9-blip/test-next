import type { Campaign } from "./types"

/**
 * Drop the internal craft score before a campaign reaches the browser.
 * The stored campaign keeps it.
 */
export function campaignForCustomer(campaign: Campaign): Campaign {
  return {
    ...campaign,
    creative: {
      ...campaign.creative,
      directions: campaign.creative.directions.map((direction) => {
        if (!direction.research?.quality) return direction
        const research = { ...direction.research }
        delete research.quality
        return { ...direction, research }
      }),
    },
  }
}
