import { applyStripeWebhook } from "@/lib/ops/mail-flow"
import { getJourneyStore } from "@/lib/mail-journey/job"
import { applyVerifiedPayment, type PaymentNotice } from "@/lib/mail-journey/payment"
import { readStripeNotice } from "@/lib/ops/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Stripe is the only caller. A browser return must not use this route.
 * A confirmed payment updates the order and does not mail.
 */
export async function POST(request: Request): Promise<Response> {
  const payload = await request.text()
  const header = request.headers.get("stripe-signature")
  const result = await applyStripeWebhook(payload, header)
  if (result.charged) {
    const notice = readStripeNotice(payload)
    if (notice.kind === "paid") {
      try {
        const store = getJourneyStore()
        const job = await store.getJob(notice.jobId)
        if (job && job.amountCents === notice.amountCents && job.campaignId === notice.subjectId) {
          const payment: PaymentNotice = {
            eventId: notice.eventId,
            orderId: job.id,
            outcome: "succeeded",
            currency: "usd",
            amountCents: notice.amountCents,
          }
          const next = applyVerifiedPayment(job, payment, new Date().toISOString())
          if (next !== job) await store.saveJob(next)
        }
      } catch {
        // The audit already records the confirmed charge. A missing order file does not undo it.
      }
    }
  }
  return Response.json(
    { ok: result.status === 200, charged: result.charged, mailed: false, message: result.message },
    { status: result.status, headers: { "Cache-Control": "private, no-store" } }
  )
}
