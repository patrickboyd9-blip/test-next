import type {
  CampaignBrief,
  CampaignCreative,
  CreativeDirection,
  CreativeRecommendation,
  CreativeRevision,
  CreativeSpec,
} from "./types"

export interface GenerateDirectionsInput {
  brief: CampaignBrief
}

export interface GenerateDirectionsResult {
  directions: CreativeDirection[]
  recommendation: CreativeRecommendation
  recommendedDirectionId: string
}

export interface RefineDirectionInput {
  brief: CampaignBrief
  direction: CreativeDirection
  revisions: CreativeRevision[]
  prompt: string
}

export interface RefineDirectionResult {
  spec: CreativeSpec
  revision: Omit<CreativeRevision, "id" | "createdAt">
  /** Set when the requested change conflicts with campaign intent. */
  conflict?: {
    message: string
    suggestion?: string
  }
}

export interface RegenerateDirectionsInput {
  brief: CampaignBrief
  feedback: string
  previousDirections: CreativeDirection[]
}

export interface CreativeEngine {
  generateDirections(input: GenerateDirectionsInput): Promise<GenerateDirectionsResult>
  refineDirection(input: RefineDirectionInput): Promise<RefineDirectionResult>
  regenerateDirections(input: RegenerateDirectionsInput): Promise<GenerateDirectionsResult>
}

/**
 * Apply generation output onto campaign creative state.
 * Provider-agnostic — works for mock or Anthropic results.
 */
export function applyGeneratedDirections(
  creative: CampaignCreative,
  result: GenerateDirectionsResult
): CampaignCreative {
  return {
    ...creative,
    directions: result.directions,
    recommendation: result.recommendation,
    recommendedDirectionId: result.recommendedDirectionId,
    selectedDirectionId: undefined,
    revisions: [],
    approvedRevisionId: undefined,
  }
}
