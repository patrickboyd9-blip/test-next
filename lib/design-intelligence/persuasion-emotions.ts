/**
 * Emotion, core need, and audience awareness for one campaign.
 * Fear, joy, urgency, and relief are all valid. The client chooses.
 * When the client leaves the emotion open, the art director recommends one.
 */

export const CORE_NEEDS = [
  { id: "physiological", label: "physiological" },
  { id: "safety", label: "safety" },
  { id: "belonging", label: "belonging" },
  { id: "esteem", label: "esteem" },
  { id: "self_actualization", label: "self-actualization" },
] as const

export type CoreNeedId = (typeof CORE_NEEDS)[number]["id"]

export const AUDIENCE_AWARENESS = [
  { id: "cold", label: "Cold list", lead: "problem" },
  { id: "problem_aware", label: "Problem aware", lead: "problem" },
  { id: "solution_aware", label: "Solution aware", lead: "solution" },
  { id: "product_aware", label: "Product aware", lead: "product" },
  { id: "past_customer", label: "Past customer", lead: "offer" },
] as const

export type AudienceAwareness = (typeof AUDIENCE_AWARENESS)[number]["id"]
export type AwarenessLead = (typeof AUDIENCE_AWARENESS)[number]["lead"]

export interface CampaignEmotion {
  id: string
  label: string
  verticals: readonly string[]
  need: CoreNeedId
  fear: boolean
  /** Used when the client leaves the emotion open and the brief names no signal. */
  recommend?: boolean
  problem: string
  solution: string
  product: string
  signals: readonly string[]
}

export const CAMPAIGN_EMOTIONS: readonly CampaignEmotion[] = [
  { id: "roofing_fear", label: "Fear of leaks and damage", verticals: ["roofing"], need: "safety", fear: true, problem: "A small leak becomes damage.", solution: "An inspection finds the leak.", product: "The inspection is the next step.", signals: ["leak", "storm", "wind", "damage"] },
  { id: "roofing_family", label: "Love and protection of family", verticals: ["roofing"], need: "belonging", fear: false, problem: "The family lives under this roof.", solution: "A dry home starts with a look.", product: "The family roof can be checked.", signals: ["family", "kids", "children"] },
  { id: "roofing_trust", label: "Trust", verticals: ["roofing"], need: "safety", fear: false, recommend: true, problem: "Know your roofer.", solution: "A roofer can take a look.", product: "The inspection is the next step.", signals: [] },
  { id: "wbh_relief", label: "Relief", verticals: ["we_buy"], need: "safety", fear: false, recommend: true, problem: "The sale can be simple.", solution: "A direct sale is one path.", product: "The offer is the next step.", signals: [] },
  { id: "wbh_optimism", label: "Optimism", verticals: ["we_buy"], need: "self_actualization", fear: false, problem: "The next chapter can start.", solution: "A sale can open that chapter.", product: "The offer is the next step.", signals: ["fresh start", "next chapter"] },
  { id: "wbh_fear", label: "Fear of foreclosure costs", verticals: ["we_buy"], need: "safety", fear: true, problem: "Foreclosure costs keep adding up.", solution: "A sale can stop those costs.", product: "The offer is the next step.", signals: ["foreclos", "behind on"] },
  { id: "medicare_trust", label: "Trust", verticals: ["medicare"], need: "safety", fear: false, recommend: true, problem: "A plan you can check.", solution: "A local review explains the plans.", product: "The review is the next step.", signals: [] },
  { id: "medicare_calm", label: "Calm", verticals: ["medicare"], need: "safety", fear: false, problem: "The choice can be clear.", solution: "A review puts the plans in order.", product: "The review is the next step.", signals: ["calm", "clear", "plain"] },
  { id: "medicare_fear", label: "Fear of coverage gaps", verticals: ["medicare"], need: "safety", fear: true, problem: "A coverage gap costs more.", solution: "A review can show the gap.", product: "The review is the next step.", signals: ["gap", "uncovered", "lose coverage"] },
  { id: "coupon_joy", label: "Joy", verticals: ["food", "retail"], need: "belonging", fear: false, recommend: true, problem: "A weeknight can feel special.", solution: "A shared table does that.", product: "The offer is on the table.", signals: [] },
  { id: "coupon_anticipation", label: "Anticipation", verticals: ["food", "retail"], need: "esteem", fear: false, problem: "Something good is coming.", solution: "The visit is the good part.", product: "The offer is waiting.", signals: ["coming", "soon", "ahead"] },
  { id: "plumbing_fear", label: "Fear of water damage", verticals: ["plumbing"], need: "safety", fear: true, problem: "A slow leak wastes the house.", solution: "A visit finds the leak.", product: "The visit is the next step.", signals: ["leak", "flood", "damage"] },
  { id: "plumbing_trust", label: "Trust", verticals: ["plumbing"], need: "safety", fear: false, recommend: true, problem: "Know who opens the wall.", solution: "A plumber can take the call.", product: "The visit is the next step.", signals: [] },
  { id: "plumbing_relief", label: "Relief", verticals: ["plumbing"], need: "safety", fear: false, problem: "The drain can run clear.", solution: "One visit can clear it.", product: "The visit is the next step.", signals: ["relief", "clear"] },
  { id: "hvac_fear", label: "Fear of a breakdown", verticals: ["hvac"], need: "safety", fear: true, problem: "A failed unit stops the house.", solution: "A tune-up can catch that.", product: "The tune-up is the next step.", signals: ["breakdown", "failed unit"] },
  { id: "hvac_comfort", label: "Comfort", verticals: ["hvac"], need: "physiological", fear: false, recommend: true, problem: "The house can feel right.", solution: "A tune-up restores the air.", product: "The tune-up is the next step.", signals: [] },
  { id: "hvac_trust", label: "Trust", verticals: ["hvac"], need: "safety", fear: false, problem: "Know who services the system.", solution: "A technician can check it.", product: "The tune-up is the next step.", signals: [] },
  { id: "dental_fear", label: "Fear of waiting", verticals: ["dental"], need: "safety", fear: true, problem: "A small issue gets bigger.", solution: "A visit can catch it early.", product: "The visit is the next step.", signals: ["pain", "waiting", "worse"] },
  { id: "dental_trust", label: "Trust", verticals: ["dental"], need: "safety", fear: false, recommend: true, problem: "A dentist you can ask.", solution: "One visit answers the question.", product: "The visit is the next step.", signals: [] },
  { id: "dental_calm", label: "Calm", verticals: ["dental"], need: "safety", fear: false, problem: "The visit can be simple.", solution: "One appointment is enough.", product: "The visit is the next step.", signals: ["calm", "gentle"] },
  { id: "pest_fear", label: "Fear of the problem spreading", verticals: ["pest"], need: "safety", fear: true, problem: "Ants rarely stay in one room.", solution: "A treatment can stop the spread.", product: "The treatment is the next step.", signals: ["ants", "spread", "infest"] },
  { id: "pest_relief", label: "Relief", verticals: ["pest"], need: "safety", fear: false, recommend: true, problem: "The kitchen can feel settled.", solution: "A treatment clears the kitchen.", product: "The treatment is the next step.", signals: [] },
  { id: "pest_trust", label: "Trust", verticals: ["pest"], need: "safety", fear: false, problem: "Know who treats the house.", solution: "A local tech can treat it.", product: "The treatment is the next step.", signals: [] },
  { id: "landscaping_pride", label: "Pride in the yard", verticals: ["landscaping"], need: "esteem", fear: false, recommend: true, problem: "The yard can look cared for.", solution: "One cleanup changes the view.", product: "The cleanup is the next step.", signals: [] },
  { id: "landscaping_anticipation", label: "Anticipation", verticals: ["landscaping"], need: "esteem", fear: false, problem: "The season is about to turn.", solution: "A cleanup meets the season.", product: "The cleanup is the next step.", signals: ["spring", "season"] },
  { id: "landscaping_fear", label: "Fear of a season wasted", verticals: ["landscaping"], need: "esteem", fear: true, problem: "A season of neglect shows.", solution: "A cleanup recovers the season.", product: "The cleanup is the next step.", signals: ["neglect", "overgrown", "weeds"] },
  { id: "solar_fear", label: "Fear of the bill", verticals: ["solar"], need: "safety", fear: true, problem: "The power bill keeps climbing.", solution: "A review can explain the bill.", product: "The review is the next step.", signals: ["bill", "rate", "cost"] },
  { id: "solar_trust", label: "Trust", verticals: ["solar"], need: "safety", fear: false, recommend: true, problem: "Know what the roof can do.", solution: "A review measures the roof.", product: "The review is the next step.", signals: [] },
  { id: "solar_optimism", label: "Optimism", verticals: ["solar"], need: "self_actualization", fear: false, problem: "Quiet power is possible.", solution: "A review shows that path.", product: "The review is the next step.", signals: [] },
  { id: "real_estate_belonging", label: "Belonging", verticals: ["real_estate"], need: "belonging", fear: false, problem: "A house can feel like yours.", solution: "A walkthrough makes that clear.", product: "The showing is the next step.", signals: [] },
  { id: "real_estate_trust", label: "Trust", verticals: ["real_estate"], need: "safety", fear: false, recommend: true, problem: "See the house in daylight.", solution: "A showing answers the question.", product: "The showing is the next step.", signals: [] },
  { id: "real_estate_fear", label: "Fear of missing the right house", verticals: ["real_estate"], need: "belonging", fear: true, problem: "The right house goes quickly.", solution: "A showing keeps you in it.", product: "The showing is the next step.", signals: ["miss", "gone", "sold"] },
  { id: "general_trust", label: "Trust", verticals: ["general"], need: "safety", fear: false, recommend: true, problem: "A local next step.", solution: "One call starts the work.", product: "The offer is the next step.", signals: [] },
  { id: "general_relief", label: "Relief", verticals: ["general"], need: "safety", fear: false, problem: "This can be handled.", solution: "One call starts the work.", product: "The offer is the next step.", signals: [] },
  { id: "general_fear", label: "Fear of the problem growing", verticals: ["general"], need: "safety", fear: true, problem: "A small problem gets larger.", solution: "One call can stop the wait.", product: "The offer is the next step.", signals: ["worse", "growing", "waiting"] },
]

export function emotionsFor(kind: string): CampaignEmotion[] {
  const matches = CAMPAIGN_EMOTIONS.filter((emotion) => emotion.verticals.includes(kind))
  return matches.length > 0 ? matches : CAMPAIGN_EMOTIONS.filter((emotion) => emotion.verticals.includes("general"))
}

export function coreNeed(id: CoreNeedId) {
  return CORE_NEEDS.find((need) => need.id === id) ?? CORE_NEEDS[1]!
}

export function resolveAwareness(value?: string | null) {
  return AUDIENCE_AWARENESS.find((item) => item.id === value) ?? AUDIENCE_AWARENESS[0]!
}

export function resolveEmotion(kind: string, text: string, chosenId?: string | null): {
  emotion: CampaignEmotion
  source: "client" | "recommended"
} {
  const options = emotionsFor(kind)
  const chosen = chosenId ? options.find((emotion) => emotion.id === chosenId) : undefined
  if (chosen) return { emotion: chosen, source: "client" }
  const hay = text.toLowerCase()
  const signaled = options.find((emotion) => emotion.signals.some((signal) => signalHit(hay, signal)))
  if (signaled) return { emotion: signaled, source: "recommended" }
  const open = options.find((emotion) => emotion.recommend) ?? options.find((emotion) => !emotion.fear) ?? options[0]!
  return { emotion: open, source: "recommended" }
}

export function headlineFor(input: {
  emotion: CampaignEmotion
  awareness?: string | null
  offer: string
}): string {
  const level = resolveAwareness(input.awareness)
  if (level.lead === "offer") return offerLine(input.offer)
  if (level.lead === "solution") return input.emotion.solution
  if (level.lead === "product") return input.emotion.product
  return input.emotion.problem
}

function signalHit(hay: string, signal: string): boolean {
  if (!signal.trim()) return false
  const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
  return new RegExp(`\\b${escaped}\\b`, "i").test(hay)
}

function offerLine(offer: string): string {
  const words = offer.replace(/\s+/g, " ").replace(/[.!]+$/g, "").trim().split(" ").filter(Boolean).slice(0, 6)
  if (words.length >= 2) return words.join(" ")
  if (words.length === 1) return `${words[0]}.`
  return "The offer is here."
}
