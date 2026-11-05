import type { CampaignBrief } from "@/lib/campaign-creator/types"

import { offerRowFor, playbookForBrief } from "./playbooks"
import type { PlaybookOfferRow } from "./playbook-types"

export { offerRowFor, playbookForBrief } from "./playbooks"

/** The playbook row (trade + offer type) for this brief, or null when no playbook matches. */
export function emotionRowForBrief(brief: CampaignBrief): { slug: string; row: PlaybookOfferRow } | null {
  const playbook = playbookForBrief(brief)
  if (!playbook?.emotion_by_offer?.length) return null
  return { slug: playbook.slug, row: offerRowFor(playbook, `${brief.offer ?? ""} ${brief.goal ?? ""}`) }
}

/**
 * Emotion, photo, and compliance guidance from the Ad Psych playbook for this
 * brief's trade and offer type. The card writer must follow it. Empty when nothing matches.
 */
export function emotionByOfferGuidance(brief: CampaignBrief): string {
  const playbook = playbookForBrief(brief)
  if (!playbook?.emotion_by_offer?.length) return ""
  const row = offerRowFor(playbook, `${brief.offer ?? ""} ${brief.goal ?? ""}`)
  const combos = (row.combos ?? [])
    .map((c) => `  - "${c.headline}" / ${c.offer} / photo: ${c.photo_scene ?? ""}${c.sell_the_outcome_line ? ` / outcome: ${c.sell_the_outcome_line}` : ""}`)
    .join("\n")
  const avoid = (playbook.words_and_claims_to_avoid ?? []).slice(0, 14).map((w) => `  - ${w}`).join("\n")
  const flags = (row.compliance_flags ?? []).map((w) => `  - ${w}`).join("\n")
  return `
Ad Psych playbook: ${playbook.industry} (${playbook.slug}), offer type "${row.offer_type}". Follow it (patterns only, write new lines):
- Lead emotion (required): ${row.primary_emotion}
- Why: ${row.why ?? ""}
- Headline/offer patterns: ${(row.headline_offer_patterns ?? []).join("; ")}
- Photo that reinforces it: ${row.reinforcing_photo ?? ""}
- What backfires: ${row.what_backfires ?? ""}
${combos ? `- Example headline / offer / photo combos:\n${combos}\n` : ""}${flags ? `- Compliance for this offer type:\n${flags}\n` : ""}${avoid ? `- Never print these words or claims (law and the client's rules):\n${avoid}\n` : ""}- The subheadline sells the outcome of this specific offer. Never use a filler line like "Call today."`
}
