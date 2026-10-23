export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded"

export type FulfillmentState = "started" | "submitted" | "error"

/**
 * What we keep after someone pays, linked to the campaign and the mail order.
 * This record has no print, postage, or margin split.
 */
export interface PaymentRecord {
  id: string
  campaignId: string
  orderId: string
  status: PaymentStatus
  amountCents: number
  currency: "usd"
  pieceCount: number
  productId: string
  mailClass: string
  perCardLabel: string
  totalLabel: string
  stripeCheckoutSessionId?: string
  stripePaymentIntentId?: string
  createdAt: string
  updatedAt: string
  paidAt?: string
  cancelledAt?: string
  refundedAt?: string
  refundId?: string
  failureMessage?: string
  /** Set when a paid webhook starts or finishes the Click2Mail submit. */
  fulfillment?: FulfillmentState
}
