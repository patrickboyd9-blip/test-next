import type { CampaignBrief, ConversationMessage } from "./types"

export interface ConversationTurnInput {
  brief: CampaignBrief
  transcript: ConversationMessage[]
  message: string
}

export interface ConversationTurnResult {
  /** The engine's updated understanding — merged over the existing brief. */
  brief: Partial<CampaignBrief>
  /** What Modern Mail says back to the customer this turn. */
  reply: string
  /** True once the engine has enough to show the brief for review — never a numeric score. */
  readyForBriefReview: boolean
}

export interface ConversationEngine {
  nextTurn(input: ConversationTurnInput): Promise<ConversationTurnResult>
}
