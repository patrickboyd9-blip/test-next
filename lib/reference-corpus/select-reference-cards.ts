import type { CampaignBrief } from "../campaign-creator/types"

import type { ReferenceCard, ReferenceCardVertical } from "./reference-card"
import { RESEARCH_TASTE_PACK, assertResearchTastePack } from "./taste-pack"

/**
 * How many non-craft cards to inject for a matched vertical.
 * One craft exemplar is added on top as a quality bar. Cap is four cards
 * so the prompt stays a baseline, not a dump of the pack.
 */
export const REFERENCE_CARD_VERTICAL_SLOTS = 3
export const REFERENCE_CARD_PROMPT_LIMIT = 4

const CRAFT_QUALITY_BAR = ["MMR-011", "MMR-013", "MMR-060"] as const

const VERTICAL_PATTERNS: Record<ReferenceCardVertical, readonly RegExp[]> = {
  hvac: [/\bhvac\b/i, /\bair condition(?:ing|er)s?\b/i, /\bheating and cooling\b/i, /\bfurnace\b/i],
  plumbing: [/\bplumb(?:er|ing|ers)?\b/i, /\bdrains?\b/i, /\bwater heaters?\b/i],
  electrical: [/\belectricians?\b/i, /\belectrical\b/i],
  roofing: [/\broof(?:er|ing|s)?\b/i],
  pest: [/\bpest(?: control)?\b/i, /\btermites?\b/i, /\bmosquito(?:es)?\b/i],
  landscaping: [/\blandscap(?:e|ing|er)s?\b/i, /\blawn\b/i],
  exterior_cleaning: [/\bpressure wash(?:ing)?\b/i, /\bsoft wash(?:ing)?\b/i, /\bpower wash(?:ing)?\b/i],
  foundation: [/\bfoundation (?:repair|crack)/i, /\bstructural repair\b/i],
  chimney: [/\bchimney\b/i, /\bdryer vent\b/i],
  dental: [/\bdental\b/i, /\bdentist\b/i, /\bdentures?\b/i],
  med_spa: [/\bmed\s*spa\b/i, /\baesthetics?\b/i, /\bfacials?\b/i],
  chiropractic: [/\bchiro(?:practic|practor)?\b/i],
  physical_therapy: [/\bphysical therapy\b/i, /\brehab\b/i],
  restaurant: [/\brestaurants?\b/i, /\bdiners?\b/i, /\btables?\b/i],
  pizza_qsr: [/\bpizza\b/i, /\bqsr\b/i],
  fitness: [/\bfitness\b/i, /\bgyms?\b/i],
  jewelry: [/\bjewel(?:ry|er)?\b/i],
  remodeling: [/\bremodel(?:ing|er)?\b/i],
}

const SIBLING_RANK: Partial<
  Record<ReferenceCardVertical, readonly ReferenceCardVertical[]>
> = {
  roofing: ["hvac", "plumbing", "electrical", "pest", "foundation"],
  hvac: ["plumbing", "electrical", "roofing", "chimney"],
  plumbing: ["hvac", "electrical", "roofing", "foundation"],
  electrical: ["hvac", "plumbing", "roofing"],
  pest: ["roofing", "landscaping", "hvac", "exterior_cleaning"],
  landscaping: ["exterior_cleaning", "pest", "roofing"],
  exterior_cleaning: ["landscaping", "roofing", "pest"],
  foundation: ["roofing", "plumbing"],
  chimney: ["roofing", "hvac"],
  dental: ["med_spa", "chiropractic", "physical_therapy"],
  med_spa: ["dental", "chiropractic", "physical_therapy"],
  chiropractic: ["physical_therapy", "dental", "med_spa"],
  physical_therapy: ["chiropractic", "dental", "med_spa"],
  restaurant: ["pizza_qsr"],
  pizza_qsr: ["restaurant"],
}

export type ReferenceCardMatch = "vertical" | "craft_only"

export interface ReferenceCardSelection {
  cards: readonly ReferenceCard[]
  match: ReferenceCardMatch
}

let packReady = false

function tastePack(): readonly ReferenceCard[] {
  if (!packReady) {
    assertResearchTastePack(RESEARCH_TASTE_PACK)
    packReady = true
  }
  return RESEARCH_TASTE_PACK
}

export function selectReferenceCards(
  brief: CampaignBrief,
  pack: readonly ReferenceCard[] = tastePack()
): ReferenceCardSelection {
  const matched = matchedVerticals(briefSearchText(brief))
  const exact = pack.filter((card) => matched.includes(card.vertical))
  const nonCraftExact = exact.filter((card) => card.packGroup !== "craft_exemplar")
  const craftExact = exact.filter((card) => card.packGroup === "craft_exemplar")
  const groups = new Set(nonCraftExact.map((card) => card.packGroup))

  const selected: ReferenceCard[] = []
  for (const card of nonCraftExact) {
    if (selected.length >= REFERENCE_CARD_VERTICAL_SLOTS) break
    selected.push(card)
  }

  const siblings = pack
    .filter(
      (card) =>
        card.packGroup !== "craft_exemplar" &&
        groups.has(card.packGroup) &&
        !selected.some((chosen) => chosen.mmrId === card.mmrId)
    )
    .sort((a, b) => siblingSortKey(a, matched, pack) - siblingSortKey(b, matched, pack))

  for (const card of siblings) {
    if (selected.length >= REFERENCE_CARD_VERTICAL_SLOTS) break
    selected.push(card)
  }

  for (const card of craftExact) {
    if (selected.length >= REFERENCE_CARD_PROMPT_LIMIT) break
    if (!selected.some((chosen) => chosen.mmrId === card.mmrId)) {
      selected.push(card)
    }
  }

  const nonCraftCount = selected.filter((card) => card.packGroup !== "craft_exemplar").length
  const craftCount = selected.filter((card) => card.packGroup === "craft_exemplar").length
  const wantCraft = nonCraftCount === 0 ? 2 : 1
  if (craftCount < wantCraft) {
    selected.push(...takeCraft(pack, selected, wantCraft - craftCount))
  }

  const cards = selected.slice(0, REFERENCE_CARD_PROMPT_LIMIT)
  return {
    cards,
    match: nonCraftCount === 0 && craftExact.length === 0 ? "craft_only" : "vertical",
  }
}

export function formatReferenceCardSection(
  cards: readonly ReferenceCard[],
  match: ReferenceCardMatch
): string {
  const intro =
    match === "craft_only"
      ? "No researched card matched this vertical. The cards below are general craft exemplars. Do not pretend they are this industry's specimens."
      : "These cards matched the campaign's vertical or a closely related one. Related-trade cards are patterns, not permission to change the customer's trade."

  const blocks = cards.map(formatReferenceCard).join("\n\n")

  return `Researched taste cards — a quality baseline from live mailers. Not a template. Not a brand to copy.

${intro}

How to use these cards:
- Imitate the craft: one interrupt, a clear hierarchy, an honest image job, and one response path.
- Do not copy slogans, logos, layouts, trademarks, or artwork.
- Do not treat a card as measured performance. Do not claim bookings, lift, or return on spend.
- Do not make every direction a copy of the same card.
- These cards do not choose the mail piece, the canvas, or a vendor option.
- These cards are not customer art. A stand-in shelf, including Pexels, is not the campaign photograph. Conceive an original situation. That shelf is only a labeled placeholder when a photograph cannot be made.
- Do not spend money, print, or submit a mail job from this guidance.

${blocks}`
}

function formatReferenceCard(card: ReferenceCard): string {
  const dimensions = card.dimensions ?? "unknown"
  const principles = card.principles.map((principle) => `  - ${principle}`).join("\n")
  return `- [${card.mmrId}] vertical=${card.vertical} format=${card.format} dimensions=${dimensions} confidence=${card.confidence}
  Principles:
${principles}
  Composition: ${card.compositionNotes}
  Imagery: ${card.imageryNotes}
  CTA: ${card.ctaNotes}
  Why this pattern works: ${card.whyItWorks}`
}

export function referenceVerticalsForBrief(
  brief: CampaignBrief
): ReferenceCardVertical[] {
  return matchedVerticals(briefSearchText(brief))
}

function matchedVerticals(text: string): ReferenceCardVertical[] {
  return (Object.keys(VERTICAL_PATTERNS) as ReferenceCardVertical[]).filter(
    (vertical) => VERTICAL_PATTERNS[vertical].some((pattern) => pattern.test(text))
  )
}

function siblingSortKey(
  card: ReferenceCard,
  matched: readonly ReferenceCardVertical[],
  pack: readonly ReferenceCard[]
): number {
  let best = 100
  for (const vertical of matched) {
    const order = SIBLING_RANK[vertical] ?? []
    const index = order.indexOf(card.vertical)
    if (index >= 0) best = Math.min(best, index)
  }
  const packIndex = pack.findIndex((item) => item.mmrId === card.mmrId)
  return best * 100 + (packIndex < 0 ? 99 : packIndex)
}

function takeCraft(
  pack: readonly ReferenceCard[],
  already: readonly ReferenceCard[],
  count: number
): ReferenceCard[] {
  const chosen: ReferenceCard[] = []
  for (const id of CRAFT_QUALITY_BAR) {
    if (chosen.length >= count) break
    if (already.some((card) => card.mmrId === id)) continue
    const card = pack.find((item) => item.mmrId === id)
    if (!card) continue
    chosen.push(card)
  }
  return chosen
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
