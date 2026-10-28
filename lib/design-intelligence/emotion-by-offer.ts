import type { CampaignBrief } from "@/lib/campaign-creator/types"
import table from "./emotion-by-offer.json"

type Combo = { headline: string; offer: string; photo: string }
type Row = { offer: string; emotion: string; photo: string; avoid: string; combos: Combo[] }
const PLAYBOOK = table as Record<string, Row[]>

const INDUSTRY: Array<[string, RegExp]> = [
  ["solar", /\bsolar\b/i],
  ["hvac", /\bhvac\b|\bfurnace|\bair condition|\bheat pump|\b(?:a\/c|ac)\b/i],
  ["plumbing", /\bplumb|\bwater heater|\bdrain|\bpipe|\bsewer/i],
  ["windows-gutters-siding", /\bwindows?\b|\bgutters?\b|\bsiding\b/i],
  ["roofing", /\broof|\bshingle/i],
]

const OFFER: Array<[string, RegExp]> = [
  ["dollar_off", /\$\s?\d[\d,]*\s*off\b/i],
  ["percent_off", /\d+%\s*off\b|\bdiscount\b/i],
  ["financing", /\bfinanc|\bAPR\b/i],
  ["free_inspection", /\bfree\b.*\b(?:inspection|check|estimate|assessment|quote)\b/i],
  ["seasonal", /\bseason|\bwinter|\bsummer|\bstorm|\bhurricane/i],
]

/** Emotion and photo guidance from the Ad Psych playbook for this brief's trade and offer. Empty when nothing matches. */
export function emotionByOfferGuidance(brief: CampaignBrief): string {
  const b = brief as unknown as Record<string, unknown>
  const text = [b.offer, b.goal, b.industry, b.services, (b.businessInfo as Record<string, unknown> | undefined)?.name]
    .filter((v) => typeof v === "string").join(" ")
  const industry = INDUSTRY.find(([, re]) => re.test(text))?.[0]
  const rows = industry ? PLAYBOOK[industry] : undefined
  if (!rows?.length) return ""
  const offerText = typeof b.offer === "string" ? b.offer : ""
  const kind = OFFER.find(([, re]) => re.test(offerText))?.[0]
  const row = rows.find((r) => kind && r.offer.includes(kind)) ?? rows.find((r) => r.offer.includes("dollar_off")) ?? rows[0]!
  const combos = row.combos.map((c) => `  - "${c.headline}" / ${c.offer} / photo: ${c.photo}`).join("\n")
  return `
Emotion by offer (patterns only, write new lines):
- Lead emotion: ${row.emotion}
- Photo that reinforces it: ${row.photo}
- What backfires: ${row.avoid}
${combos ? `- Example headline / offer / photo combos:\n${combos}` : ""}`
}
