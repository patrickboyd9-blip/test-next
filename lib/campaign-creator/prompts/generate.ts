import { emotionByOfferGuidance } from "@/lib/design-intelligence/emotion-by-offer"
import type { CreativeCanvas } from "../creative-canvas"
import type { CreativeIntelligenceContext } from "../creative-intelligence"
import type { CampaignBrief } from "../types"

import {
  CONCEPTION_BEFORE_SPEC_RULES,
  CREATIVE_VOICE_RULES,
  DIRECTION_NAME_CONSTRAINT,
  DIRECTION_SET_REASONING_RULES,
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

${DIRECTION_SET_REASONING_RULES}

${CONCEPTION_BEFORE_SPEC_RULES}

Generation constraints:
- Exactly 3 directions
- Exactly one recommended: true — your lead recommendation
- At least 2 distinct layoutVariant values
- Each spec must include leadJob and imageryRole from the closed lists, matching the concept
- typeRole and imagePresence are optional. Emit them only after the concept is established, and only when the concept needs subject or accent
- After conceiving visualDirection, emit imagePresence: accent when that conception names a small witness to a type-led piece. Do not emit accent when the image occupies the family's normal supporting or image field. Do not infer accent from imageryRole. Do not emit accent merely to make directions visually different
- All 3 must have genuinely different messaging angles (not paraphrases). Use three different psychologies: one sells the result, one pairs a threat with one easy action, and one uses local trust in the business the client named. Do not quote another brand's slogan or any campaign result figure
- Direction name: ${DIRECTION_NAME_CONSTRAINT} Count the words before you return the tool
- tags: exactly 3 strategic tags per direction
- rationale: 2 sentences max, tied to the goal, audience, and Primary Success Metric. Explain why the concept is strategically different. Do not claim conversion, bookings, lift, ROI, or that a direction will outperform. Never invent an age, an income, years in the home, or a neighborhood count. Only cite facts that are in the brief
- designedToDrive: customer-language Primary Success Metric from the brief
- oneLineDifference: required for the two non-lead directions (≤ 80 characters); omit or leave empty on the lead
- Recommend the direction that best serves the Primary Success Metric, and say why in the rationale without performance claims
- For a local service, that recommendation is photography-forward. Do not recommend a text-only direction unless the strategy truly has no honest image job
- Headline is 3 to 8 words. It must be specific to this business and its offer: name the real job (a discount, a metal roof, gutters, storm or hail, a repair) or the city, so it could not run unchanged for another roofer. Put the offer in the subheadline. Never use an age angle (seniors, retirees, "golden years", fixed incomes) unless the brief's audience explicitly names an age group
- Never use these stock lines or close paraphrases of them: "A dry, safe home in [city]", "Call before a small leak spreads", "[Business name] checks this". Research mailers are patterns only: learn their structure, tone and offer placement, and never reuse or lightly reword any of their headlines or offers. Never tell the reader they have damage or that they "qualify". The three headlines must not share an opening
- The offer field is the brief's offer copied word for word, character for character. Do not shorten, abbreviate (no "12 mo"), reword, or add to it
- Prefer image_grounded: a full-bleed photograph of the finished outcome (the real home or job, people visible, heads in frame) with the type on a scrim or band. Do not use split layouts or cream side panels. Use type_only only when there is no honest image job
- One service per front, and the photograph shows that same service. Never put financing in a headline
- When the brief allows a choice of offer, prefer a dollar-off offer ("$500 off a full roof replacement") over a percentage or a bundle
- Financing copy: the only allowed line is "Financing available", and any rate must say APR ("0% APR"). Never print a monthly payment, a term ("18 months", "no payments for 12 months") or a down payment
- Never write "free X with purchase" on bid-priced jobs (roofs, siding, windows); say "gutters included" or "installation included" and put any condition next to the offer, never in an asterisk footnote
- "Lifetime" must say whose life or what it covers. Promise a money-back or satisfaction guarantee only for a full-price refund. Write "or we come back at no charge", never "or it's free"
- Never write: "no cost solar", "free solar", federal tax credits on solar, HVAC or windows, "free insurance replacement", "You have hail damage!", or that a bill is cut in half. For storm offers ask "Did it hit your roof?"
- For water heaters, the headline is "Is your water heater more than 10 years old?"
- When Creative Intelligence names the layouts the matched research supports, use only those layouts. That list overrides this general preference. The three directions must still differ`
}

export function buildGenerateUserMessage(
  brief: CampaignBrief,
  canvas: CreativeCanvas
): string {
  return `Create three creative directions for the supplied canvas from this confirmed campaign brief.

${buildCreativeCanvasPromptContext(canvas)}

Campaign brief (JSON):
${JSON.stringify(brief, null, 2)}
${emotionByOfferGuidance(brief)}

Return your answer only through the structured tool.`
}
