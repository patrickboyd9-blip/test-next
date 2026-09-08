import type { CampaignIssue } from "./evaluation-types"

export function getHighestPriorityRecommendation(
  issues: CampaignIssue[]
): CampaignIssue | null {
  if (issues.length === 0) {
    return null
  }

  const critical = issues.find(
    (issue) => issue.severity === "critical"
  )

  if (critical) {
    return critical
  }

  const warning = issues.find(
    (issue) => issue.severity === "warning"
  )

  if (warning) {
    return warning
  }

  return issues[0]
}