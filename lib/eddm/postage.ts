/**
 * USPS published EDDM Retail postage. This is an estimate of postage only.
 * It is not a checkout price, and it does not include print or drop-off.
 * https://www.usps.com/business/prices/2026/m-fcm-eddm-retail.csv
 */

export const EDDM_RETAIL_POSTAGE_DOLLARS = 0.26

export interface EddmPostageEstimate {
  /** The word "estimate" is part of the customer-facing label. */
  label: "Postage estimate"
  amountLabel: string
  detail: string
}

export function eddmPostageEstimate(
  pieceCount: number,
  dollarsPerPiece: number = EDDM_RETAIL_POSTAGE_DOLLARS
): EddmPostageEstimate {
  if (pieceCount <= 0) {
    return {
      label: "Postage estimate",
      amountLabel: "—",
      detail: "Select routes to estimate postage. This is not a checkout price.",
    }
  }
  const amount = Math.round(pieceCount * dollarsPerPiece * 100) / 100
  const pieces = pieceCount === 1 ? "piece" : "pieces"
  return {
    label: "Postage estimate",
    amountLabel: formatDollars(amount),
    detail: `Estimate of USPS EDDM Retail postage for ${pieceCount} ${pieces} at ${formatDollars(dollarsPerPiece)} each. Print and drop-off are not included. This is not a checkout price.`,
  }
}

function formatDollars(amount: number): string {
  return `$${amount.toFixed(2)}`
}
