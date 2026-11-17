import type { JourneyStore, MailJob } from "./job"
import { applyVerifiedPayment, verifyPaymentNotice, type PaymentNotice } from "./payment"

export async function recordPayment(
  store: JourneyStore,
  notice: PaymentNotice,
  signature: string,
  secret: string | undefined,
  nowIso: string
): Promise<{ ok: true; job: MailJob; mailed: false } | { ok: false; mailed: false; message: string }> {
  const verified = verifyPaymentNotice(notice, signature, secret)
  if (!verified.ok) return { ok: false, mailed: false, message: verified.message }
  const job = await store.getJob(notice.orderId)
  if (!job) return { ok: false, mailed: false, message: "No matching order. Nothing was marked paid." }
  const next = applyVerifiedPayment(job, notice, nowIso)
  if (next !== job) await store.saveJob(next)
  return { ok: true, job: next, mailed: false }
}
