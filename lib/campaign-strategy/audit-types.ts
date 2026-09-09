export interface CampaignAudit {
    overallScore: number
    confidence: "high" | "medium" | "low"
  
    strengths: string[]
    warnings: string[]
    criticalIssues: string[]
    opportunities: string[]
  
    estimatedImpact: string
  }