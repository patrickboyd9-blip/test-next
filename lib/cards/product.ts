import {
  FOLDED_NOTECARD_API_SUPPORT,
  FOLDED_NOTECARD_DOCUMENT_CLASS,
  foldedNotecardProduct,
} from "@/lib/click2mail/products"

/**
 * Personal and employee cards use the folded notecard.
 * API support is not confirmed, so this module never places an order.
 */
export const CARD_FORMAT = {
  id: "folded-notecard-4.25x5.5",
  name: "Folded notecard",
  widthInches: 4.25,
  heightInches: 5.5,
  envelope: true,
  documentClass: FOLDED_NOTECARD_DOCUMENT_CLASS,
  apiSupport: FOLDED_NOTECARD_API_SUPPORT,
  product: foldedNotecardProduct(),
} as const

export function placeCardOrder(): never {
  throw new Error("Folded notecard API support is still to confirm. No order was placed.")
}
