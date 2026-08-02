export type CommandCenterUserState = "new" | "active" | "power"

export type BusinessHealthStatus = "healthy" | "needs_attention" | "action_recommended"

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
  healthStatus: BusinessHealthStatus | null
  mailStatus: MailStatusSummary | null
  metrics: BusinessMetric[]
  recommendations: Recommendation[]
  opportunities: Opportunity[]
}
