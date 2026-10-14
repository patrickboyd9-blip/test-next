import type { Campaign, CampaignEntry, DesignSource } from "./types"

/**
 * How the customer chose to start.
 * "ai", "upload", and "template" are stored on the campaign.
 * "team" stays on the design request and does not continue into a mail campaign.
 */
export type CampaignStartPath = "ai" | "upload" | "template" | "team"

/**
 * The next step after a start path is chosen.
 * AI, and a campaign with no stored path, generate three directions.
 * The legacy design chooser is not a step.
 */
export type StartPathNextStep = "directions" | "upload" | "template" | "team-request"

export function nextStepForStartPath(
  path: CampaignStartPath | undefined
): StartPathNextStep {
  switch (path) {
    case "upload":
      return "upload"
    case "template":
      return "template"
    case "team":
      return "team-request"
    case "ai":
    case undefined:
      return "directions"
  }
}

export type CreativeSurface = "directions" | "upload" | "template"

/**
 * What the creative step shows once the path is known.
 * Upload stays on the proof. A template stays in Studio.
 * AI, and campaigns created before the start grid (no stored path),
 * generate the three directions.
 */
export function creativeSurfaceForCampaign(campaign: {
  entry?: CampaignEntry
  designSource?: DesignSource
}): CreativeSurface {
  if (campaign.designSource === "upload" || campaign.entry === "upload") return "upload"
  if (campaign.entry === "template") return "template"
  return "directions"
}

/** Records Design it with AI on a fresh draft. Does not overwrite another path. */
export function applyAiStart(campaign: Campaign, now: string): void {
  if (campaign.entry || campaign.designSource) return
  if (campaign.status !== "draft") return
  campaign.entry = "ai"
  campaign.updatedAt = now
}

/**
 * Confirming strategy on the AI path, or on a campaign with no stored path,
 * opens Studio. Upload and template keep the path they already chose.
 */
export function applyAiDesignOnStrategyConfirm(campaign: Campaign): void {
  if (campaign.entry === "upload" || campaign.entry === "template") return
  if (campaign.designSource === "upload") return
  campaign.entry = "ai"
  if (!campaign.designSource) campaign.designSource = "studio"
}

/**
 * Persists the AI default when generation starts for a campaign that never
 * stored a path. Returns whether the campaign changed.
 */
export function applyAiGenerationStart(campaign: Campaign): boolean {
  if (campaign.creative.directions.length > 0) return false
  if (
    campaign.designSource === "upload" ||
    campaign.entry === "upload" ||
    campaign.entry === "template"
  ) {
    return false
  }

  let changed = false
  if (!campaign.entry) {
    campaign.entry = "ai"
    changed = true
  }
  if (!campaign.designSource) {
    campaign.designSource = "studio"
    changed = true
  }
  if (campaign.status !== "generating_creative") {
    campaign.status = "generating_creative"
    changed = true
  }
  return changed
}
