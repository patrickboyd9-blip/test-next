import type { MailOrderRecord } from "@/lib/click2mail/order-record"
import { canonicalJobStatus } from "@/lib/click2mail/job-status"
import type { PaymentRecord, PaymentStatus } from "@/lib/payments/types"

import { cancelWindow } from "./cancel"

export const ORDER_STEPS = [
  { id: "paid", label: "Paid" },
  { id: "submitted", label: "Submitted" },
  { id: "printing", label: "Printing" },
  { id: "mailed", label: "Mailed" },
] as const

export type OrderStepId = (typeof ORDER_STEPS)[number]["id"]

export interface OrderStepView {
  id: OrderStepId
  label: string
  state: "complete" | "current" | "upcoming"
}

export interface CustomerOrderView {
  paymentId: string
  campaignId: string
  campaignName: string
  pieceCount: number
  totalLabel: string
  createdAt: string
  paymentStatus: PaymentStatus
  steps: OrderStepView[]
  sentence: string
  canCancel: boolean
  cancelBlockedReason?: string
  problem?: string
}

const PRINTING = new Set(["ORDER_PROCESSING", "AWAITING_PRODUCTION", "IN_PRODUCTION"])

export function orderStepIndex(payment: Pick<PaymentRecord, "status" | "fulfillment">, order: MailOrderRecord | null): number {
  if (payment.status !== "paid" && payment.status !== "refunded") return -1
  const status = canonicalJobStatus(order?.jobStatus)
  if (status === "MAILED") return 3
  if (status && PRINTING.has(status)) return 2
  if (order?.submitted || payment.fulfillment === "submitted" || status === "ORDER_SUBMITTED" || status === "PROOF_ACCEPTED") {
    return 1
  }
  if (payment.status === "paid") return 0
  return -1
}

export function orderSteps(index: number): OrderStepView[] {
  return ORDER_STEPS.map((step, stepIndex) => ({
    id: step.id,
    label: step.label,
    state: index < 0 ? "upcoming" : stepIndex < index ? "complete" : stepIndex === index ? "current" : "upcoming",
  }))
}

export function presentOrder(input: {
  payment: PaymentRecord
  order: MailOrderRecord | null
  campaignName: string
  now: Date
}): CustomerOrderView {
  const index = input.payment.status === "refunded" ? -1 : orderStepIndex(input.payment, input.order)
  const window = cancelWindow({ payment: input.payment, order: input.order, now: input.now })
  const problem = problemLine(input.payment, input.order)
  return {
    paymentId: input.payment.id,
    campaignId: input.payment.campaignId,
    campaignName: input.campaignName,
    pieceCount: input.payment.pieceCount,
    totalLabel: input.payment.totalLabel,
    createdAt: input.payment.createdAt,
    paymentStatus: input.payment.status,
    steps: orderSteps(index),
    sentence: statusSentence(input.payment, input.order, index),
    canCancel: window.allowed,
    cancelBlockedReason: window.allowed ? undefined : window.reason,
    problem,
  }
}

function statusSentence(payment: PaymentRecord, order: MailOrderRecord | null, index: number): string {
  if (payment.status === "refunded") return "Cancelled and refunded."
  if (payment.status === "failed") return "The card payment did not go through. Nothing was sent."
  if (payment.status === "cancelled") return "Payment was cancelled. Nothing was sent."
  if (payment.status === "pending") return "Waiting for payment. Nothing is sent until the card payment succeeds."
  if (payment.fulfillment === "error") {
    return "Paid. The printer has not accepted the mailing yet."
  }
  if (index >= 3) return "Mailed."
  if (index === 2) return "At the printer."
  if (index === 1) return "Sent to the printer."
  if (order?.submitted) return "Sent to the printer."
  return "Paid. It has not been sent to the printer yet."
}

function problemLine(payment: PaymentRecord, order: MailOrderRecord | null): string | undefined {
  if (payment.status === "failed" || payment.status === "cancelled" || payment.status === "refunded") {
    return payment.failureMessage
  }
  if (payment.fulfillment === "error") return payment.failureMessage
  return order?.error
}
