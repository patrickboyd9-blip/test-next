/**
 * Personal cards. The price is the full price for one card.
 * Postage is not a separate number.
 * Company pricing is a placeholder until it is set.
 */

export type CardAudience = "personal" | "company"

export interface PriceTier {
  label: string
  min: number
  max: number | null
  perCardCents: number
}

export const PERSONAL_PRICE_TIERS: readonly PriceTier[] = [
  { label: "1-4", min: 1, max: 4, perCardCents: 500 },
  { label: "5-9", min: 5, max: 9, perCardCents: 450 },
  { label: "10-24", min: 10, max: 24, perCardCents: 400 },
  { label: "25+", min: 25, max: null, perCardCents: 350 },
]

export const FULL_PRICE_NOTE = "Full price for the card, the envelope, and postage. Not postage by itself."

export interface CardPrice {
  audience: CardAudience
  configured: boolean
  perCardCents: number | null
  tier: string | null
  postageOnly: false
  message: string
}

export function tierForCount(count: number): PriceTier {
  const safe = Math.max(1, count)
  const tier = PERSONAL_PRICE_TIERS.find((item) => safe >= item.min && (item.max === null || safe <= item.max))
  return tier ?? PERSONAL_PRICE_TIERS[0]!
}

export function pricePersonalCard(count: number): CardPrice {
  const tier = tierForCount(count)
  return {
    audience: "personal",
    configured: true,
    perCardCents: tier.perCardCents,
    tier: tier.label,
    postageOnly: false,
    message: FULL_PRICE_NOTE,
  }
}

/** Company and HR pricing is not decided. Nothing is charged. */
export function priceCompanyCard(): CardPrice {
  return {
    audience: "company",
    configured: false,
    perCardCents: null,
    tier: null,
    postageOnly: false,
    message: "Company pricing is not set yet. Nothing is charged.",
  }
}

export function priceForAudience(audience: CardAudience, count: number): CardPrice {
  return audience === "company" ? priceCompanyCard() : pricePersonalCard(count)
}
