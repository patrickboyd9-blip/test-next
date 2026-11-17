import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { industryForBrief } from "@/lib/research-library/industry"

/**
 * Design reasoning for Patrick's five gold mailers.
 * Mood, hierarchy, photo and type balance, offer placement, and the back.
 * No reference wording, photos, or client details.
 */

export interface PatrickGoldCard {
  id: "PM-066" | "PM-067" | "PM-068" | "PM-069" | "PM-070"
  industries: readonly string[]
  reasoning: string
}

export const PATRICK_GOLD: readonly PatrickGoldCard[] = [
  {
    id: "PM-066",
    industries: ["auto-insurance", "home-insurance", "life-insurance"],
    reasoning:
      "Dusk photograph of a house, short type over the photo, one quote-style response. The back is a contact line, a short list of lines, and the mailing panel.",
  },
  {
    id: "PM-067",
    industries: ["auto-insurance", "home-insurance", "life-insurance"],
    reasoning:
      "Dark field with hands sheltering a small house shape. One phone-style response and a code. The offer sits under the image.",
  },
  {
    id: "PM-068",
    industries: ["home-insurance"],
    reasoning:
      "House photograph, a three-beat headline, a code, and one regional line. Use it for homeowners insurance, not for the word home or a place name by itself.",
  },
  {
    id: "PM-069",
    industries: ["medicare"],
    reasoning:
      "Calm senior-health layout, a short headline, one phone response, and a second-language line. Medicare briefs only.",
  },
  {
    id: "PM-070",
    industries: ["private-chef"],
    reasoning:
      "Three service lines, one phone, one email, and a code. Private chef, catering, events, and meal prep.",
  },
]

const DENYLIST = [
  "central ohio insurance",
  "david rosen",
  "614-861-3100",
  "1205 hill road",
  "pickerington",
  "maghen dodge",
  "225-390-9057",
  "save money, stress less",
  "serving all of louisiana",
  "medicare advocates",
  "mesquite",
  "725-234-2275",
  "medicare options made easy",
  "perry pollaci",
  "917-656-2970",
  "perrypollaci80@gmail.com",
]

export function artDirectorGoldText(): string {
  return PATRICK_GOLD.map((card) => `${card.id}: ${card.reasoning}`).join("\n")
}

export function leaksReferenceIdentity(text: string): boolean {
  const haystack = text.toLowerCase()
  return DENYLIST.some((needle) => haystack.includes(needle))
}

/** Significant-word overlap. A near copy of the reasoning should fail. */
export function tooCloseToGold(generated: string, card: PatrickGoldCard): boolean {
  const left = words(generated)
  const right = words(card.reasoning)
  if (left.size === 0 || right.size === 0) return false
  let shared = 0
  for (const word of left) if (right.has(word)) shared += 1
  return shared / right.size >= 0.55
}

export function patrickGoldForBrief(brief: CampaignBrief): PatrickGoldCard[] {
  const industry = industryForBrief(brief)
  const text = `${brief.goal ?? ""} ${brief.offer ?? ""} ${brief.audience?.description ?? ""}`.toLowerCase()
  const high = PATRICK_GOLD.filter((card) => card.industries.includes(industry))
  if (industry === "medicare") return high.filter((card) => card.id === "PM-069")
  if (high.length > 0) return high
  if (industry === "none") return []
  if (/\blouisiana\b/.test(text) && !/\bhomeowners?\b|\bhome insurance\b/.test(text)) return []
  if (industry === "home-remodeling" || industry === "roofing" || industry === "real-estate-agents") return []
  return []
}

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3)
  )
}
