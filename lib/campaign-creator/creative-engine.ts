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

export class CreativeEngineNotConfiguredError extends Error {
  constructor() {
    super(
      "No CreativeEngine implementation is configured. A provider must be " +
        "connected behind this interface before Modern Mail can generate creative " +
        "directions for customers."
    )
    this.name = "CreativeEngineNotConfiguredError"
  }
}

/**
 * Placeholder engine — throws until a real provider is wired in Milestone 2.
 * Callers depend only on the CreativeEngine interface above.
 */
export class PlaceholderCreativeEngine implements CreativeEngine {
  async generateDirections(): Promise<GenerateDirectionsResult> {
    throw new CreativeEngineNotConfiguredError()
  }

  async refineDirection(): Promise<RefineDirectionResult> {
    throw new CreativeEngineNotConfiguredError()
  }

  async regenerateDirections(): Promise<GenerateDirectionsResult> {
    throw new CreativeEngineNotConfiguredError()
  }
}

let cachedEngine: CreativeEngine | null = null

/**
 * Provider boundary for creative generation and refinement.
 * Returns PlaceholderCreativeEngine until ANTHROPIC_API_KEY (or another provider)
 * is connected in a future milestone.
 */
export function getCreativeEngine(): CreativeEngine {
  if (!cachedEngine) {
    cachedEngine = new PlaceholderCreativeEngine()
  }
  return cachedEngine
}

/**
 * Apply generation output onto campaign creative state — keeps repository/actions
 * thin when Milestone 2 connects a real engine.
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
