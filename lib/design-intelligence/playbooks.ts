/**
 * Ad Psychologist playbooks, one per gold industry. Loaded generically from
 * ./playbooks (synced by scripts/sync-playbooks.ts), never a hand-kept list.
 */
import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { industryForBrief, NONE_INDUSTRY } from "@/lib/research-library/industry"

import { PLAYBOOKS } from "./playbooks/index"
import type { Playbook, PlaybookOfferRow } from "./playbook-types"

export type { Playbook, PlaybookOfferRow } from "./playbook-types"

export const PLAYBOOK_SLUGS: readonly string[] = Object.keys(PLAYBOOKS).sort()

/**
 * App vertical / trade / persuasion slugs that are not gold slugs themselves.
 * Gold slugs ("dental", "pest-control", ...) map to themselves.
 */
export const VERTICAL_TO_PLAYBOOK: Record<string, string> = {
  real_estate: "real-estate-agents",
  realtor: "real-estate-agents",
  "real-estate": "real-estate-agents",
  pest: "pest-control",
  medicare_insurance: "medicare",
  medicare_insurance_agent: "medicare",
  final_expense: "life-insurance",
  life_insurance: "life-insurance",
  auto_insurance: "auto-insurance",
  home_insurance: "home-insurance",
  insurance: "home-insurance",
  mortgage: "mortgage-financial",
  cash_buyer: "home-buying",
  we_buy_houses: "home-buying",
  remodeling: "home-remodeling",
  remodel: "home-remodeling",
  windows: "windows-gutters-siding",
  gutters: "windows-gutters-siding",
  siding: "windows-gutters-siding",
  cleaning: "cleaning-pressure-washing",
  pressure_washing: "cleaning-pressure-washing",
  moving: "moving-storage",
  movers: "moving-storage",
  garage_door: "garage-doors",
  garage_doors: "garage-doors",
  gym: "gyms-fitness",
  fitness: "gyms-fitness",
  salon: "hair-salon",
  hair_salon: "hair-salon",
  med_spa: "med-spa-chiro",
  chiropractor: "med-spa-chiro",
  vet: "vet-pet",
  veterinary: "vet-pet",
  pet: "vet-pet",
  tutoring: "tutoring-childcare",
  childcare: "tutoring-childcare",
  church: "churches-community",
  nonprofit: "churches-community",
  restaurant: "restaurants-food",
  food: "restaurants-food",
  retail: "retail-grand-openings",
  grand_opening: "retail-grand-openings",
  auto_repair: "auto",
  auto_dealer: "auto",
  body_shop: "auto",
  security: "home-security",
  junk: "junk-removal",
  eye_care: "optometry",
  gold_buyer: "precious-metals",
  precious_metals: "precious-metals",
}

export function playbookSlugFor(slug: string | undefined | null): string | null {
  if (!slug) return null
  const key = slug.trim().toLowerCase()
  if (PLAYBOOKS[key]) return key
  const mapped = VERTICAL_TO_PLAYBOOK[key] ?? VERTICAL_TO_PLAYBOOK[key.replace(/-/g, "_")]
  if (mapped && PLAYBOOKS[mapped]) return mapped
  const dashed = key.replace(/_/g, "-")
  return PLAYBOOKS[dashed] ? dashed : null
}

export function playbookFor(slug: string | undefined | null): Playbook | null {
  const resolved = playbookSlugFor(slug)
  return resolved ? PLAYBOOKS[resolved]! : null
}

export function playbookSlugForBrief(brief: CampaignBrief): string | null {
  const industry = industryForBrief(brief)
  return industry === NONE_INDUSTRY ? null : playbookSlugFor(industry)
}

export function playbookForBrief(brief: CampaignBrief): Playbook | null {
  const slug = playbookSlugForBrief(brief)
  return slug ? PLAYBOOKS[slug]! : null
}

/** What each offer_type word means in an offer line. Unknown words match literally. */
const TOKEN: Record<string, RegExp> = {
  dollar: /\$\s?\d/,
  percent: /\d+\s?%/,
  off: /\boff\b|\bsave\b|\bdiscount|\bcoupon/i,
  discount: /\boff\b|\bdiscount|\bsave\b|\bcoupon/i,
  coupon: /\bcoupon|\boff\b/i,
  free: /\bfree\b|\bno[- ]cost\b|\bcomplimentary\b/i,
  complimentary: /\bfree\b|\bcomplimentary\b/i,
  inspection: /\binspect/i,
  estimate: /\bestimate|\bquote|\bbid\b/i,
  quote: /\bquote|\bestimate/i,
  consult: /\bconsult/i,
  consultation: /\bconsult/i,
  assessment: /\bassess|\bevaluat|\bcheck\b/i,
  valuation: /\bvalu|\bwhat your home|\bworth\b|\bcma\b/i,
  cma: /\bvalu|\bcma\b|\bworth\b/i,
  financing: /\bfinanc|\bAPR\b|\bmonthly\b|\bpayments?\b/i,
  seasonal: /\bseason|\bwinter|\bsummer|\bspring|\bfall\b|\bautumn|\bholiday|\bback[- ]to[- ]school/i,
  season: /\bseason|\bwinter|\bsummer|\bspring|\bfall\b/i,
  storm: /\bstorm|\bhail|\bhurricane|\bwind\b/i,
  emergency: /\bemergenc|\b24\/7\b|\bsame[- ]day\b|\bburst|\bleak|\bno heat\b|\bno ac\b|\btoothache/i,
  mover: /\bnew (?:to|in) (?:the )?(?:area|neighborhood|town)|\bjust moved|\bnew mover|\bwelcome\b/i,
  new: /\bnew\b|\bfirst\b|\bwelcome\b/i,
  patient: /\bpatient|\bexam\b|\bcleaning\b|\bx-?rays?\b/i,
  first: /\bfirst\b|\bnew\b/i,
  neighbor: /\bneighbor|\byour street\b|\bnearby\b/i,
  referral: /\brefer/i,
  guarantee: /\bguarantee|\bwarrant/i,
  warranty: /\bwarrant|\bguarantee/i,
  bogo: /\bbuy one|\bbogo\b|\b2 for 1\b|\btwo for one\b/i,
  grand: /\bgrand opening\b|\bnow open\b|\bopening\b/i,
  opening: /\bopening\b|\bnow open\b/i,
  gift: /\bgift/i,
  trial: /\btrial\b|\bfree (?:week|class|visit)\b/i,
  tuneup: /\btune[- ]?up|\bmaintenance\b|\bcheck[- ]?up/i,
  maintenance: /\btune[- ]?up|\bmaintenance\b/i,
  bundle: /\bbundle|\bplus\b|\bwith\b|\badd[- ]on\b/i,
  recurring: /\bplan\b|\bquarterly|\bmonthly service|\bprogram\b|\bmembership/i,
  plan: /\bplan\b|\bmembership/i,
  membership: /\bmembership|\bplan\b/i,
  fixed: /\bflat[- ]rate|\bfixed[- ]price|\bup[- ]?front price/i,
  price: /\$\s?\d|\bprice/i,
  cash: /\bcash\b/i,
  listed: /\bjust listed|\bjust sold|\blisting/i,
  sold: /\bjust sold|\bsold\b/i,
  staging: /\bstag|\bprep\b|\bcleaning credit|\brepairs? credit/i,
  water: /\bwater\b/i,
  heater: /\bheater\b/i,
}

/** Pick the playbook row whose offer_type best fits the offer line. */
export function offerRowFor(playbook: Playbook, offer: string): PlaybookOfferRow {
  const rows = playbook.emotion_by_offer
  let best = rows[0]!
  let bestScore = 0
  for (const row of rows) {
    const words = row.offer_type.split(/[_-]+/).filter((w) => !["or", "and", "the", "a", "with", "to"].includes(w))
    let score = 0
    for (const word of words) {
      const re = TOKEN[word] ?? new RegExp(`\\b${word.replace(/[^a-z0-9]/gi, "")}`, "i")
      if (re.test(offer)) score += TOKEN[word] ? 1 : 1.5
    }
    const normalized = words.length ? score / Math.sqrt(words.length) : 0
    if (normalized > bestScore) {
      bestScore = normalized
      best = row
    }
  }
  return best
}
