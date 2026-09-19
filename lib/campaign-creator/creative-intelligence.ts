import { PLAYBOOKS, findIndustryPlaybook } from "../campaign-strategy/playbooks"
import type { CampaignBrief } from "./types"

/**
 * Non-persisted, campaign-local knowledge pack for the Creative Engine.
 * Not CampaignStrategy. Not evidence. Not a Campaign field.
 */
export interface CreativeIntelligenceContext {
  directMailHeuristics: readonly string[]
  industryHeuristics: readonly string[]
}

/**
 * Creative-relevant subset of DIRECT_MAIL_BEST_PRACTICES.
 * Heuristics only — not measured outcomes.
 */
export const CREATIVE_DIRECT_MAIL_HEURISTICS = [
  "Give the mailer one primary objective and one desired action.",
  "Lead with the offer; decoration should not outrank a clear offer.",
  "The headline should communicate value immediately.",
  "The recipient decides in seconds — make the message obvious at a glance.",
  "Phone, QR, URL, and offer should be easy to find when they exist on the brief.",
  "Make responding one easy action. Do not ask for several important things at once.",
  "Prefer specific, concrete language over vague claims.",
  "A limited-time or urgent frame can outperform an evergreen one when the brief supports it.",
  "Use trust signals that already appear on the brief (years, reviews, credentials, local ownership, guarantees).",
  "The piece should answer: why care, why trust, why act now.",
  "Every design choice should support the single objective. Drop what does not.",
] as const

const PLUMBING_CREATIVE_HEURISTICS = [
  "Lead with the homeowner's problem, not the company.",
  "Make one clear offer.",
  "Give recipients one clear action.",
  "Build trust before asking for the sale.",
  "Keep messaging simple and highly localized.",
  "When the brief includes them, use trust builders such as licensed, bonded, insured, reviews, years in business, family-owned, or a satisfaction guarantee.",
  "Avoid a weak call-to-action, missing urgency when the offer is time-bound, and missing social proof when the brief has it.",
] as const

const PLUMBING_OFFER_EXAMPLES_WHEN_BRIEF_HAS_NONE = [
  "The brief has no offer. Industry offer frames to consider as patterns only — do not invent that this business provides them: free inspection, discounted drain cleaning, water heater specials, emergency service, first-time customer discount.",
] as const

export function buildCreativeIntelligenceContext(
  brief: CampaignBrief
): CreativeIntelligenceContext {
  return {
    directMailHeuristics: CREATIVE_DIRECT_MAIL_HEURISTICS,
    industryHeuristics: industryHeuristicsFor(brief),
  }
}

export function formatCreativeIntelligenceContext(
  context: CreativeIntelligenceContext
): string {
  const industryBlock =
    context.industryHeuristics.length > 0
      ? `Industry heuristics (matched vertical only):
These are industry heuristics, NOT measured performance data or campaign outcomes.
${bullets(context.industryHeuristics)}`
      : `Industry heuristics:
None. No industry playbook matched this campaign. Do not invent vertical knowledge.`

  return `Creative Intelligence context — decision guidance only.

Knowledge classification:
- Campaign facts: supplied separately as the Campaign Brief JSON. Those are customer-specific facts. Prioritize them over heuristics.
- Physical constraints: supplied separately as the Physical canvas. That canvas is authoritative. Do not choose a different mail piece, catalog product, dimensions, bleed, reserved-zone geometry, or vendor option, and do not override the canvas.
- Modern Mail heuristics: general direct-mail principles. These are Modern Mail heuristics, NOT measured performance data or campaign outcomes.
- Industry heuristics: creative guidance from a matched industry playbook, if any. These are heuristics, NOT measured performance data.

How to use this knowledge:
- Consider the heuristics when choosing creative angle, messaging, offer framing, headline, CTA, trust, urgency, imagery strategy, layout variant, and copy.
- Use them to strengthen the rationale and visual hierarchy.
- Do not blindly follow every heuristic.
- Do not claim that a heuristic is proven performance data.
- Remain faithful to the supplied campaign.

Modern Mail heuristics:
${bullets(context.directMailHeuristics)}

${industryBlock}`
}

function industryHeuristicsFor(brief: CampaignBrief): readonly string[] {
  const playbook = findIndustryPlaybook(briefSearchText(brief))
  if (playbook !== PLAYBOOKS.plumbing) return []

  if (!brief.offer?.trim()) {
    return [...PLUMBING_CREATIVE_HEURISTICS, ...PLUMBING_OFFER_EXAMPLES_WHEN_BRIEF_HAS_NONE]
  }

  return PLUMBING_CREATIVE_HEURISTICS
}

function briefSearchText(brief: CampaignBrief): string {
  return [
    brief.goal,
    brief.audience?.description,
    brief.businessInfo?.name,
    brief.offer,
    brief.otherRequirements,
    brief.desiredRecipientAction,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
}

function bullets(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n")
}
