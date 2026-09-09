import type { CampaignEvaluation } from "./evaluation-types"
import type { CampaignAudit } from "./audit-types"

export function buildCampaignAudit(
  evaluation: CampaignEvaluation
): CampaignAudit {
  return {
    overallScore: evaluation.score,
    confidence: evaluation.confidence,

    strengths:
      evaluation.score >= 85
        ? [
            "Campaign foundation is strong.",
            "Only minor optimizations are recommended.",
          ]
        : [],

    warnings: evaluation.issues
      .filter((issue) => issue.severity === "warning")
      .map((issue) => issue.title),

    criticalIssues: evaluation.issues
      .filter((issue) => issue.severity === "critical")
      .map((issue) => issue.title),

    opportunities: evaluation.issues.map(
      (issue) => issue.recommendation
    ),

    estimatedImpact:
      evaluation.score >= 85
        ? "Small improvements may increase response rate by 5–10%."
        : evaluation.score >= 60
        ? "Addressing the identified issues could improve campaign performance by 15–25%."
        : "Significant improvements are likely. Reworking the strategy before launch is strongly recommended.",
  }
}