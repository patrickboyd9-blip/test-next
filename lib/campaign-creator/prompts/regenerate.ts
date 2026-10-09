import type { CreativeCanvas } from "../creative-canvas"
import type { CreativeIntelligenceContext } from "../creative-intelligence"
import type { CampaignBrief, CreativeDirection } from "../types"

import {
  CONCEPTION_BEFORE_SPEC_RULES,
  CREATIVE_VOICE_RULES,
  DIRECTION_NAME_CONSTRAINT,
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
- typeRole and imagePresence are optional. Emit them only after the concept is established, and only when the concept needs subject or accent
- After conceiving visualDirection, emit imagePresence: accent when that conception names a small witness to a type-led piece. Do not emit accent when the image occupies the family's normal supporting or image field. Do not infer accent from imageryRole. Do not emit accent merely to make directions visually different
- Direction name: ${DIRECTION_NAME_CONSTRAINT} Count the words before you return the tool
- New messaging angles — do not paraphrase the previous set
- Honor the customer's feedback without abandoning the campaign goal or Primary Success Metric
- Do not invent facts missing from the brief
- For a local service, the recommendation is photography-forward. Do not recommend a text-only direction unless the strategy truly has no honest image job
- Headline is 3 to 6 words, never a sentence. Put the offer in the subheadline
- Prefer image_grounded when the photograph should fill the card, or a split when type and photograph share it. A split gives the photograph at least half the card. Use type_only only when there is no honest image job. Use imagePresence accent only when the piece is deliberately type-led`
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
    typeRole: direction.spec.typeRole,
    imagePresence: direction.spec.imagePresence,
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
