/**
 * The 28 gold file names are the only industries a brief or a mailer can have.
 * `gold/<slug>.json` is the master list. Anything else is "none".
 * HVAC is decided before roofing and plumbing. Windows, gutters, and siding
 * are not roofing. Insurance splits into Medicare, auto, home, and life.
 */

import type { CampaignBrief } from "@/lib/campaign-creator/types"

export const GOLD_INDUSTRIES = [
  "auto-insurance",
  "auto",
  "churches-community",
  "cleaning-pressure-washing",
  "dental",
  "gyms-fitness",
  "home-buying",
  "home-insurance",
  "home-remodeling",
  "home-security",
  "hvac",
  "junk-removal",
  "landscaping",
  "life-insurance",
  "med-spa-chiro",
  "medicare",
  "mortgage-financial",
  "moving-storage",
  "pest-control",
  "plumbing",
  "real-estate-agents",
  "restaurants-food",
  "retail-grand-openings",
  "roofing",
  "solar",
  "tutoring-childcare",
  "vet-pet",
  "windows-gutters-siding",
] as const

export type GoldIndustry = (typeof GOLD_INDUSTRIES)[number]

export const NONE_INDUSTRY = "none"

const GOLD_SET = new Set<string>(GOLD_INDUSTRIES)

const GROUPS: readonly (readonly string[])[] = [
  ["roofing", "hvac", "plumbing", "windows-gutters-siding", "solar", "pest-control", "landscaping", "junk-removal", "cleaning-pressure-washing", "home-remodeling", "home-security"],
  ["auto-insurance", "home-insurance", "life-insurance"],
  ["medicare", "dental", "med-spa-chiro"],
  ["auto", "auto-insurance"],
  ["real-estate-agents", "home-buying", "mortgage-financial", "home-insurance"],
  ["restaurants-food", "retail-grand-openings"],
  ["churches-community", "tutoring-childcare", "gyms-fitness", "moving-storage"],
  ["vet-pet"],
]

const NEIGHBOR_ORDER: Record<string, readonly string[]> = {
  "auto-insurance": ["home-insurance", "life-insurance", "hvac", "plumbing", "roofing"],
  "home-insurance": ["auto-insurance", "life-insurance", "real-estate-agents", "hvac"],
  "life-insurance": ["home-insurance", "auto-insurance"],
}

export function isGoldIndustry(value: string | undefined | null): value is GoldIndustry {
  return Boolean(value && GOLD_SET.has(value))
}

export function neighborRank(queryIndustry: string, entryIndustry: string): number {
  const order = NEIGHBOR_ORDER[normalizeIndustry(queryIndustry)]
  if (!order) return 0
  const index = order.indexOf(normalizeIndustry(entryIndustry))
  return index >= 0 ? index + 1 : 0
}

/**
 * Map a label, a gold slug, or a short brief onto one gold industry.
 * An unrecognized label is "none", not a free-text slug no brief can ask for.
 */
export function normalizeIndustry(value: string | undefined | null): string {
  return classify(value ?? "", "label")
}

export function industryFromGoldPath(filePath: string | undefined | null): string | null {
  const match = (filePath ?? "").match(/(?:^|\/)gold\/([a-z0-9-]+)\.json$/i)
  if (!match) return null
  const slug = match[1]!.toLowerCase()
  if (GOLD_SET.has(slug)) return slug
  const classified = classify(slug.replace(/-/g, " "), "label")
  return classified === NONE_INDUSTRY ? null : classified
}

export function resolveIndustry(input: {
  explicit?: string | null
  path?: string | null
  notes?: string | null
}): string {
  const fromGold = industryFromGoldPath(input.path)
  if (fromGold) return fromGold
  const explicit = meaningfulLabel(input.explicit)
  const fromExplicit = explicit ? classify(explicit, "label") : NONE_INDUSTRY
  const fromNotes = classify(input.notes ?? "", "notes")
  if (fromExplicit === "plumbing" && fromNotes === "hvac") return "hvac"
  if (fromExplicit !== NONE_INDUSTRY) return fromExplicit
  const fromPath = classify(pathWords(input.path ?? ""), "label")
  if (fromPath !== NONE_INDUSTRY) return fromPath
  return fromNotes
}

export function industryForBrief(brief: CampaignBrief, extra = ""): string {
  const text = [
    brief.goal,
    brief.offer,
    brief.audience?.description,
    brief.businessInfo?.name,
    brief.emotionalTone,
    brief.otherRequirements,
    brief.desiredRecipientAction,
    extra,
  ].filter((value): value is string => Boolean(value?.trim())).join(" ")
  return classify(text, "label")
}

export function industriesAdjacent(left: string, right: string): boolean {
  const a = normalizeIndustry(left)
  const b = normalizeIndustry(right)
  if (!a || !b || a === b || a === NONE_INDUSTRY || b === NONE_INDUSTRY) return false
  if (medicareBlocked(a, b)) return false
  if (neighborRank(a, b) > 0 || neighborRank(b, a) > 0) return true
  return GROUPS.some((group) => group.includes(a) && group.includes(b))
}

function medicareBlocked(left: string, right: string): boolean {
  const pair = new Set([left, right])
  if (!pair.has("medicare")) return false
  return pair.has("auto-insurance") || pair.has("home-insurance") || pair.has("life-insurance")
}

function meaningfulLabel(value: string | null | undefined): string {
  const text = soften(value ?? "")
  if (!text) return ""
  if (/^(?:unknown|none|n a|na|other|general|unspecified|not stated|home services|general local service)$/.test(text)) return ""
  return value!.trim()
}

function pathWords(filePath: string): string {
  return filePath
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_./-]+/g, " ")
    .replace(/\b(?:gold|examples|assets|physical|notes|provenance|json|md|txt)\b/gi, " ")
}

type ClassifyMode = "label" | "notes"

function classify(value: string, mode: ClassifyMode): string {
  const text = soften(value)
  if (!text) return NONE_INDUSTRY
  if (mode === "label") {
    const slug = exactSlug(text)
    if (slug) return slug
  }
  if (medicareSignal(text, mode)) return "medicare"
  if (/\bauto insurance\b|\bcar insurance\b|\bvehicle insurance\b/.test(text)) return "auto-insurance"
  // Life is named on purpose. "Life insurance for homeowners" is not a home policy.
  if (/\blife insurance\b|\bfinal expense\b|\bburial insurance\b/.test(text)) return "life-insurance"
  if (/\bhomeowners?\b|\bhome owner\b/.test(text) && /\binsurance\b/.test(text)) return "home-insurance"
  if (/\bhome insurance\b/.test(text)) return "home-insurance"
  if (hvacSignal(text, mode)) return "hvac"
  if (windowSignal(text, mode)) return "windows-gutters-siding"
  if (plumbingSignal(text)) return "plumbing"
  if (/\bpest\b|\btermite\b|\bmosquito\b|\btick\b/.test(text)) return "pest-control"
  if (/\blandscap|\blawn\b|\byard\b/.test(text) && !/\bjunk\b/.test(text)) return "landscaping"
  if (/\bsolar\b/.test(text)) return "solar"
  if (/\broof\b|\broofs\b|\broofing\b|\broofer\b|\bshingles?\b/.test(text)) return "roofing"
  if (/\bdental\b|\bdentist\b|\bdentures?\b/.test(text)) return "dental"
  if (/\bmed spa\b|\bmedspa\b|\bchiro\b|\bbotox\b|\baesthetic\b/.test(text)) return "med-spa-chiro"
  if (vetSignal(text, mode)) return "vet-pet"
  if (restaurantSignal(text)) return "restaurants-food"
  if (/\bgym\b|\bfitness\b|\byoga\b/.test(text)) return "gyms-fitness"
  if (cleaningSignal(text, mode)) return "cleaning-pressure-washing"
  if (/\bjunk\b|\bhaul away\b|\bhauling\b/.test(text)) return "junk-removal"
  if (/\bmovers?\b|\bmoving company\b|\bstorage unit\b|\bself storage\b/.test(text)) return "moving-storage"
  if (/\bhome security\b|\balarm\b|\bsecurity system\b/.test(text)) return "home-security"
  if (/\bremodel|\brenovat|\bkitchen remodel\b|\bbathroom remodel\b/.test(text)) return "home-remodeling"
  if (/\bwe buy\b|\bcash offer\b|\bhome buying\b|\bbuy your house\b|\bsell your house\b/.test(text)) return "home-buying"
  if (realEstateSignal(text, mode)) return "real-estate-agents"
  if (mortgageSignal(text, mode)) return "mortgage-financial"
  if (/\bchurch\b|\bcongregation\b|\bnonprofit\b|\bcommunity center\b/.test(text)) return "churches-community"
  if (/\btutors?\b|\btutoring\b|\bchildcare\b|\bchild care\b|\bdaycare\b|\bday care\b|\bpreschool\b|\bafter school\b|\bhomework\b|\blearning center\b/.test(text)) return "tutoring-childcare"
  if (autoSignal(text)) return "auto"
  if (retailSignal(text, mode)) return "retail-grand-openings"
  return NONE_INDUSTRY
}

/**
 * A long note that only mentions Medicare in a disclaimer is not a Medicare mailer.
 * Short labels and real plan language still are.
 */
function medicareSignal(text: string, mode: ClassifyMode): boolean {
  const cleaned = text
    .replace(/\bnot affiliated with (?:medicare|medicaid|cms)\b/g, " ")
    .replace(/\bnot (?:a )?medicare\b/g, " ")
  if (!/\bmedicare\b|\bmedicaid\b|\bmedigap\b/.test(cleaned)) return false
  if (mode === "label" || cleaned.split(" ").length <= 32) return true
  return /\bmedicare\b/.test(cleaned) && /\b(?:advantage|supplement|plan|enrollment|medigap|senior|aep)\b/.test(cleaned)
}

function restaurantSignal(text: string): boolean {
  if (/\brestaurant\b|\bdining\b|\bpizza\b|\bqsr\b|\bgrocery\b|\bmenu\b/.test(text)) return true
  return /\bdairy queen\b|\bmcdonald|\bburger king\b|\btaco bell\b|\bwendy\b|\bdomino|\bpizza hut\b|\bchipotle\b|\bstarbucks\b|\bdunkin\b|\bkfc\b/.test(text)
}

function realEstateSignal(text: string, mode: ClassifyMode): boolean {
  if (/\breal estate\b|\brealtor\b|\bopen house\b/.test(text)) return true
  if (/\b(?:home|house)\s+listing\b/.test(text)) return true
  return mode === "label" && /\blisting\b/.test(text)
}

function mortgageSignal(text: string, mode: ClassifyMode): boolean {
  if (/\bmortgage\b|\bcredit union\b|\brefinance\b/.test(text)) return true
  if (/\b(?:home|house)\s+loans?\b/.test(text)) return true
  return mode === "label" && /\bdebt\b|\bbank\b|\bfinancial\b|\bloan\b/.test(text)
}

function retailSignal(text: string, mode: ClassifyMode): boolean {
  if (/\bgrand opening\b|\bretail\b/.test(text)) return true
  if (!/\bstore\b|\bshop\b/.test(text)) return false
  if (mode === "label") return true
  return text.split(" ").length <= 24
}

function hvacSignal(text: string, mode: ClassifyMode): boolean {
  if (/\bseptic\b|\bwater treatment\b|\bwater softener\b|\bsoftener\b/.test(text)) return false
  if (/\bhvac\b|\bair condition|\bfurnace\b|\bheat pump\b/.test(text)) return true
  if (/heating and air|heating and cooling|heat and air/.test(text)) return true
  if (/\bplumb/.test(text) && /\bair\b/.test(text)) return true
  if (/\bac\b/.test(text)) return true
  if (mode === "label" && /\bheating\b/.test(text) && /\bcooling\b/.test(text)) return true
  return false
}

function windowSignal(text: string, mode: ClassifyMode): boolean {
  if (/\bgutters?\b|\bsiding\b/.test(text)) return true
  if (/\bwindow replacement\b|\bvinyl windows?\b|\breplacement windows?\b/.test(text)) return true
  if (/\bwindows?\s+and\s+doors?\b|\bdoors?\s+and\s+windows?\b/.test(text)) return true
  if (mode === "label" && /\bwindows?\b/.test(text)) return true
  if (mode === "notes" && /\b(?:new|replacement|vinyl)\s+windows\b/.test(text)) return true
  return false
}

function plumbingSignal(text: string): boolean {
  return /\bplumb|\bdrains?\b|\bwater heaters?\b|\bseptic\b|\bwater treatment\b|\bwater softener\b|\bsoftener\b|\bsewer\b/.test(text)
}

function vetSignal(text: string, mode: ClassifyMode): boolean {
  if (/\bpet insurance\b|\bveterinar|\bvets?\b|\bkennel\b/.test(text)) return true
  if (mode === "label" && /\bpets?\b|\bdogs?\b|\bcats?\b/.test(text)) return true
  return false
}

function cleaningSignal(text: string, mode: ClassifyMode): boolean {
  if (/\bpressure wash|\bpower wash|\bsoft wash|\bmaid\b|\bcarpet clean/.test(text)) return true
  if (mode === "label" && /\bcleaning\b/.test(text)) return true
  return false
}

function autoSignal(text: string): boolean {
  return /\bcar wash\b|\bdealership\b|\btires?\b|\boil change\b|\bauto repair\b|\bmechanic\b|\bcollision\b|\bbody shop\b/.test(text)
}

const PATH_NOISE = new Set(["gold", "json", "md", "txt", "examples", "assets", "physical", "notes", "provenance"])

function exactSlug(text: string): string | null {
  const words = text.split(" ").filter((word) => word && !PATH_NOISE.has(word))
  if (words.length === 0 || words.length > 5) return null
  const joined = words.join("-")
  return GOLD_SET.has(joined) ? joined : null
}

function soften(value: string): string {
  return value
    .toLowerCase()
    .replace(/\ba\s*\/\s*c\b/g, " ac ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function researchOfferType(text: string): string {
  const value = text.toLowerCase()
  if (/inspect|estimate|\bquote\b/.test(value)) return "inspection"
  if (/financ|per month|monthly|\/mo\b/.test(value)) return "financing"
  if (/%|percent|\boff\b|discount|coupon|\bsave\b/.test(value)) return "discount"
  if (/\bfree\b/.test(value)) return "free_offer"
  if (/tune-?up|maintenance|service plan/.test(value)) return "maintenance"
  return "other"
}

export function researchEmotion(text: string): string {
  const value = text.toLowerCase()
  if (/fear|urgent|storm|worry|threat|anxiety/.test(value)) return "urgency"
  if (/calm|trust|reassur|steady/.test(value)) return "calm"
  if (/pride|local|neighbor/.test(value)) return "pride"
  if (/joy|playful|fun|delight/.test(value)) return "joy"
  if (/relief|safe|peace|comfort/.test(value)) return "relief"
  return "unspecified"
}
