import { randomUUID } from "crypto"

import { eddmPaymentBlockedMessage } from "@/lib/fulfillment/payment-clearance"
import { eddmPostageEstimate } from "@/lib/eddm/postage"
import { isEddmSize, type EddmSize } from "@/lib/eddm/geometry"
import {
  eddmRouteCode,
  summarizeSelection,
  type EddmCoverage,
  type EddmRouteSnapshot,
} from "@/lib/eddm/routes"

import type { Click2MailConfig, Click2MailProductOptions } from "./config"
import type { MailOrderRecord } from "./order-record"
import type { Click2MailClient, EddmMailerInfo } from "./types"

/**
 * Staff answer, Oct 26, 2026: full-service Every Door includes the
 * Click2Mail permit. Their Postman sample uses a different mail class.
 * Override with C2M_EDDM_MAIL_CLASS if staging rejects this string.
 */
export const EDDM_FULL_SERVICE_MAIL_CLASS = "PM EDDM (Full Service): includes the Click2Mail permit"
export const EDDM_LAYOUT = "We Prep and Mail"

export function eddmDocumentClass(size: EddmSize, env: NodeJS.ProcessEnv = process.env): string {
  const configured = size === "6.5x9" ? env.C2M_EDDM_CLASS_6_5X9 : env.C2M_EDDM_CLASS_6_25X11
  const trimmed = configured?.trim()
  if (trimmed) return trimmed
  return size === "6.5x9" ? "EDDM Mailer 6.5 x 9" : "EDDM Mailer 6.25 x 11"
}

export function eddmJobProduct(size: EddmSize, env: NodeJS.ProcessEnv = process.env): Click2MailProductOptions {
  return {
    documentFormat: "PDF",
    documentClass: eddmDocumentClass(size, env),
    layout: env.C2M_EDDM_LAYOUT?.trim() || EDDM_LAYOUT,
    productionTime: env.C2M_EDDM_PRODUCTION_TIME?.trim() || "Next Day",
    envelope: " ",
    color: env.C2M_EDDM_COLOR?.trim() || "Full Color",
    paperType: env.C2M_EDDM_PAPER_TYPE?.trim() || "White Matte",
    printOption: env.C2M_EDDM_PRINT_OPTION?.trim() || "Printing both sides",
    mailClass: env.C2M_EDDM_MAIL_CLASS?.trim() || EDDM_FULL_SERVICE_MAIL_CLASS,
    addressMappingId: "",
    billingType: env.C2M_EDDM_BILLING_TYPE?.trim() || "Invoice",
  }
}

export function eddmJobTemplateName(env: NodeJS.ProcessEnv = process.env): string {
  return env.C2M_EDDM_JOB_TEMPLATE?.trim() ?? ""
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
  /** When set, the job starts from a Click2Mail job template instead of raw product options. */
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
  const product = eddmJobProduct(input.size, env)
  const templateName = input.jobTemplateName ?? eddmJobTemplateName(env)
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
          documentClass: product.documentClass,
          layout: product.layout,
          paperType: product.paperType,
          printOption: product.printOption,
          mailClass: product.mailClass,
          productionTime: product.productionTime,
          color: product.color,
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

    if (!order.jobId) {
      const job = templateName
        ? await input.client.createJobFromTemplate({
            templateName,
            documentId: order.documentId,
            quantity: summary.pieces,
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
      order.updatedAt = now()
    }

    if (!order.eddm?.prepared) {
      await input.client.setEddmInfo(order.jobId, input.mailer)
      for (const route of input.routes) {
        const pieces = input.coverage === "residential" ? route.residential : route.residential + route.business
        await input.client.setEddmRoute(order.jobId, {
          poName: route.postOfficeName,
          route: eddmRouteCode(route),
          postalCode: route.zip,
          totalPieces: pieces,
        })
      }
      const deliveryType = eddmDeliveryType(input.coverage, env)
      for (const office of summary.postOffices) {
        await input.client.setEddmPostOffice(order.jobId, {
          name: office.name,
          address: office.address,
          city: office.city,
          state: office.state,
          zip: office.zip,
          hours: office.hours,
          totalPieces: office.totalPieces,
          deliveryType,
          routeType: office.routeType,
        })
      }
      order.eddm = {
        size: input.size,
        routeCount: input.routes.length,
        postOfficeCount: summary.postOffices.length,
        prepared: true,
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
      const submitted = await input.client.submitJob(order.jobId, product.billingType)
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
  if (!isEddmSize(input.size)) {
    return "Choose a 6.5×9 or 6.25×11 card."
  }
  return limitMessages[0] ?? null
}
