import type { CampaignBrief, CreativeDirection } from "../types"

import { CREATIVE_VOICE_RULES, SPEC_FIELD_RULES } from "./shared"

export function buildRegenerateSystemPrompt(): string {
  return `${CREATIVE_VOICE_RULES}

The customer rejected the previous three directions. Propose three genuinely new ones.

${SPEC_FIELD_RULES}

Regeneration constraints (same as generation):
- Exactly 3 directions, exactly one recommended
- At least 2 distinct layoutVariant values
- New messaging angles — do not paraphrase the previous set
- Honor the customer's feedback without abandoning the campaign goal or Primary Success Metric
- Do not invent facts missing from the brief`
}

export function buildRegenerateUserMessage(input: {
  brief: CampaignBrief
  feedback: string
  previousDirections: CreativeDirection[]
}): string {
  const previous = input.previousDirections.map((direction) => ({
    name: direction.name,
    rationale: direction.rationale,
    tags: direction.tags,
    layoutVariant: direction.spec.layoutVariant,
    headline: direction.spec.headline,
  }))

  return `The previous directions did not land. Create three new ones.

Customer feedback:
${input.feedback}

Previous directions (do not repeat these angles):
${JSON.stringify(previous, null, 2)}

Campaign brief (JSON):
${JSON.stringify(input.brief, null, 2)}

Return your answer only through the structured tool.`
}
