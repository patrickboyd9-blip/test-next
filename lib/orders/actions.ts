"use server"

import { createClick2MailClient } from "@/lib/click2mail/client"
import { assertClick2MailCallable, loadClick2MailConfig } from "@/lib/click2mail/config"
import { refreshPrintMailStatus } from "@/lib/click2mail/mail-order-actions"
import type { MailOrderRecord } from "@/lib/click2mail/order-record"
import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import { readStripeConfig } from "@/lib/checkout/stripe-config"
import { createStripeGateway } from "@/lib/checkout/stripe-client"
import { persistPayment } from "@/lib/payments/persist"
import { getPaymentStore } from "@/lib/payments/store"

import { applyCancellation } from "./cancel"
import { presentOrder, type CustomerOrderView } from "./present"

export interface OrderActionResult {
  message: string
  order?: CustomerOrderView
}

export async function cancelCustomerOrder(paymentId: string): Promise<OrderActionResult> {
  const payments = getPaymentStore()
  const payment = await payments.get(paymentId)
  if (!payment) return { message: "That order could not be found." }
  const repository = getCampaignRepository()
  const campaign = await repository.getCampaign(payment.campaignId)
  const order = orderForPayment(campaign?.mailOrder, campaign?.mailOrderHistory, payment.orderId)
  const now = new Date().toISOString()
  const stripe = readStripeConfig()
  const result = await applyCancellation({
    payment,
    order,
    now,
    async cancelJob(jobId) {
      const config = loadClick2MailConfig()
      assertClick2MailCallable(config)
      const client = createClick2MailClient({ config })
      await client.cancelSubmittedJob(jobId)
    },
    async refund(paymentIntentId) {
      if (!stripe.enabled) throw new Error("Card refunds need the Stripe test keys on this server.")
      return createStripeGateway().refundPayment({
        credentials: stripe.credentials,
        paymentIntentId,
      })
    },
  })
  if (!result.ok) return { message: result.message }
  const savedCampaign = await persistPayment(result.payment)
  const savedOrder = orderForPayment(savedCampaign.mailOrder, savedCampaign.mailOrderHistory, result.payment.orderId)
  return {
    message: "Cancelled and refunded. The card will show the refund, and the mailing will not go out.",
    order: presentOrder({
      payment: result.payment,
      order: savedOrder,
      campaignName: campaignName(savedCampaign),
      now: new Date(now),
    }),
  }
}

export async function refreshCustomerOrder(paymentId: string): Promise<OrderActionResult> {
  const payment = await getPaymentStore().get(paymentId)
  if (!payment) return { message: "That order could not be found." }
  const refreshed = await refreshPrintMailStatus(payment.campaignId)
  const order = orderForPayment(refreshed.campaign.mailOrder, refreshed.campaign.mailOrderHistory, payment.orderId)
  const latest = refreshed.campaign.payment?.id === payment.id ? refreshed.campaign.payment : payment
  return {
    message: refreshed.issues[0] ?? "Status updated.",
    order: presentOrder({
      payment: latest,
      order,
      campaignName: campaignName(refreshed.campaign),
      now: new Date(),
    }),
  }
}

function orderForPayment(
  current: MailOrderRecord | undefined,
  history: MailOrderRecord[] | undefined,
  orderId: string
): MailOrderRecord | null {
  if (current?.id === orderId) return current
  return history?.find((order) => order.id === orderId) ?? null
}

function campaignName(campaign: { name?: string; brief: { businessInfo?: { name?: string } } }): string {
  return campaign.name?.trim() || campaign.brief.businessInfo?.name?.trim() || "Postcard mailing"
}
