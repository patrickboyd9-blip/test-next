"use server"

import { randomUUID } from "crypto"
import { headers } from "next/headers"

import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import type { Campaign } from "@/lib/campaign-creator/types"
import { describePrintMailMode } from "@/lib/click2mail/config"
import { submitPrintMailTest } from "@/lib/click2mail/mail-order-actions"
import { persistPayment } from "@/lib/payments/persist"
import type { PaymentRecord } from "@/lib/payments/types"
import { REVIEW_MAIL_CLASS, REVIEW_PRODUCT_ID } from "@/lib/pricing/defaults"
import { quoteMailing } from "@/lib/pricing/quote"
import { getPricingConfig } from "@/lib/pricing/store"

import {
  CHECKOUT_HOOK_TERMS_VERSION,
  type ComplianceAcceptance,
} from "./compliance-gate"
import { checkoutDecision } from "./decision"
import { createStripeGateway } from "./stripe-client"
import { checkoutAvailability, readStripeConfig } from "./stripe-config"

const repository = getCampaignRepository()

export interface CheckoutStartResult {
  campaign: Campaign
  issues: string[]
  checkoutUrl?: string
}

/**
 * Prepare the mailing, then open Stripe Checkout.
 * Click2Mail is not submitted here. The webhook submits after payment.
 */
export async function startMailCheckout(
  campaignId: string,
  input:
    | { kind: "csv"; csvText: string }
    | {
        kind: "self"
        first: string
        last: string
        address1: string
        address2?: string
        city: string
        state: string
        zip: string
      }
): Promise<CheckoutStartResult> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)

  const existing = campaign.mailOrder && !campaign.mailOrder.submitted ? campaign.mailOrder : undefined
  const pieceCount = existing?.jobId ? existing.pieceCount : countFromInput(input)
  const pricing = await getPricingConfig()
  const price = quoteMailing(pricing, {
    productId: REVIEW_PRODUCT_ID,
    mailClass: REVIEW_MAIL_CLASS,
    pieceCount,
  })
  const mode = describePrintMailMode()
  const decision = checkoutDecision({
    pieceCount,
    acceptance: campaign.complianceAcceptance,
    checkout: checkoutAvailability(),
    price,
    credentialsConfigured: mode.credentialsConfigured,
    productionLocked: mode.environment === "prod" && !mode.productionEnabled,
  })
  if (!decision.ok) return { campaign, issues: [decision.message] }

  const prepared = existing?.jobId
    ? { campaign, issues: [] as string[] }
    : await submitPrintMailTest(campaignId, input, decision.price.totalLabel)
  const order = prepared.campaign.mailOrder
  if (!order?.jobId) {
    return {
      campaign: prepared.campaign,
      issues: prepared.issues.length > 0 ? prepared.issues : ["The mailing is not ready to pay for yet. Nothing was charged."],
    }
  }
  if (prepared.campaign.payment?.status === "paid" && prepared.campaign.payment.orderId === order.id) {
    return { campaign: prepared.campaign, issues: ["This mailing is already paid."] }
  }

  const finalPrice = quoteMailing(pricing, {
    productId: REVIEW_PRODUCT_ID,
    mailClass: REVIEW_MAIL_CLASS,
    pieceCount: order.pieceCount,
  })
  const finalDecision = checkoutDecision({
    pieceCount: order.pieceCount,
    acceptance: prepared.campaign.complianceAcceptance,
    checkout: checkoutAvailability(),
    price: finalPrice,
    credentialsConfigured: true,
    productionLocked: false,
  })
  if (!finalDecision.ok || !finalPrice) {
    return {
      campaign: prepared.campaign,
      issues: [finalDecision.ok ? "This mailing does not have a price yet." : finalDecision.message],
    }
  }

  const stripe = readStripeConfig()
  if (!stripe.enabled) return { campaign: prepared.campaign, issues: [stripe.message] }

  const now = new Date().toISOString()
  let current = prepared.campaign
  if (current.mailOrder && current.mailOrder.estimatedCostLabel !== finalPrice.totalLabel) {
    current = await repository.saveMailOrder(campaignId, {
      ...current.mailOrder,
      estimatedCostLabel: finalPrice.totalLabel,
      updatedAt: now,
    })
  }
  const payment: PaymentRecord = {
    id: randomUUID(),
    campaignId,
    orderId: order.id,
    status: "pending",
    amountCents: finalPrice.totalCents,
    currency: "usd",
    pieceCount: order.pieceCount,
    productId: REVIEW_PRODUCT_ID,
    mailClass: REVIEW_MAIL_CLASS,
    perCardLabel: finalPrice.perCardLabel,
    totalLabel: finalPrice.totalLabel,
    createdAt: now,
    updatedAt: now,
  }

  try {
    const origin = await requestOrigin()
    const session = await createStripeGateway().createCheckoutSession({
      credentials: stripe.credentials,
      paymentId: payment.id,
      campaignId,
      orderId: order.id,
      amountCents: payment.amountCents,
      pieceCount: payment.pieceCount,
      productName: "Postcard mailing",
      successUrl: `${origin}/app/orders?checkout=success`,
      cancelUrl: `${origin}/app/campaigns/${campaignId}?checkout=cancelled`,
    })
    payment.stripeCheckoutSessionId = session.id
    const saved = await persistPayment(payment)
    return { campaign: saved, issues: [], checkoutUrl: session.url }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Card checkout could not be opened."
    return { campaign: current, issues: [`${message} Nothing was charged.`] }
  }
}

/** Hook the compliance clickwrap calls before payment. */
export async function recordComplianceAcceptance(
  campaignId: string,
  version: string = CHECKOUT_HOOK_TERMS_VERSION
): Promise<CheckoutStartResult> {
  const acceptance: ComplianceAcceptance = {
    acceptedAt: new Date().toISOString(),
    version: version.trim() || CHECKOUT_HOOK_TERMS_VERSION,
  }
  const campaign = await repository.saveComplianceAcceptance(campaignId, acceptance)
  return { campaign, issues: [] }
}

export async function markCheckoutCancelled(campaignId: string): Promise<void> {
  const campaign = await repository.getCampaign(campaignId)
  const payment = campaign?.payment
  if (!payment || payment.status !== "pending") return
  const now = new Date().toISOString()
  await persistPayment({
    ...payment,
    status: "cancelled",
    cancelledAt: now,
    updatedAt: now,
    failureMessage: "Payment was cancelled. Nothing was sent.",
  })
}

async function requestOrigin(): Promise<string> {
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host")
  const proto = headerList.get("x-forwarded-proto") ?? "https"
  if (!host) return "http://localhost:3000"
  return `${proto}://${host}`
}

function countFromInput(
  input:
    | { kind: "csv"; csvText: string }
    | { kind: "self"; first: string; last: string; address1: string; city: string; state: string; zip: string }
): number {
  if (input.kind === "csv") {
    const lines = input.csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const start = lines[0]?.toLowerCase().includes("address1") ? 1 : 0
    return Math.max(0, lines.length - start)
  }
  return input.address1.trim() && input.city.trim() && input.state.trim() && input.zip.trim() ? 1 : 0
}
