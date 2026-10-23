/**
 * Owner-editable prices. Customers never see this split.
 * Print costs and unconfirmed postage stay marked as placeholders until
 * the owner replaces them on the pricing page.
 */

export const PRICING_PRODUCT_IDS = [
  "postcard_5x8",
  "postcard_6x9",
  "eddm_6_5x9",
  "eddm_6_25x11",
] as const

export type PricingProductId = (typeof PRICING_PRODUCT_IDS)[number]

export const MAIL_CLASS_IDS = ["first_class", "eddm"] as const

export type MailClassId = (typeof MAIL_CLASS_IDS)[number]

export interface PostageRate {
  /** Dollars per piece. Null means the figure is still an empty placeholder. */
  dollars: number | null
  /** True while this figure is not a confirmed rate. */
  isPlaceholder: boolean
}

export interface ProductPrice {
  label: string
  /** Dollars per piece to print. Null means PLACEHOLDER, priced as $0 until set. */
  printCostDollars: number | null
  printCostIsPlaceholder: boolean
  postage: Partial<Record<MailClassId, PostageRate>>
}

export interface PricingConfig {
  version: 1
  /**
   * While true, non-production screens show "Pricing not final".
   * The owner turns this off when the numbers are the ones customers should trust.
   */
  pricesArePlaceholders: boolean
  /** Percent added to print + postage. 0 until the owner sets it. */
  markupPercent: number
  /** Extra dollars added to every piece, after the percent. */
  markupPerPieceDollars: number
  /** Order total is raised to this amount when the pieces cost less. 0 means no floor. */
  minimumOrderDollars: number
  products: Record<PricingProductId, ProductPrice>
}

/** What the review screen is allowed to know. No print, postage, or margin split. */
export interface CustomerRate {
  productId: PricingProductId
  mailClass: MailClassId
  /** All-in price for one piece, in thousandths of a dollar, before the order minimum. */
  perCardMills: number
  minimumOrderCents: number
  pricingNotFinal: boolean
}

export interface CustomerPrice {
  pieceCount: number
  perCardMills: number
  totalCents: number
  perCardLabel: string
  totalLabel: string
  pricingNotFinal: boolean
  /** True when the minimum order raised the total. */
  minimumApplied: boolean
}
