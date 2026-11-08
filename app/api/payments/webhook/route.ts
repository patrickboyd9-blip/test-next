import { getLedgerStore } from "@/lib/ledger/event"
import { noteEvent } from "@/lib/ledger/note"
import { getJourneyStore } from "@/lib/mail-journey/job"
import { recordPayment } from "@/lib/mail-journey/record-payment"
import type { PaymentNotice } from "@/lib/mail-journey/payment"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Verified payment notices only. A match can mark an order paid.
 * This route does not mail and does not start another charge.
 */
export async function POST(request: Request): Promise<Response> {
  let notice: PaymentNotice
  try {
    notice = (await request.json()) as PaymentNotice
  } catch {
    return Response.json(
      { ok: false, mailed: false, message: "The payment notice could not be read." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } }
    )
  }
  const signature = request.headers.get("x-payment-signature") ?? ""
  const result = await recordPayment(
    getJourneyStore(),
    notice,
    signature,
    process.env.PAYMENT_WEBHOOK_SECRET,
    new Date().toISOString()
  )
  if (result.ok) {
    const outcome = result.job.state === "paid" ? "completed" : result.job.state === "payment_unknown" ? "unknown" : "failed"
    await noteEvent(getLedgerStore(), {
      ownerId: result.job.ownerId,
      campaignId: result.job.campaignId,
      type: "payment_recorded",
      outcome,
      occurredAt: new Date().toISOString(),
      versionKey: `${notice.eventId}:${outcome}`,
      creativeVersion: result.job.proofHash,
      listHash: result.job.listHash,
      listCount: result.job.listCount,
      amountCents: outcome === "completed" ? result.job.amountCents : null,
      note: outcome === "unknown"
        ? "The provider has not confirmed this charge. It was not treated as paid or as zero."
        : outcome === "completed"
          ? "Payment matched this order. Nothing was mailed from this notice."
          : "The payment did not succeed. Nothing was mailed.",
    })
  }
  return Response.json(result, {
    status: result.ok ? 200 : 400,
    headers: { "Cache-Control": "private, no-store" },
  })
}
