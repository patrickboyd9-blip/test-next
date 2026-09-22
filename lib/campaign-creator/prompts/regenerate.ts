import type { CreativeCanvas } from "../creative-canvas"
import type { CreativeIntelligenceContext } from "../creative-intelligence"
import type { CampaignBrief, CreativeDirection } from "../types"

import {
  CONCEPTION_BEFORE_SPEC_RULES,
  CREATIVE_VOICE_RULES,
  DIRECTION_SET_REASONING_RULES,
  SPEC_FIELD_RULES,
  buildCreativeCanvasPromptContext,
  buildCreativeIntelligencePromptSection,
} from "./shared"

export function buildRegenerateSystemPrompt(
  canvas: CreativeCanvas,
  intelligence: CreativeIntelligenceContext
): string {
  return `${CREATIVE_VOICE_RULES}

The customer rejected the previous three directions. Propose three genuinely new ones for the supplied physical canvas.

${buildCreativeCanvasPromptContext(canvas)}

${buildCreativeIntelligencePromptSection(intelligence)}

${SPEC_FIELD_RULES}

${DIRECTION_SET_REASONING_RULES}

${CONCEPTION_BEFORE_SPEC_RULES}

Regeneration constraints (same as generation):
- Exactly 3 directions, exactly one recommended
- At least 2 distinct layoutVariant values
- Each spec must include leadJob and imageryRole from the closed lists, matching the new concept
- New messaging angles — do not paraphrase the previous set
- Honor the customer's feedback without abandoning the campaign goal or Primary Success Metric
- Do not invent facts missing from the brief`
}

export function buildRegenerateUserMessage(input: {
  brief: CampaignBrief
  canvas: CreativeCanvas
  feedback: string
  previousDirections: CreativeDirection[]
}): string {
  const previous = input.previousDirections.map((direction) => ({
    name: direction.name,
    rationale: direction.rationale,
    tags: direction.tags,
    layoutVariant: direction.spec.layoutVariant,
    headline: direction.spec.headline,
    leadJob: direction.spec.leadJob,
    imageryRole: direction.spec.imageryRole,
  }))

  return `The previous directions did not land. Create three new ones for the supplied canvas.

${buildCreativeCanvasPromptContext(input.canvas)}

Customer feedback:
${input.feedback}

Previous directions (do not repeat these angles):
${JSON.stringify(previous, null, 2)}

Campaign brief (JSON):
${JSON.stringify(input.brief, null, 2)}

Return your answer only through the structured tool.`
}
