import { PLACEHOLDER_FULL_PRICE } from "@/lib/mailer-compose/flow"

/**
 * The number the customer sees is the full price for this many pieces.
 * It is never a postage-only figure.
 */
export function formatFullPrice(pieceCount: number, perPieceCents: number | null): { label: string; detail: string } {
  const people = pieceCount === 1 ? "1 person" : `${pieceCount} people`
  if (perPieceCents == null || pieceCount <= 0) {
    return {
      label: PLACEHOLDER_FULL_PRICE.label,
      detail: pieceCount > 0 ? `${people}. ${PLACEHOLDER_FULL_PRICE.detail}` : PLACEHOLDER_FULL_PRICE.detail,
    }
  }
  const dollars = ((perPieceCents * pieceCount) / 100).toFixed(2)
  return {
    label: `$${dollars}`,
    detail: `Full price for ${people}. Printing, postage, and the list are included. Not postage by itself. Nothing is charged from this screen.`,
  }
}
