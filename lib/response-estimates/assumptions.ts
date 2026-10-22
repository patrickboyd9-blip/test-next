import type { DesignVertical } from "@/lib/design-intelligence/rationale"
import type { AudienceListType } from "@/lib/campaign-creator/types"

/**
 * Conservative planning bands for a postcard response estimate.
 *
 * These are estimates for a conversation before someone orders mail.
 * They are not a forecast for any Modern Mail campaign, and they are not a
 * guarantee. A range is always shown. A single expected number is not.
 *
 * Published benchmarks this table stays under (not the numbers we show):
 *
 * - ANA/DMA Response Rate Report 2018. Public summaries of that report state
 *   a median direct-mail response of 9% for house lists and 4.9% for prospect
 *   lists. MediaPost, Sept 25, 2019, "Direct Mail Still Effective With
 *   Hispanics." Dunhill, March 6, 2019, "Takeaways from the ANA | DMA Response
 *   Rate Report, 2018." The report page is ANA, "Response Rate Report" (2018):
 *   https://www.ana.net/miccontent/show/id/rr-2018-ana-dma-respose-rate
 *   (the ANA slug spells "response" as "respose").
 * - AccuList's recap of the same report describes postcard medians even higher
 *   than the all-format medians (about 13% house and 10% prospect in combined
 *   B2B and B2C). Those figures are self-reported survey medians. They mix
 *   formats, industries, and what "a response" means.
 *   https://www.acculist.com/despite-doubters-2018-direct-mail-ups-response-roi-usage/
 * - USPS does not publish one national response rate for Every Door Direct
 *   Mail. Every Door is saturation mail by carrier route, not a chosen name
 *   list. https://www.usps.com/business/every-door-direct-mail.htm
 *
 * The bands below are deliberately under those headlines so a local postcard
 * is not planned as if a survey median were a promise.
 *
 * List bands, as a share of pieces that might respond:
 * - house list: 0.80% to 2.50%
 * - prospect list: 0.20% to 0.60%
 * - Every Door: 0.10% to 0.35%
 *
 * Rates are stored as hundred-thousandths so 200 means 0.20%. Offer and
 * vertical multipliers are stored as thousandths so 1000 means 1.00. That
 * keeps the arithmetic on integers. The multipliers are planning judgment,
 * not a published statistic for a trade or a city. They stay small so this
 * file does not invent a precise roofing rate or a precise restaurant rate.
 */

export const RESPONSE_RATE_SCALE = 100_000
export const RESPONSE_MULTIPLIER_SCALE = 1_000

export const LIST_RESPONSE_BANDS: Record<
  AudienceListType,
  { low: number; high: number }
> = {
  house: { low: 800, high: 2_500 },
  prospect: { low: 200, high: 600 },
  every_door: { low: 100, high: 350 },
}

export type OfferStrength = "light" | "clear" | "strong"

/** 700 = 0.70, 1000 = 1.00, 1250 = 1.25. Judgment, not a published lift. */
export const OFFER_STRENGTH_MULTIPLIER: Record<OfferStrength, number> = {
  light: 700,
  clear: 1_000,
  strong: 1_250,
}

/** Judgment bands. 1000 is the home-services base. None of these are survey stats. */
export const VERTICAL_RESPONSE_MULTIPLIER: Record<DesignVertical, number> = {
  roofing: 1_000,
  plumbing: 1_000,
  hvac: 1_000,
  real_estate: 850,
  medicare_insurance: 750,
  general_local_service: 900,
}

export const RESPONSE_ESTIMATE_DISCLAIMER =
  "Estimate only. Results vary with the list, the offer, the design, the season, and what you ask people to do. This is not a guarantee."

export const LIST_TYPE_WHY: Record<AudienceListType, string> = {
  house: "A house list is people who already know you, so this band sits higher than a cold list.",
  prospect:
    "A prospect list is people who have not bought from you, so this band sits lower than a house list.",
  every_door:
    "Every Door goes to carrier routes rather than a chosen list of names, so this band is the lowest of the three.",
}

export const ASSUMED_LIST_WHY =
  "No list type is chosen yet, so this uses the prospect-list band, which is the cautious default."

export const OFFER_WHY: Record<OfferStrength, string> = {
  light: "There isn't a specific offer yet, so the range stays toward the low end of the band.",
  clear: "A stated offer sits in the middle of the planning band.",
  strong:
    "A concrete offer, such as a price, a percent off, or something free, lifts the range slightly.",
}

export const VERTICAL_WHY: Record<DesignVertical, string> = {
  roofing: "Home services use the base planning band.",
  plumbing: "Home services use the base planning band.",
  hvac: "Home services use the base planning band.",
  real_estate: "Real estate is planned a little lower, as a judgment, because the decision is usually slower.",
  medicare_insurance:
    "Insurance mail is planned a little lower, as a judgment, because a cold card has more trust to earn.",
  general_local_service: "Other local services use a slightly cautious band.",
}
