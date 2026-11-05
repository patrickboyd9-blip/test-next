/**
 * Offer-specific sublines. "Call today." says nothing; the subline should sell
 * the outcome of this offer, taken from the trade's playbook when it has one.
 */
import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { hasBlockedClaim } from "@/lib/research-library/compliance"
import { industryForBrief } from "@/lib/research-library/industry"

import { offerRowFor, playbookFor } from "./playbooks"

const FILLER = /^(?:call (?:us )?(?:today|now)|call to book|act now|don'?t wait|limited time(?: only)?|book (?:today|now)|schedule (?:today|now)|contact us(?: today)?)[.!]*$/i

export function isFillerSubline(line: string | undefined | null): boolean {
  const trimmed = (line ?? "").trim()
  return !trimmed || FILLER.test(trimmed)
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
  { trade: "real-estate-agents", when: /valu|worth|cma/i, line: "Know your number before you decide anything." },
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
    line.length <= 70 && !hasBlockedClaim(line, industry) && line.toLowerCase() !== (input.headline ?? "").toLowerCase() && !/\[x\]|\$\[/i.test(line)
  // Specific trade defaults that name the offer beat a generic playbook line.
  const specific = own.filter((d) => d.when.source !== ".").map((d) => d.line).filter(usable)
  const pool = [...specific, ...candidates.filter(usable)]
  if (pool.length) {
    const seed = input.seed ?? hash(`${input.brief.businessInfo?.name ?? ""}${offer}`)
    return pool[seed % pool.length]!
  }
  return own.map((d) => d.line).find(usable) ?? "Local, licensed and on your schedule."
}
