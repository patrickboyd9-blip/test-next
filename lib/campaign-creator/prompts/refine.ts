import type { CreativeCanvas } from "../creative-canvas"
import type { CreativeIntelligenceContext } from "../creative-intelligence"
import type {
  CampaignBrief,
  CreativeDirection,
  CreativeRevision,
  CreativeSpec,
} from "../types"

import {
  CREATIVE_VOICE_RULES,
  SPEC_FIELD_RULES,
  buildCreativeCanvasPromptContext,
  buildCreativeIntelligencePromptSection,
} from "./shared"

export function buildRefineSystemPrompt(
  canvas: CreativeCanvas,
  intelligence: CreativeIntelligenceContext
): string {
  return `${CREATIVE_VOICE_RULES}

The customer is refining one selected direction in natural language. You are in Collaboration mode.

${buildCreativeCanvasPromptContext(canvas)}

${buildCreativeIntelligencePromptSection(intelligence)}

${SPEC_FIELD_RULES}

Refinement rules:
- Return a full next CreativeSpec snapshot, not a patch
- Change only what the customer asked for. Preserve everything else
- Ignore any legacy format or backLayout fields on the current spec — they are not physical authority. The supplied canvas is the physical authority
- Do not emit format or backLayout
- If the request would remove the QR path, phone, or offer when those are required for the campaign's success metric or brief, do not apply it. Set outcome to conflict and ask one alternative question
- If the request is ambiguous ("make it better", "improve it") without a specific change, set outcome to conflict and ask one clarifying question. Do not mutate the spec
- studioResponse: one or two short sentences. Lead with what changed (or why you didn't). No jargon
- Do not mention revision history, versions, or internal field names`
}

export function buildRefineUserMessage(input: {
  brief: CampaignBrief
  canvas: CreativeCanvas
  direction: CreativeDirection
  currentSpec: CreativeSpec
  revisions: CreativeRevision[]
  prompt: string
}): string {
  const recent = input.revisions
    .filter((revision) => revision.directionId === input.direction.id)
    .slice(0, 6)
    .map((revision) => ({
      version: revision.version,
      type: revision.type,
      customerPrompt: revision.customerPrompt,
    }))

  return `Selected direction: ${input.direction.name}
Why this direction: ${input.direction.rationale}

${buildCreativeCanvasPromptContext(input.canvas)}

Campaign brief (JSON):
${JSON.stringify(input.brief, null, 2)}

Current spec (JSON). Ignore format and backLayout if present — they are legacy and not physical authority:
${JSON.stringify(input.currentSpec, null, 2)}

Recent prompts on this direction (JSON):
${JSON.stringify(recent, null, 2)}

Customer request:
${input.prompt}

Return your answer only through the structured tool.`
}
