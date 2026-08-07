export type CommandCenterUserState = "new" | "active" | "power"

export type ConfidenceLevel = "on_track" | "needs_attention" | "at_risk"

/**
 * Interpretation, not a raw metric: how likely the campaign is to hit the
 * customer's own Primary Success Metric (calls, QR scans, deliveries, etc).
 */
export interface CampaignConfidence {
  level: ConfidenceLevel
  primaryMetricLabel: string
  headline: string
  evidence: string
}

export interface MailStatusSummary {
  delivered: number
  inTransit: number
  scheduled: number
  nextDelivery: {
    date: string
    label: string
  } | null
}

export interface BusinessMetric {
  id: string
  label: string
  value: number
  unit?: string
  changePercent?: number
}

export interface Recommendation {
  id: string
  title: string
  why: string
  estimatedImpact?: string
  ctaLabel: string
  ctaHref: string
}

export interface Opportunity {
  id: string
  title: string
  description: string
  ctaLabel: string
  ctaHref: string
}

export interface CommandCenterSnapshot {
  state: CommandCenterUserState
  greetingName: string
  businessName: string
  summary: string
  confidence: CampaignConfidence | null
  mailStatus: MailStatusSummary | null
  metrics: BusinessMetric[]
  recommendations: Recommendation[]
  opportunities: Opportunity[]
}
