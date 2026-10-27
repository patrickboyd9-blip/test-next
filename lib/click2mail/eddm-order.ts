import { randomUUID } from "crypto"

import { eddmPaymentBlockedMessage } from "@/lib/fulfillment/payment-clearance"
import { EDDM_RETAIL_POSTAGE_DOLLARS, eddmPostageEstimate } from "@/lib/eddm/postage"
import { isEddmSize, type EddmSize } from "@/lib/eddm/geometry"
import {
  eddmRouteCode,
  summarizeSelection,
  type EddmCoverage,
  type EddmRouteSnapshot,
} from "@/lib/eddm/routes"

import type { Click2MailConfig, Click2MailProductOptions } from "./config"
import type { MailOrderRecord } from "./order-record"
import { selectEddmProduct, type ProductOptionRow } from "./product-options"
import type { Click2MailClient, EddmMailerInfo } from "./types"
import { eddmCridInvalidMessage, eddmCridMissingMessage, normalizeUspsCrid } from "@/lib/eddm/usps-crid"

/**
 * Billing is User Credit. Invoice is off on this staging account.
 * Product strings are not typed here. A job template supplies them, or
 * GET /productOptions/advanced does. Job 1304272 failed with "Sku not found"
 * when the mail class was typed by hand.
 */
export const EDDM_BILLING_TYPE = "User Credit"

export function eddmBillingType(env: NodeJS.ProcessEnv = process.env): string {
  return env.C2M_EDDM_BILLING_TYPE?.trim() || EDDM_BILLING_TYPE
}

export function isServerCardBilling(value: string): boolean {
  return /credit card|apple pay|google pay|accept\.js|\bcard\b/i.test(value)
}

export function eddmCreditShortMessage(
  balance: number,
  needed: number,
  basis: "job" | "estimate" = "job"
): string {
  const need =
    basis === "estimate"
      ? `Click2Mail did not return a job cost, so this check uses the postage estimate of ${formatDollars(needed)}.`
      : `This order needs at least ${formatDollars(needed)}, including tax, before it can be sent.`
  return `Click2Mail User Credit is ${formatDollars(balance)}. ${need} A credit purchase can say Success without changing the balance. Add credit on the Click2Mail staging account, then try again.`
}

export function eddmJobTemplateName(size: EddmSize, env: NodeJS.ProcessEnv = process.env): string {
  const specific = size === "6.5x9" ? env.C2M_EDDM_JOB_TEMPLATE_6_5X9 : env.C2M_EDDM_JOB_TEMPLATE_6_25X11
  return specific?.trim() || env.C2M_EDDM_JOB_TEMPLATE?.trim() || ""
}

function eddmDeliveryType(coverage: EddmCoverage, env: NodeJS.ProcessEnv): string {
  if (coverage === "residential") return env.C2M_EDDM_DELIVERY_RESIDENTIAL?.trim() || "Residential"
  return env.C2M_EDDM_DELIVERY_ALL?.trim() || "All"
}

export interface PlaceEddmOrderInput {
  client: Click2MailClient
  config: Click2MailConfig
  pdf: Uint8Array<ArrayBufferLike>
  size: EddmSize
  coverage: EddmCoverage
  routes: readonly EddmRouteSnapshot[]
  mailer: EddmMailerInfo
  /** Must be the staging flag. Production is refused even when this is true. */
  submitEnabled: boolean
  /** Customer payment recorded, or the staging operator flag. Unpaid orders make no calls. */
  paymentCleared: boolean
  documentName: string
  artwork: MailOrderRecord["artwork"]
  submit: boolean
  proof: boolean
  /** The customer's USPS CRID. Full Service Every Door is held without it. */
  crid?: string
  /** When set, the job starts from a Click2Mail job template instead of product options. */
  jobTemplateName?: string
  existing?: MailOrderRecord
  now?: () => string
  env?: NodeJS.ProcessEnv
}

export async function placeEddmOrder(input: PlaceEddmOrderInput): Promise<MailOrderRecord> {
  const now = input.now ?? (() => new Date().toISOString())
  const env = input.env ?? process.env
  const summary = summarizeSelection(input.routes, input.coverage)
  const postage = eddmPostageEstimate(summary.pieces)
  const billingType = eddmBillingType(env)
  const templateName = input.jobTemplateName ?? eddmJobTemplateName(input.size, env)
  const existing = input.existing
  const order: MailOrderRecord = existing
    ? { ...existing, error: undefined, updatedAt: now() }
    : {
        id: randomUUID(),
        mode: "test",
        environment: input.config.environment,
        pieceCount: summary.pieces,
        estimatedCostLabel: `${postage.label}: ${postage.amountLabel}. ${postage.detail}`,
        artwork: input.artwork,
        submitted: false,
        product: {
          documentClass: templateName ? templateName : "Click2Mail product options",
          layout: templateName ? "Job template" : "",
          paperType: "",
          printOption: "",
          mailClass: templateName ? "Job template" : "",
          productionTime: "",
          color: "",
        },
        eddm: {
          size: input.size,
          routeCount: summary.routeCount,
          postOfficeCount: summary.postOffices.length,
          prepared: false,
        },
        createdAt: now(),
        updatedAt: now(),
      }

  const blocked = eddmOrderBlock(input, summary.messages)
  if (blocked) {
    order.error = blocked
    order.updatedAt = now()
    return order
  }

  try {
    const rows = await input.client.getAdvancedProductOptions()
    const chosen = selectEddmProduct(rows, input.size, {
      documentClass: configuredDocumentClass(input.size, env),
      mailClass: templateName ? undefined : env.C2M_EDDM_MAIL_CLASS,
    })
    const product = productFromRow(chosen, billingType)
    order.product = templateName
      ? { ...order.product, documentClass: chosen.documentClass, mailClass: "Job template" }
      : {
          documentClass: product.documentClass,
          layout: product.layout,
          paperType: product.paperType,
          printOption: product.printOption,
          mailClass: product.mailClass,
          productionTime: product.productionTime,
          color: product.color,
        }

    if (!order.documentId) {
      const document = await input.client.createDocument({
        documentName: input.documentName,
        documentFormat: product.documentFormat,
        documentClass: product.documentClass,
        fileName: "file.pdf",
        bytes: input.pdf,
      })
      order.documentId = document.id
      order.resultCode = document.status ?? undefined
      order.resultDescription = document.description
      order.updatedAt = now()
    }

    const crid = normalizeUspsCrid(input.crid) ?? ""
    if (!order.jobId) {
      const job = templateName
        ? await input.client.createJobFromTemplate({
            templateName,
            documentId: order.documentId,
            quantity: summary.pieces,
            crid,
          })
        : await input.client.createJob({
            documentId: order.documentId,
            product,
            quantity: summary.pieces,
          })
      order.jobId = job.id
      order.jobStatus = job.jobStatus || "EDITING"
      order.resultCode = job.status ?? undefined
      order.resultDescription = job.description
      if (!templateName) {
        await input.client.updateEddmJob(order.jobId, { crid, quantity: summary.pieces })
      }
      order.eddm = { ...(order.eddm ?? blankEddm(input, summary)), cridSent: true }
      order.updatedAt = now()
    } else if (!order.eddm?.cridSent) {
      await input.client.updateEddmJob(order.jobId, { crid, quantity: summary.pieces })
      order.eddm = { ...(order.eddm ?? blankEddm(input, summary)), cridSent: true }
      order.updatedAt = now()
    }

    if (!order.eddm?.prepared) {
      await input.client.setEddmInfo(order.jobId, input.mailer)
      const deliveryType = eddmDeliveryType(input.coverage, env)
      for (const office of summary.postOffices) {
        await input.client.setEddmPostOffice(order.jobId, {
          name: office.name,
          address: office.address,
          city: office.city,
          state: office.state,
          zip: office.zip,
          phone: office.phone,
          hours: office.hours,
          totalPieces: office.totalPieces,
          deliveryType,
          routeType: office.routeType,
        })
      }
      // Routes are rejected ("not a EDDM job") until a post office is on the job.
      for (const route of input.routes) {
        const pieces = input.coverage === "residential" ? route.residential : route.residential + route.business
        await input.client.setEddmRoute(order.jobId, {
          poName: route.postOfficeName,
          route: eddmRouteCode(route),
          postalCode: route.zip,
          totalPieces: pieces,
        })
      }
      order.eddm = {
        size: input.size,
        routeCount: input.routes.length,
        postOfficeCount: summary.postOffices.length,
        prepared: true,
        cridSent: order.eddm?.cridSent,
        vendorCost: order.eddm?.vendorCost,
      }
      order.updatedAt = now()
    }

    if (input.proof && !order.proofId) {
      const proof = await input.client.createProof(order.jobId)
      order.proofId = proof.id || undefined
      order.proofDescription = proof.description
      order.updatedAt = now()
    }

    if (input.submit && !order.submitted) {
      if (billingType === EDDM_BILLING_TYPE) {
        const postageOnly = Math.round(summary.pieces * EDDM_RETAIL_POSTAGE_DOLLARS * 100) / 100
        let needed = postageOnly
        let basis: "job" | "estimate" = "estimate"
        try {
          const cost = await input.client.getJobCost(order.jobId, billingType)
          needed = cost.total
          basis = "job"
          if (order.eddm) order.eddm = { ...order.eddm, vendorCost: cost.total }
        } catch {
          // Job 1304272 cost $337.92 plus $0.16 tax. Postage is only the fallback.
          needed = postageOnly
          basis = "estimate"
        }
        const credit = await input.client.getCredit()
        if (credit.balance + 0.001 < needed) {
          order.error = eddmCreditShortMessage(credit.balance, needed, basis)
          order.updatedAt = now()
          return order
        }
      }
      const submitted = await input.client.submitJob(order.jobId, billingType)
      order.submitted = true
      order.submittedAt = now()
      order.jobStatus = submitted.jobStatus || order.jobStatus
      order.resultCode = submitted.status ?? undefined
      order.resultDescription = submitted.description
      order.updatedAt = now()
    }

    return order
  } catch (error) {
    order.error = error instanceof Error ? error.message : "Click2Mail request failed."
    order.updatedAt = now()
    return order
  }
}

function eddmOrderBlock(input: PlaceEddmOrderInput, limitMessages: readonly string[]): string | null {
  if (input.config.environment !== "stage") {
    return "Every Door orders stay on Click2Mail staging. Production EDDM is not turned on."
  }
  if (!input.submitEnabled) {
    return "Staging Every Door submit is off. Set C2M_EDDM_SUBMIT=true on Click2Mail staging after the job template is ready."
  }
  if (!input.paymentCleared) {
    return eddmPaymentBlockedMessage()
  }
  if (isServerCardBilling(eddmBillingType(input.env ?? process.env))) {
    return "Card payment is not sent from this server. Every Door uses User Credit on the Click2Mail account."
  }
  if (!isEddmSize(input.size)) {
    return "Choose a 6.5×9 or 6.25×11 card."
  }
  if (!input.crid?.trim()) return eddmCridMissingMessage()
  if (!normalizeUspsCrid(input.crid)) return eddmCridInvalidMessage()
  return limitMessages[0] ?? null
}

function configuredDocumentClass(size: EddmSize, env: NodeJS.ProcessEnv): string | undefined {
  const configured = size === "6.5x9" ? env.C2M_EDDM_CLASS_6_5X9 : env.C2M_EDDM_CLASS_6_25X11
  const trimmed = configured?.trim()
  return trimmed || undefined
}

function productFromRow(row: ProductOptionRow, billingType: string): Click2MailProductOptions {
  return {
    documentFormat: "PDF",
    documentClass: row.documentClass,
    layout: row.layout,
    productionTime: row.productionTime,
    envelope: row.envelope || " ",
    color: row.color,
    paperType: row.paperType,
    printOption: row.printOption,
    mailClass: row.mailClass,
    addressMappingId: "",
    billingType,
  }
}

function blankEddm(
  input: PlaceEddmOrderInput,
  summary: { routeCount: number; postOffices: readonly unknown[] }
): NonNullable<MailOrderRecord["eddm"]> {
  return {
    size: input.size,
    routeCount: summary.routeCount,
    postOfficeCount: summary.postOffices.length,
    prepared: false,
  }
}

function formatDollars(amount: number): string {
  return `$${amount.toFixed(2)}`
}
