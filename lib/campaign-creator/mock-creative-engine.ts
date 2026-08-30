import type {
  CreativeEngine,
  GenerateDirectionsInput,
  GenerateDirectionsResult,
  RefineDirectionInput,
  RefineDirectionResult,
  RegenerateDirectionsInput,
} from "./creative-engine"
import {
  currentSpecFromInput,
  finalizeRefinement,
  normalizeGenerationResult,
} from "./creative-engine-guards"
import {
  getMockCreativeDirections,
  getMockRecommendation,
} from "./mock-creative-data"
import { applyMockRefinement } from "./mock-refinement-engine"

/**
 * Deterministic engine used when no API key is configured, or when
 * CREATIVE_ENGINE=mock. Wraps the existing mock generation and refinement
 * helpers and runs the same post-guards as the live engine.
 */
export class MockCreativeEngine implements CreativeEngine {
  async generateDirections(
    input: GenerateDirectionsInput
  ): Promise<GenerateDirectionsResult> {
    return normalizeMockGeneration(input)
  }

  async refineDirection(input: RefineDirectionInput): Promise<RefineDirectionResult> {
    const currentSpec = currentSpecFromInput(input)
    const outcome = applyMockRefinement({
      brief: input.brief,
      currentSpec,
      prompt: input.prompt,
    })

    if (outcome.kind === "conflict") {
      return finalizeRefinement({
        brief: input.brief,
        directionId: input.direction.id,
        currentSpec,
        prompt: input.prompt,
        proposed: {
          outcome: "conflict",
          studioResponse: outcome.studioResponse,
        },
      })
    }

    return finalizeRefinement({
      brief: input.brief,
      directionId: input.direction.id,
      currentSpec,
      prompt: input.prompt,
      proposed: {
        outcome: "success",
        spec: outcome.spec,
        studioResponse: outcome.studioResponse,
      },
    })
  }

  async regenerateDirections(
    input: RegenerateDirectionsInput
  ): Promise<GenerateDirectionsResult> {
    return normalizeMockGeneration({ brief: input.brief })
  }
}

function normalizeMockGeneration(
  input: GenerateDirectionsInput
): GenerateDirectionsResult {
  const directions = getMockCreativeDirections(input.brief)
  const result = normalizeGenerationResult(input.brief, directions, {
    stripInventedFacts: false,
  })
  const recommendation = getMockRecommendation(result.directions)
  return {
    ...result,
    recommendation: {
      ...recommendation,
      rationale: result.recommendation.rationale,
    },
  }
}
