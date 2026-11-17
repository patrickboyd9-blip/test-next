/**
 * Offer-specific sublines. "Call today." says nothing; the subline should sell
 * the outcome of this offer, taken from the trade's playbook when it has one.
 */
import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { hasBlockedClaim } from "@/lib/research-library/compliance"
import { industryForBrief } from "@/lib/research-library/industry"

import { offerRowFor, playbookFor } from "./playbooks"

const FILLER = /^(?:call (?:us )?(?:today|now)|call to book|act now|don'?t wait|limited time(?: only)?|book (?:today|now)|schedule (?:today|now)|contact us(?: today)?)[.!]*$/i
/** A sentence that only says "call / book / schedule ... today". */
const FILLER_SENTENCE = /^(?:(?:please\s+)?(?:call|phone|book|schedule|contact|reach)\b[^.!?]{0,60}\b(?:today|now|right away)|act now|don'?t wait|limited time(?: only)?)[.!]*$/i

export function isFillerSubline(line: string | undefined | null): boolean {
  const trimmed = (line ?? "").trim()
  return !trimmed || FILLER.test(trimmed) || FILLER_SENTENCE.test(trimmed) || /^call (?:us )?(?:today|now)\b/i.test(trimmed)
}

/** Drops "Call today." style sentences from a line. Returns "" when nothing else is left. */
export function stripFillerSentences(line: string | undefined | null): string {
  const text = (line ?? "").replace(/\s+/g, " ").trim()
  if (!text) return ""
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text]
  const kept = sentences.map((part) => part.trim()).filter((part) => part && !FILLER_SENTENCE.test(part) && !FILLER.test(part))
  return kept.join(" ").trim()
}

/** What an offer is about. A subline that names a different subject (drain offer, water-heater line) does not match. */
const SUBJECTS: Array<{ id: string; re: RegExp }> = [
  { id: "water-heater", re: /\b(?:water heater|tankless|hot water|hot showers?|showers?)\b/i },
  { id: "drain", re: /\b(?:drains?|clogs?|sewer|rooter|hydro-?jet)/i },
  { id: "leak", re: /\b(?:leaks?|slab|repipe|pipes?)\b/i },
  { id: "termite", re: /\btermites?\b|\bwood that holds\b/i },
  { id: "rodent", re: /\b(?:rodents?|mice|mouse|rats?)\b/i },
  { id: "mosquito", re: /\b(?:mosquito(?:es)?|ticks?|backyard)\b/i },
  { id: "implant", re: /\bimplants?\b/i },
  { id: "aligner", re: /\b(?:aligners?|invisalign|braces|straighter)\b/i },
  { id: "whitening", re: /\bwhiten/i },
  { id: "ac", re: /\b(?:a\/c|air condition|cooling|furnace|heat pump)\b/i },
]

function subjectsOf(text: string): Set<string> {
  return new Set(SUBJECTS.filter((s) => s.re.test(text)).map((s) => s.id))
}

/** True when the line names a subject the offer does not. */
export function sublineMismatchesOffer(line: string, offer: string): boolean {
  const offerSubjects = subjectsOf(offer)
  for (const id of subjectsOf(line)) if (!offerSubjects.has(id)) return true
  return false
}

/** Trade defaults when the playbook has no outcome line that fits. Keyed by offer words. */
const DEFAULTS: Array<{ trade: string; when: RegExp; line: string }> = [
  { trade: "plumbing", when: /tankless|water heater|hot water/i, line: "Hot showers again, installed and hauled away the same day." },
  { trade: "plumbing", when: /drain|sewer|clog/i, line: "Drains that run clear, with the price set before we start." },
  { trade: "plumbing", when: /./, line: "Upfront pricing and a licensed plumber at your door." },
  { trade: "dental", when: /implant/i, line: "A confident smile that eats, talks and laughs like your own." },
  { trade: "dental", when: /aligner|invisalign|ortho/i, line: "Straighter teeth without metal braces." },
  { trade: "dental", when: /new patient|exam|cleaning|x-?ray/i, line: "Exam, cleaning and X-rays in one easy first visit." },
  { trade: "dental", when: /./, line: "A gentle team that makes the chair feel easy." },
  { trade: "real-estate-agents", when: /valu|worth|cma/i, line: "A real number for your home, from an agent who knows your street." },
  { trade: "real-estate-agents", when: /list|sell|staging|clean/i, line: "Get your home market-ready and sold for top dollar." },
  { trade: "real-estate-agents", when: /./, line: "Local know-how from first showing to closing day." },
  { trade: "pest-control", when: /termite/i, line: "Protect the wood that holds your home up." },
  { trade: "pest-control", when: /rodent|mice|mouse|rat/i, line: "Quiet nights and a sealed-up home." },
  { trade: "pest-control", when: /mosquito|tick/i, line: "Take the backyard back this summer." },
  { trade: "pest-control", when: /./, line: "Fewer pests, and we come back free if they return between visits." },
  { trade: "hvac", when: /./, line: "Steady comfort in every room, from a tech who explains the fix." },
  { trade: "*", when: /./, line: "Local, licensed and on your schedule." },
]

function hash(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h
}

/**
 * One outcome subline for this brief and offer. `seed` rotates the choice across
 * the directions of one campaign so they don't all repeat the same line.
 */
export function offerSubline(input: { brief: CampaignBrief; offer?: string; headline?: string; seed?: number }): string {
  const offer = `${input.offer ?? input.brief.offer ?? ""}`
  const industry = industryForBrief(input.brief)
  const playbook = playbookFor(industry)
  const candidates: string[] = []
  if (playbook) {
    const row = offerRowFor(playbook, `${offer} ${input.brief.goal ?? ""}`)
    for (const combo of row.combos ?? []) if (combo.sell_the_outcome_line) candidates.push(combo.sell_the_outcome_line)
  }
  const own = DEFAULTS.filter((d) => (d.trade === industry || d.trade === "*") && d.when.test(offer))
  const usable = (line: string) =>
    line.length <= 70 &&
    !hasBlockedClaim(line, industry) &&
    line.toLowerCase() !== (input.headline ?? "").toLowerCase() &&
    !/\[x\]|\$\[/i.test(line) &&
    !isFillerSubline(line) &&
    !sublineMismatchesOffer(line, offer)
  // Specific trade defaults that name the offer beat a generic playbook line.
  const specific = own.filter((d) => d.when.source !== ".").map((d) => d.line).filter(usable)
  const pool = [...specific, ...candidates.filter(usable)]
  if (pool.length) {
    const seed = input.seed ?? hash(`${input.brief.businessInfo?.name ?? ""}${offer}`)
    return pool[seed % pool.length]!
  }
  return own.map((d) => d.line).find(usable) ?? "Local, licensed and on your schedule."
}

/**
 * Final copy pass for a trade card: no "Call today" filler in the headline or
 * subline, and a subline that matches this offer (a drain offer never gets the
 * water-heater line). `fallbackHeadline` is used only when the headline was all filler.
 */
export function polishTradeCopy<T extends { headline?: string; subheadline?: string; offer?: string }>(input: {
  brief: CampaignBrief
  spec: T
  seed?: number
  fallbackHeadline: () => string
}): T {
  const offer = input.spec.offer ?? input.brief.offer ?? ""
  let headline = stripFillerSentences(input.spec.headline)
  if (!headline) headline = input.fallbackHeadline()
  let sub = stripFillerSentences(input.spec.subheadline)
  if (isFillerSubline(sub) || sublineMismatchesOffer(sub, offer) || sub.toLowerCase() === headline.toLowerCase()) {
    sub = offerSubline({ brief: input.brief, offer, headline, seed: input.seed })
  }
  return { ...input.spec, headline, subheadline: sub }
}
