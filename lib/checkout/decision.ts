import type { CustomerPrice } from "@/lib/pricing/types"
import { stripeMinimumCents } from "@/lib/pricing/quote"

import { complianceAccepted, complianceBlockMessage, type ComplianceAcceptance } from "./compliance-gate"
import type { CheckoutAvailability } from "./stripe-config"

export function checkoutDecision(input: {
  pieceCount: number
  acceptance: ComplianceAcceptance | null | undefined
  checkout: CheckoutAvailability
  price: CustomerPrice | null
  credentialsConfigured: boolean
  productionLocked: boolean
}): { ok: true; price: CustomerPrice } | { ok: false; message: string } {
  if (input.productionLocked) {
    return {
      ok: false,
      message: "Live mailing is locked on this server. Nothing is sent.",
    }
  }
  if (!input.credentialsConfigured) {
    return {
      ok: false,
      message: "The printer is not connected on this server yet. Nothing is sent.",
    }
  }
  if (input.pieceCount <= 0) {
    return { ok: false, message: "Add at least one address to see the total and pay." }
  }
  if (!complianceAccepted(input.acceptance)) {
    return { ok: false, message: complianceBlockMessage() }
  }
  if (!input.checkout.enabled) {
    return { ok: false, message: input.checkout.message ?? "Card payment is not set up yet. Nothing is sent." }
  }
  if (!input.price || input.price.totalCents <= 0) {
    return { ok: false, message: "This mailing does not have a price yet. Nothing is sent." }
  }
  if (input.price.totalCents < stripeMinimumCents()) {
    return {
      ok: false,
      message: "This order is below the card minimum of $0.50. Nothing is sent.",
    }
  }
  return { ok: true, price: input.price }
}
