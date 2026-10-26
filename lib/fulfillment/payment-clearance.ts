/**
 * Pay-before-submit seam.
 *
 * The customer pays Modern Mail first. Only then does an order go to
 * Click2Mail. Checkout itself lives on another branch. This module is the
 * only place that decides whether an Every Door order is allowed to leave.
 */

export interface PaymentClearance {
  status: "unpaid" | "paid"
  paidAt?: string
}

export function eddmPaymentBlockedMessage(): string {
  return "Payment comes first. After you pay, this Every Door order goes to Click2Mail staging. Nothing is sent before that, and this screen does not show a checkout price."
}

/**
 * Paid when the campaign records payment.
 * On staging only, C2M_EDDM_ASSUME_PAID=true lets an operator run the live
 * check before checkout exists. Production ignores that flag.
 */
export function eddmPaymentCleared(input: {
  payment?: PaymentClearance
  environment: "stage" | "prod"
  env?: NodeJS.ProcessEnv
}): boolean {
  if (input.payment?.status === "paid") return true
  if (input.environment === "stage" && input.env?.C2M_EDDM_ASSUME_PAID?.trim() === "true") return true
  return false
}
