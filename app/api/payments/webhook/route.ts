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
  return Response.json(result, {
    status: result.ok ? 200 : 400,
    headers: { "Cache-Control": "private, no-store" },
  })
}
