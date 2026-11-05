export interface PlaybookCombo {
  headline: string
  offer: string
  photo_scene?: string
  sell_the_outcome_line?: string
}

export interface PlaybookOfferRow {
  offer_type: string
  primary_emotion: string
  why?: string
  headline_offer_patterns?: string[]
  reinforcing_photo?: string
  what_backfires?: string
  combos?: PlaybookCombo[]
  compliance_flags?: string[]
  evidence_strength?: string
}

export interface Playbook {
  schema_version: string
  slug: string
  industry: string
  last_updated?: string
  words_and_claims_to_avoid?: string[]
  compliance_notes?: string[]
  standing_rules?: string[]
  emotion_by_offer: PlaybookOfferRow[]
  emotion_by_offer_conflicts?: { conflict: string; resolution: string }[]
}
