import { verticalForBrief } from "@/lib/design-intelligence/vertical"
import type { DesignVertical } from "@/lib/design-intelligence/rationale"
import type {
  AudienceListType,
  AudienceQuantityKind,
  CampaignBrief,
  PrimarySuccessMetricType,
} from "@/lib/campaign-creator/types"

import {
  ASSUMED_LIST_WHY,
  LIST_RESPONSE_BANDS,
  LIST_TYPE_WHY,
  OFFER_STRENGTH_MULTIPLIER,
  OFFER_WHY,
  RESPONSE_ESTIMATE_DISCLAIMER,
  RESPONSE_MULTIPLIER_SCALE,
  RESPONSE_RATE_SCALE,
  VERTICAL_RESPONSE_MULTIPLIER,
  VERTICAL_WHY,
  type OfferStrength,
} from "./assumptions"

const DIVISOR =
  BigInt(RESPONSE_RATE_SCALE) * BigInt(RESPONSE_MULTIPLIER_SCALE) * BigInt(RESPONSE_MULTIPLIER_SCALE)

const RESPONSE_NOUN: Record<PrimarySuccessMetricType, string> = {
  appointment: "appointments",
  phone_call: "calls",
  qr_scan: "scans",
  coupon_redemption: "redemptions",
  website_visit: "website visits",
  purchase: "purchases",
  form_submission: "form responses",
  event_registration: "sign-ups",
  physical_visit: "visits",
  delivery: "replies",
  donation: "gifts",
  other: "responses",
}

export interface ResponseEstimate {
  /** Always a range, always marked as rough. Never a single promised count. */
  headline: string
  quantityNote: string
  why: string
  disclaimer: string
  lowCount: number
  highCount: number
  listType: AudienceListType
  assumedListType: boolean
  offerStrength: OfferStrength
  vertical: DesignVertical
  quantityKind: AudienceQuantityKind
}

export function offerStrengthForBrief(brief: CampaignBrief): OfferStrength {
  const text = [brief.offer, brief.goal, brief.desiredRecipientAction]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
  if (
    /\$\s?\d|\d[\d,]*\s?%|\bfree\b|\bcomplimentary\b|\bno[- ](?:cost|charge|obligation)\b|\bhalf off\b|\bbogo\b/i.test(
      text
    )
  ) {
    return "strong"
  }
  if (brief.offer?.trim()) return "clear"
  return "light"
}

export function responseNoun(brief: CampaignBrief): string {
  const type = brief.primarySuccessMetric?.type
  if (type && RESPONSE_NOUN[type]) return RESPONSE_NOUN[type]
  const text = `${brief.desiredRecipientAction ?? ""} ${brief.primarySuccessMetric?.description ?? ""}`.toLowerCase()
  if (/\bcalls?\b|\bphone\b/.test(text)) return "calls"
  if (/\bscans?\b|\bqr\b/.test(text)) return "scans"
  if (/\bappointments?\b|\bbook\b/.test(text)) return "appointments"
  if (/\bvisits?\b/.test(text)) return "visits"
  if (/\bredeems?\b|\bcoupons?\b/.test(text)) return "redemptions"
  return "responses"
}

function plannedQuantity(brief: CampaignBrief): { quantity?: number; kind: AudienceQuantityKind } {
  const audience = brief.audience
  const quantity = audience?.quantity
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
    return { kind: "unavailable" }
  }
  const kind = audience?.quantityKind ?? "requested"
  if (kind === "unavailable") return { kind: "unavailable" }
  return { quantity, kind }
}

function scaledCount(
  quantity: number,
  rate: number,
  offer: number,
  vertical: number,
  round: "floor" | "ceil"
): number {
  const product = BigInt(quantity) * BigInt(rate) * BigInt(offer) * BigInt(vertical)
  if (round === "floor") return Number(product / DIVISOR)
  return Number((product + DIVISOR - BigInt(1)) / DIVISOR)
}

export function estimateResponse(brief: CampaignBrief): ResponseEstimate {
  const listType = brief.audience?.listType ?? "prospect"
  const assumedListType = !brief.audience?.listType
  const offerStrength = offerStrengthForBrief(brief)
  const vertical = verticalForBrief(brief)
  const band = LIST_RESPONSE_BANDS[listType]
  const offer = OFFER_STRENGTH_MULTIPLIER[offerStrength]
  const verticalMultiplier = VERTICAL_RESPONSE_MULTIPLIER[vertical]
  const { quantity, kind } = plannedQuantity(brief)
  const basis = quantity ?? 1_000
  const lowCount = scaledCount(basis, band.low, offer, verticalMultiplier, "floor")
  let highCount = scaledCount(basis, band.high, offer, verticalMultiplier, "ceil")
  if (highCount <= lowCount) highCount = lowCount + 1

  const noun = responseNoun(brief)
  const formattedBasis = basis.toLocaleString("en-US")
  const range = `${lowCount.toLocaleString("en-US")}–${highCount.toLocaleString("en-US")}`
  const headline = quantity
    ? `Expect roughly ${range} ${noun} from ${formattedBasis} ${kind === "from_upload" ? "names in your file" : "cards"}.`
    : `Expect roughly ${range} ${noun} per 1,000 cards.`

  const quantityNote = quantity
    ? kind === "from_upload"
      ? "That count is the number of names in your file. It is not an estimate of a neighborhood."
      : `You asked to mail about ${formattedBasis}. That is not a counted list.`
    : "A piece count is not set, so there is no total for this campaign."

  const why = [
    assumedListType ? ASSUMED_LIST_WHY : LIST_TYPE_WHY[listType],
    OFFER_WHY[offerStrength],
    VERTICAL_WHY[vertical],
  ].join(" ")

  return {
    headline,
    quantityNote,
    why,
    disclaimer: RESPONSE_ESTIMATE_DISCLAIMER,
    lowCount,
    highCount,
    listType,
    assumedListType,
    offerStrength,
    vertical,
    quantityKind: kind,
  }
}
