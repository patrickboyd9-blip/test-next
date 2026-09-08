import type { CampaignBrief } from "../campaign-creator/types"

import type {
  CampaignEvaluation,
  CampaignIssue,
} from "./evaluation-types"
import { missingGoalRule } from "./rules/missing-goal"
import { missingAudienceRule } from "./rules/missing-audience"
import { missingOfferRule } from "./rules/missing-offer"
import { missingSuccessMetricRule } from "./rules/missing-success-metric"

export function evaluateCampaign(
    brief: CampaignBrief
  ): CampaignEvaluation {
  const issues: CampaignIssue[] = []
  const rules = [
    missingGoalRule,
    missingAudienceRule,
    missingOfferRule,
    missingSuccessMetricRule,
  ]
  for (const rule of rules) {
    const issue = rule.evaluate(brief)
  
    if (issue) {
      issues.push(issue)
    }
  }
  return {
    missingInformation: issues
      .filter((issue) => issue.severity === "critical")
      .map((issue) => issue.title),
  
    issues,
  }
  }