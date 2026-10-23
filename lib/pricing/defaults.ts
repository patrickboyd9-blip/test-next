import type { MailClassId, PricingConfig, PricingProductId, ProductPrice } from "./types"

/**
 * Starting prices. The owner edits the saved settings; this object is only
 * the fallback before that, and the source of PLACEHOLDER marks.
 *
 * Confirmed: 5×8 First Class postage is $0.495 per standard address.
 * Estimate: EDDM postage is about $0.26. Print costs, 6×9 postage, markup,
 * and the minimum order are PLACEHOLDER until the owner fills them in.
 * EDDM 6.5×9 and 6.25×11 are sizes another change is adding. Their print
 * costs stay empty on purpose.
 */
export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  version: 1,
  pricesArePlaceholders: true,
  markupPercent: 0,
  markupPerPieceDollars: 0,
  minimumOrderDollars: 0,
  products: {
    postcard_5x8: product("5×8 postcard", {
      first_class: { dollars: 0.495, isPlaceholder: false },
    }),
    postcard_6x9: product("6×9 postcard", {
      first_class: { dollars: null, isPlaceholder: true },
    }),
    eddm_6_5x9: product("EDDM 6.5×9", {
      eddm: { dollars: 0.26, isPlaceholder: true },
    }),
    eddm_6_25x11: product("EDDM 6.25×11", {
      eddm: { dollars: 0.26, isPlaceholder: true },
    }),
  },
}

/** The piece the review step sells today. Other sizes are priced for when they can be chosen. */
export const REVIEW_PRODUCT_ID: PricingProductId = "postcard_5x8"
export const REVIEW_MAIL_CLASS: MailClassId = "first_class"

function product(
  label: string,
  postage: ProductPrice["postage"]
): ProductPrice {
  return {
    label,
    printCostDollars: null,
    printCostIsPlaceholder: true,
    postage,
  }
}

export function isPricingProductId(value: string): value is PricingProductId {
  return (DEFAULT_PRICING_CONFIG.products as Record<string, ProductPrice>)[value] !== undefined
}

export function isMailClassId(value: string): value is MailClassId {
  return value === "first_class" || value === "eddm"
}
