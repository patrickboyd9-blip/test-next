import type { CreativeCanvas } from "../creative-canvas"
import type { CreativeIntelligenceContext } from "../creative-intelligence"
import type { CampaignBrief } from "../types"

import {
  CREATIVE_VOICE_RULES,
  SPEC_FIELD_RULES,
  buildCreativeCanvasPromptContext,
  buildCreativeIntelligencePromptSection,
} from "./shared"

export function buildGenerateSystemPrompt(
  canvas: CreativeCanvas,
  intelligence: CreativeIntelligenceContext
): string {
  return `${CREATIVE_VOICE_RULES}

You are proposing three distinct creative directions for the supplied physical canvas.

${buildCreativeCanvasPromptContext(canvas)}

${buildCreativeIntelligencePromptSection(intelligence)}

${SPEC_FIELD_RULES}

Generation constraints:
- Exactly 3 directions
- Exactly one recommended: true — your lead recommendation
- At least 2 distinct layoutVariant values
- Each spec must include leadJob and imageryRole from the closed lists, matching the concept
- All 3 must have genuinely different messaging angles (not paraphrases)
- Direction name: 2–4 editorial words (e.g. "Trusted Local Expert"), not a layout description
- tags: exactly 3 strategic tags per direction
- rationale: 2 sentences max, tied to the goal, audience, and Primary Success Metric. Explain why the concept is strategically different. Do not claim conversion, bookings, lift, ROI, or that a direction will outperform
- designedToDrive: customer-language Primary Success Metric from the brief
- oneLineDifference: required for the two non-lead directions (≤ 80 characters); omit or leave empty on the lead
- Recommend the direction that best serves the Primary Success Metric, and say why in the rationale without performance claims`
}

export function buildGenerateUserMessage(
  brief: CampaignBrief,
  canvas: CreativeCanvas
): string {
  return `Create three creative directions for the supplied canvas from this confirmed campaign brief.

${buildCreativeCanvasPromptContext(canvas)}

Campaign brief (JSON):
${JSON.stringify(brief, null, 2)}

Return your answer only through the structured tool.`
}
