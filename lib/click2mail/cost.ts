/**
 * A labeled stand-in so the screen can show a number before Click2Mail prices the job.
 * Not a quote, not postage, and not read from the vendor.
 */
export const PLACEHOLDER_DOLLARS_PER_PIECE = 1.25

export function placeholderCostLabel(pieceCount: number): string {
  const amount = (pieceCount * PLACEHOLDER_DOLLARS_PER_PIECE).toFixed(2)
  return `$${amount} placeholder — not a Click2Mail quote`
}
