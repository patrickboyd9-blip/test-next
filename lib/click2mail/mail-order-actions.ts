"use server"

import { attorneyAdMark } from "@/lib/design-intelligence/attorney-compliance"
import { isAtOrPastStatus } from "@/lib/campaign-creator/campaign-status"
import { medicareDisclaimerFor } from "@/lib/campaign-creator/medicare-compliance"
import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import { displayWebsite, postcardIdentityFromBrief, resolveStudioContact } from "@/lib/campaign-creator/studio-contact"
import type { Campaign, CreativeSpec } from "@/lib/campaign-creator/types"
import type { PostcardPrintCopy } from "@/lib/print-spec/render-campaign-postcard-pdf"
import { loadApprovedUploadPdf } from "@/lib/bring-your-own-design/print-source"
import { renderPostcardPrintPdf } from "@/lib/print-spec/render-campaign-postcard-pdf"
import { renderTemplatedPostcardPdf } from "@/lib/print-spec/render-template-postcard-pdf"
import { isPostcardTemplate, isVerticalPalette } from "@/lib/postcard-layouts/ids"

import { assertClick2MailCallable, loadClick2MailConfig } from "./config"
import { createClick2MailClient } from "./client"
import { loadFinalPostcardPhoto } from "./load-print-photo"
import { placeClick2MailOrder, refreshClick2MailOrder } from "./order"
import type { MailOrderRecord } from "./order-record"
import { normalizeRecipient, parseRecipientCsv, type Recipient } from "./recipients"
import { returnAddressFromBusiness } from "./return-address"
import type { ReturnAddress } from "./types"

const repository = getCampaignRepository()

export interface PrintMailActionResult {
  campaign: Campaign
  issues: string[]
}

export async function submitPrintMailTest(
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
      },
  customerTotalLabel?: string
): Promise<PrintMailActionResult> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) return missing(campaignId)

  const blocked = guard(campaign)
  if (blocked) return { campaign, issues: [blocked] }

  const parsed =
    input.kind === "csv"
      ? parseRecipientCsv(input.csvText)
      : oneRecipient(input)
  if (parsed.errors.length > 0 || parsed.recipients.length === 0) {
    return { campaign, issues: parsed.errors.length > 0 ? parsed.errors : ["Add at least one address."] }
  }

  return runOrder(campaign, parsed.recipients, reusableOrder(campaign), {
    submit: false,
    customerTotalLabel,
  })
}

/**
 * Submit a job only after the card payment is recorded as paid.
 * Invoice billing is required so Click2Mail can still cancel the job before
 * the cutoff. The customer has already paid Modern Mail.
 */
export async function submitPaidMailOrder(campaignId: string): Promise<PrintMailActionResult> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) return missing(campaignId)
  if (campaign.payment?.status !== "paid") {
    return { campaign, issues: ["This mailing has not been paid, so it was not sent."] }
  }
  const order = campaign.mailOrder
  if (!order?.jobId) return { campaign, issues: ["There is no mailing ready to send."] }
  if (order.submitted) return { campaign, issues: [] }
  return runOrder(campaign, [], order, {
    submit: true,
    customerTotalLabel: campaign.payment.totalLabel,
    billingType: "Invoice",
  })
}

export async function continuePrintMailTest(campaignId: string): Promise<PrintMailActionResult> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) return missing(campaignId)
  const blocked = guard(campaign)
  if (blocked) return { campaign, issues: [blocked] }
  if (!campaign.mailOrder?.addressListId && !campaign.mailOrder?.documentId) {
    return { campaign, issues: ["There is no order to continue."] }
  }
  return runOrder(campaign, [], campaign.mailOrder, { submit: false })
}

export async function refreshPrintMailStatus(campaignId: string): Promise<PrintMailActionResult> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) return missing(campaignId)
  const order = campaign.mailOrder
  if (!order) return { campaign, issues: [] }

  try {
    const { client } = clientFromEnv()
    if (!order.jobId && order.addressListId) {
      const list = await client.getAddressList(order.addressListId)
      const next: MailOrderRecord = {
        ...order,
        addressListStatus: list.status,
        resultDescription: list.description || order.resultDescription,
        lastPolledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        error: undefined,
      }
      const saved = await repository.saveMailOrder(campaignId, next)
      return { campaign: saved, issues: [] }
    }
    if (!order.jobId) return { campaign, issues: [] }
    const refreshed = await refreshClick2MailOrder({ client, order })
    const saved = await repository.saveMailOrder(campaignId, refreshed)
    return { campaign: saved, issues: refreshed.error ? [refreshed.error] : [] }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status check failed."
    return { campaign, issues: [message] }
  }
}

function missing(campaignId: string): PrintMailActionResult {
  throw new Error(`Campaign ${campaignId} not found`)
}

function reusableOrder(campaign: Campaign): MailOrderRecord | undefined {
  const order = campaign.mailOrder
  if (!order || order.submitted) return undefined
  if (campaign.payment?.status === "paid" && campaign.payment.orderId === order.id) return undefined
  return order
}

function guard(campaign: Campaign): string | null {
  if (!isAtOrPastStatus(campaign.status, "creative_approved") || !campaign.mailPiece) {
    return "Approve the postcard before sending a print test."
  }
  try {
    assertClick2MailCallable(loadClick2MailConfig())
  } catch (error) {
    return error instanceof Error ? error.message : "Click2Mail is not available."
  }
  return null
}

function clientFromEnv() {
  const config = loadClick2MailConfig()
  assertClick2MailCallable(config)
  return { config, client: createClick2MailClient({ config }) }
}

async function runOrder(
  campaign: Campaign,
  recipients: readonly Recipient[],
  existing: MailOrderRecord | undefined,
  options: { submit: boolean; customerTotalLabel?: string; billingType?: string }
): Promise<PrintMailActionResult> {
  const { config, client } = clientFromEnv()
  let artwork: MailOrderRecord["artwork"] = existing?.artwork ?? "type-plate"
  let pdf: Uint8Array<ArrayBufferLike> = new Uint8Array()

  if (!existing?.documentId) {
    try {
      const uploaded = await loadApprovedUploadPdf(campaign)
      if (uploaded) {
        pdf = uploaded
        artwork = "uploaded-design"
      } else {
        const photo = await loadFinalPostcardPhoto(campaign)
        const templateId = campaign.mailPiece?.spec.layoutHints?.templateId
        const paletteId = campaign.mailPiece?.spec.layoutHints?.verticalPalette
        const rendered = isPostcardTemplate(templateId)
          ? await renderTemplatedPostcardPdf({
              copy: printCopy(campaign),
              templateId,
              paletteId: isVerticalPalette(paletteId) ? paletteId : undefined,
              image: photo ?? undefined,
            })
          : await renderPostcardPrintPdf({
              copy: printCopy(campaign),
              image: photo ?? undefined,
              plateColor: plateFromSpec(campaign.mailPiece?.spec),
            })
        pdf = rendered.bytes
        artwork = rendered.artwork
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The print file could not be built."
      return { campaign, issues: [message] }
    }
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")
  const order = await placeClick2MailOrder({
    client,
    config,
    pdf,
    recipients,
    postcardSize: "5x8",
    documentName: `mm-${campaign.id.slice(0, 8)}-${stamp}`,
    addressListName: `mm-${campaign.id.slice(0, 8)}-${stamp}`,
    returnAddress: returnAddressFor(campaign),
    artwork,
    submit: options.submit,
    customerTotalLabel: options.customerTotalLabel,
    productOverrides: options.billingType ? { billingType: options.billingType } : undefined,
    proof: true,
    existing,
    pollTimeoutMs: 20_000,
  })
  const saved = await repository.saveMailOrder(campaign.id, order)
  return { campaign: saved, issues: order.error ? [order.error] : [] }
}

function oneRecipient(input: {
  first: string
  last: string
  address1: string
  address2?: string
  city: string
  state: string
  zip: string
}): { recipients: Recipient[]; errors: string[] } {
  const parsed = normalizeRecipient(input, 1)
  return {
    recipients: parsed.recipient ? [parsed.recipient] : [],
    errors: parsed.errors,
  }
}

function printCopy(campaign: Campaign): PostcardPrintCopy {
  const spec = campaign.mailPiece?.spec ?? {}
  const identity = postcardIdentityFromBrief(campaign.brief)
  const contact = resolveStudioContact(spec, identity)
  const address = campaign.brief.businessInfo?.address?.trim()
  return {
    headline: spec.headline,
    body: spec.body,
    offer: spec.offer,
    callToAction: spec.callToAction,
    businessName: contact.businessName,
    phone: contact.phone,
    website: contact.website ? displayWebsite(contact.website) : undefined,
    qrPayload: contact.qrPayload ?? undefined,
    returnLines: address ? [address] : [],
    disclaimer: medicareDisclaimerFor(campaign.brief) ?? undefined,
    complianceMark: attorneyAdMark([
      campaign.brief.goal,
      campaign.brief.offer,
      campaign.brief.audience?.description,
      campaign.brief.businessInfo?.name,
      spec.headline,
      spec.body,
      spec.offer,
    ].filter(Boolean).join(" ")) ?? undefined,
  }
}

function returnAddressFor(campaign: Campaign): ReturnAddress {
  return returnAddressFromBusiness(campaign.brief.businessInfo)
}

function plateFromSpec(spec: CreativeSpec | undefined): [number, number, number] | undefined {
  const match = spec?.palette?.[0]?.trim().match(/^#([0-9a-fA-F]{6})$/)
  if (!match) return undefined
  const hex = match[1] ?? ""
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ]
}
