import type { MailOrderRecord } from "@/lib/click2mail/order-record"
import { isBeforeCancellationDeadline } from "@/lib/click2mail/cutoff"
import { canonicalJobStatus } from "@/lib/click2mail/job-status"
import type { PaymentRecord } from "@/lib/payments/types"

export function cancelWindow(input: {
  payment: Pick<PaymentRecord, "status">
  order: Pick<MailOrderRecord, "submitted" | "submittedAt" | "jobStatus" | "jobId"> | null
  now: Date
}): { allowed: boolean; reason?: string } {
  if (input.payment.status === "refunded") {
    return { allowed: false, reason: "This order was already cancelled and refunded." }
  }
  if (input.payment.status !== "paid") {
    return { allowed: false, reason: "Only a paid order can be cancelled." }
  }
  const status = canonicalJobStatus(input.order?.jobStatus)
  if (status === "MAILED") {
    return { allowed: false, reason: "This mailing has already been mailed, so it can no longer be cancelled." }
  }
  if (status === "IN_PRODUCTION") {
    return { allowed: false, reason: "This mailing is already at the printer, so it can no longer be cancelled." }
  }
  if (input.order?.submitted) {
    const submittedAt = input.order.submittedAt ? new Date(input.order.submittedAt) : input.now
    if (!isBeforeCancellationDeadline(submittedAt, input.now)) {
      return {
        allowed: false,
        reason: "This is past Click2Mail’s 8:00 PM ET cutoff, so the mailing can no longer be cancelled.",
      }
    }
  }
  return { allowed: true }
}

export async function applyCancellation(input: {
  payment: PaymentRecord
  order: MailOrderRecord | null
  now: string
  cancelJob: (jobId: string) => Promise<void>
  refund: (paymentIntentId: string) => Promise<{ id: string }>
}): Promise<{ ok: true; payment: PaymentRecord } | { ok: false; message: string }> {
  const window = cancelWindow({
    payment: input.payment,
    order: input.order,
    now: new Date(input.now),
  })
  if (!window.allowed) return { ok: false, message: window.reason ?? "This order can no longer be cancelled." }
  if (input.order?.submitted && input.order.jobId) {
    try {
      await input.cancelJob(input.order.jobId)
    } catch (error) {
      const message = error instanceof Error ? error.message : "The printer could not cancel this job."
      return {
        ok: false,
        message: `${message} The card was not refunded, because the mailing may still go out.`,
      }
    }
  }
  if (!input.payment.stripePaymentIntentId) {
    return { ok: false, message: "This payment has no card charge to refund." }
  }
  try {
    const refund = await input.refund(input.payment.stripePaymentIntentId)
    return {
      ok: true,
      payment: {
        ...input.payment,
        status: "refunded",
        refundId: refund.id,
        refundedAt: input.now,
        updatedAt: input.now,
        failureMessage: undefined,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The refund did not go through."
    return { ok: false, message }
  }
}
