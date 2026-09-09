import type { CampaignEvaluation } from "./evaluation-types"

export interface Recommendation {
  category: string
  title: string
  explanation: string
  priority: "high" | "medium" | "low"
}

export interface RecommendationResult {
  evaluation: CampaignEvaluation
  recommendations: Recommendation[]
}