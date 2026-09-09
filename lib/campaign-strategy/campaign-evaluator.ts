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
  const score = Math.max(
    0,
    100 -
      issues.reduce(
        (total, issue) =>
          total +
          (issue.severity === "critical"
            ? 25
            : issue.severity === "warning"
            ? 10
            : 5),
        0
      )
  )
  issues.sort((a, b) => {
    const priority = {
      critical: 3,
      warning: 2,
      good: 1,
    }
  
    return priority[b.severity] - priority[a.severity]
  })
  return {
    score,
    confidence:
      score >= 85
        ? "high"
        : score >= 60
        ? "medium"
        : "low",
    missingInformation: issues
      .filter((issue) => issue.severity === "critical")
      .map((issue) => issue.title),
    issues,
  }
}