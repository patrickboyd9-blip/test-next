import type { CampaignBrief } from "../../campaign-creator/types"
import type { CampaignIssue } from "../evaluation-types"

export interface CampaignRule {
  id: string

  description: string

  evaluate(
    brief: CampaignBrief
  ): CampaignIssue | null
}