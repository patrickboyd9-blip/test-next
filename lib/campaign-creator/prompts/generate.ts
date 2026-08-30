import type { CampaignBrief } from "../types"

import { CREATIVE_VOICE_RULES, SPEC_FIELD_RULES } from "./shared"

export function buildGenerateSystemPrompt(): string {
  return `${CREATIVE_VOICE_RULES}

You are proposing three distinct creative directions for a 4×6 postcard.

${SPEC_FIELD_RULES}

Generation constraints:
- Exactly 3 directions
- Exactly one recommended: true — your lead recommendation
- At least 2 distinct layoutVariant values
- All 3 must have genuinely different messaging angles (not paraphrases)
- Direction name: 2–4 editorial words (e.g. "Trusted Local Expert"), not a layout description
- tags: exactly 3 strategic tags per direction
- rationale: 2 sentences max, tied to the goal, audience, and Primary Success Metric
- designedToDrive: customer-language Primary Success Metric from the brief
- oneLineDifference: required for the two non-lead directions (≤ 80 characters); omit or leave empty on the lead
- Recommend the direction that best serves the Primary Success Metric, and say why in the rationale`
}

export function buildGenerateUserMessage(brief: CampaignBrief): string {
  return `Create three postcard directions from this confirmed campaign brief.

Campaign brief (JSON):
${JSON.stringify(brief, null, 2)}

Return your answer only through the structured tool.`
}
