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

import { eddmPaymentBlockedMessage, eddmPaymentCleared } from "@/lib/fulfillment/payment-clearance"

import { assertClick2MailCallable, describePrintMailMode, loadClick2MailConfig } from "./config"
import { createClick2MailClient } from "./client"
import { placeEddmOrder } from "./eddm-order"
import { isEddmSize } from "@/lib/eddm/geometry"
import { eddmAudienceIssue } from "@/lib/eddm/validate"
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
      }
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

  return runOrder(campaign, parsed.recipients, undefined)
}

export async function submitEddmPrintTest(campaignId: string): Promise<PrintMailActionResult> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) return missing(campaignId)
  const blocked = guard(campaign)
  if (blocked) return { campaign, issues: [blocked] }

  const audience = campaign.brief.audience
  const eddm = audience?.eddm
  if (audience?.delivery !== "eddm" || !eddm || !isEddmSize(eddm.size)) {
    return { campaign, issues: ["Choose Every door in an area and a 6.5×9 or 6.25×11 card first."] }
  }
  const text = [campaign.brief.goal, campaign.brief.offer, audience.description, eddm.neighborhood]
    .filter(Boolean)
    .join(" ")
  const issue = eddmAudienceIssue({ text, audience: eddm })
  if (issue) return { campaign, issues: [issue] }

  const mode = describePrintMailMode()
  if (mode.environment !== "stage") {
    return { campaign, issues: ["Every Door orders stay on Click2Mail staging. Production EDDM is not turned on."] }
  }
  const paid = eddmPaymentCleared({
    payment: campaign.payment,
    environment: mode.environment,
    env: process.env,
  })
  if (!paid) {
    return { campaign, issues: [eddmPaymentBlockedMessage()] }
  }
  if (!mode.eddmSubmitEnabled) {
    return {
      campaign,
      issues: [
        mode.credentialsConfigured
          ? "Staging Every Door submit is off. Set C2M_EDDM_SUBMIT=true on Click2Mail staging after the job template is ready."
          : "Click2Mail staging sign-in is not set. Add C2M_STAGE_USERNAME and C2M_STAGE_PASSWORD on the server.",
      ],
    }
  }

  const business = campaign.brief.businessInfo
  const mailer = {
    name: business?.name?.trim() || "",
    organization: business?.name?.trim() || undefined,
    address: business?.street?.trim() || business?.address?.trim() || "",
    city: business?.city?.trim() || "",
    state: business?.state?.trim() || "",
    zip: business?.postalCode?.trim() || "",
    phone: business?.phone?.trim() || campaign.brief.phone,
  }
  if (!mailer.name || !mailer.address || !mailer.city || !mailer.state || !mailer.zip) {
    return { campaign, issues: ["Add the business name and return address before sending an Every Door order."] }
  }

  const { config, client } = clientFromEnv()
  let artwork: MailOrderRecord["artwork"] = "type-plate"
  let pdf: Uint8Array<ArrayBufferLike>
  try {
    const built = await renderEddmPdf(campaign, eddm.size)
    pdf = built.bytes
    artwork = built.artwork
  } catch (error) {
    const message = error instanceof Error ? error.message : "The print file could not be built."
    return { campaign, issues: [message] }
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")
  const order = await placeEddmOrder({
    client,
    config,
    pdf,
    size: eddm.size,
    coverage: eddm.coverage,
    routes: eddm.routes,
    mailer,
    submitEnabled: true,
    paymentCleared: true,
    documentName: `mm-eddm-${campaign.id.slice(0, 8)}-${stamp}`,
    artwork,
    submit: true,
    proof: true,
    existing: campaign.mailOrder?.eddm ? campaign.mailOrder : undefined,
  })
  const saved = await repository.saveMailOrder(campaign.id, order)
  return { campaign: saved, issues: order.error ? [order.error] : [] }
}

export async function continuePrintMailTest(campaignId: string): Promise<PrintMailActionResult> {
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) return missing(campaignId)
  const blocked = guard(campaign)
  if (blocked) return { campaign, issues: [blocked] }
  if (!campaign.mailOrder?.addressListId && !campaign.mailOrder?.documentId) {
    return { campaign, issues: ["There is no staging order to continue."] }
  }
  return runOrder(campaign, [], campaign.mailOrder)
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
  existing: MailOrderRecord | undefined
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
    submit: true,
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

async function renderEddmPdf(campaign: Campaign, size: "6.5x9" | "6.25x11") {
  const uploaded = await loadApprovedUploadPdf(campaign)
  if (uploaded) return { bytes: uploaded, artwork: "uploaded-design" as const }
  const photo = await loadFinalPostcardPhoto(campaign)
  const templateId = campaign.mailPiece?.spec.layoutHints?.templateId
  const paletteId = campaign.mailPiece?.spec.layoutHints?.verticalPalette
  const rendered = await renderTemplatedPostcardPdf({
    copy: printCopy(campaign),
    templateId: isPostcardTemplate(templateId) ? templateId : "neighbor_letter",
    paletteId: isVerticalPalette(paletteId) ? paletteId : undefined,
    size,
    image: photo ?? undefined,
  })
  return { bytes: rendered.bytes, artwork: rendered.artwork }
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
