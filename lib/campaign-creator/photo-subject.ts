import { offerPhotoSubject } from "@/lib/campaign-creator/offer-photo-subject"
import { roofDamageInHeadline } from "@/lib/campaign-creator/roof-damage-photo"

/** Property photos. A sky crop is safe because there is no face to cut. */
const SCENE_TRADES = new Set([
  "real-estate-agents",
  "real_estate",
  "home-buying",
  "precious-metals",
  "bakery",
  "laundromat",
  "consumer-products",
  "retail-grand-openings",
])

export interface PhotoSubjectInput {
  trade?: string | null
  headline?: string | null
  offer?: string | null
}

/**
 * Whether the photograph we will print has a person whose head must survive
 * every crop: the front slot, the offer bar, and the back's reuse of the
 * same frame. House and product photos stay scenes so the roof/sky crop
 * can remain.
 */
export function inferPhotoSubject(input: PhotoSubjectInput): "person" | "scene" {
  const trade = (input.trade ?? "").toLowerCase()
  if (SCENE_TRADES.has(trade)) return "scene"
  const offerLine = offerPhotoSubject(trade, input.offer ?? "")
  if (offerLine && /\bno people\b/i.test(offerLine)) return "scene"
  if (roofDamageInHeadline(input.headline)) return "person"
  if (!trade || trade === "roofing") return "scene"
  return "person"
}
