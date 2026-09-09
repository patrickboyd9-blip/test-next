export type EvaluationSeverity =
  | "good"
  | "warning"
  | "critical"

export interface CampaignIssue {
  category: string
  severity: EvaluationSeverity
  title: string
  explanation: string
  recommendation: string
}

export interface CampaignEvaluation {
  score: number
  confidence: "high" | "medium" | "low"
  missingInformation: string[]
  issues: CampaignIssue[]
}