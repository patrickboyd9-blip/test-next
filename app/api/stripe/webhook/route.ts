import { NextResponse } from "next/server"

import { applyStripeEvent } from "@/lib/checkout/fulfill"
import { readStripeConfig, verifyStripeSignature } from "@/lib/checkout/stripe-config"
import { submitPaidMailOrder } from "@/lib/click2mail/mail-order-actions"
import { mirroringPaymentStore } from "@/lib/payments/persist"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Stripe calls this after checkout. The mailing is submitted to Click2Mail
 * only when the event says the card payment succeeded.
 */
export async function POST(request: Request) {
  const config = readStripeConfig()
  if (!config.enabled) {
    return NextResponse.json({ received: false }, { status: 503 })
  }
  const payload = await request.text()
  const event = verifyStripeSignature(
    payload,
    request.headers.get("stripe-signature"),
    config.credentials.webhookSecret
  )
  if (!event) {
    return NextResponse.json({ received: false }, { status: 400 })
  }

  try {
    await applyStripeEvent({
      event,
      payments: mirroringPaymentStore(),
      now: () => new Date().toISOString(),
      fulfillment: {
        async submit(payment) {
          const result = await submitPaidMailOrder(payment.campaignId)
          if (result.issues.length > 0) return { ok: false, message: result.issues.join(" ") }
          if (!result.campaign.mailOrder?.submitted) {
            return {
              ok: false,
              message: result.campaign.mailOrder?.error || "The mailing was paid but not sent to the printer.",
            }
          }
          return { ok: true }
        },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "The payment could not be recorded."
    return NextResponse.json({ received: false, message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
