/**
 * Industry names the library can match. Gold slugs and markdown labels
 * both normalize through here. An unknown label is kept as a slug.
 */

const ALIASES: readonly [RegExp, string][] = [
  [/\broof|shingle|gutter/, "roofing"],
  [/\bhvac|air condition|furnace|heating and cooling|heating & cooling/, "hvac"],
  [/\bplumb|drain|water heater/, "plumbing"],
  [/\belectric/, "electrical"],
  [/\bsolar/, "solar"],
  [/\bpest|termite/, "pest_control"],
  [/\blandscap|lawn/, "landscaping"],
  [/\bjunk/, "junk_removal"],
  [/\bfoundation/, "foundation"],
  [/\bpaint/, "painting"],
  [/\bfloor/, "flooring"],
  [/\bwindow/, "windows"],
  [/\bauto insurance|\bcar insurance|\bvehicle insurance/, "auto_insurance"],
  [/\bhomeowners insurance\b|\bhome insurance\b/, "home_insurance"],
  [/\blife insurance/, "life_insurance"],
  [/\bmedicare|\bmedicaid/, "medicare"],
  [/\bfinal expense/, "final_expense"],
  [/\breal estate|\brealtor|\blisting/, "real_estate"],
  [/\bdental|\bdentist/, "dental"],
  [/\battorney|\blawyer|\blegal/, "legal"],
  [/\brestaurant|\bdining/, "restaurant"],
  [/\bfitness|\bgym/, "fitness"],
  [/\bmedical|\bclinic|\bdoctor|\bphysician/, "medical"],
  [/\bclean/, "cleaning"],
  [/\bmovers|\bmoving company/, "moving"],
  [/\bauto repair|\bmechanic|\bbody shop/, "auto_repair"],
  [/\binsurance/, "insurance"],
]

const GROUPS: readonly (readonly string[])[] = [
  ["roofing", "hvac", "plumbing", "electrical", "solar", "pest_control", "landscaping", "junk_removal", "foundation", "painting", "flooring", "windows", "cleaning", "moving", "home_services"],
  ["home_insurance", "life_insurance", "insurance"],
  ["auto_insurance", "auto_repair"],
  ["medicare", "dental", "medical", "final_expense"],
  ["real_estate", "roofing", "home_insurance"],
]

/** Closest neighbor first. Medicare is not a neighbor of auto, home, or life insurance. */
const NEIGHBOR_ORDER: Record<string, readonly string[]> = {
  auto_insurance: ["home_insurance", "life_insurance", "home_services", "insurance"],
  home_insurance: ["auto_insurance", "life_insurance", "home_services", "insurance"],
  life_insurance: ["home_insurance", "auto_insurance", "home_services", "insurance"],
}

export function neighborRank(queryIndustry: string, entryIndustry: string): number {
  const order = NEIGHBOR_ORDER[queryIndustry]
  if (!order) return 0
  const index = order.indexOf(entryIndustry)
  return index >= 0 ? index + 1 : 0
}

export function normalizeIndustry(value: string | undefined | null): string {
  const text = (value ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()
  if (!text) return "unknown"
  for (const [pattern, id] of ALIASES) {
    if (pattern.test(text)) return id
  }
  return text.replace(/\s+/g, "_").slice(0, 48)
}

export function industriesAdjacent(left: string, right: string): boolean {
  if (!left || !right || left === right || left === "unknown" || right === "unknown") return false
  if (medicareBlocked(left, right)) return false
  if (neighborRank(left, right) > 0 || neighborRank(right, left) > 0) return true
  return GROUPS.some((group) => group.includes(left) && group.includes(right))
}

function medicareBlocked(left: string, right: string): boolean {
  const pair = new Set([left, right])
  if (!pair.has("medicare")) return false
  return pair.has("auto_insurance") || pair.has("home_insurance") || pair.has("life_insurance")
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
