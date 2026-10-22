import { randomUUID } from "crypto"

import { eddmPostageEstimate } from "@/lib/eddm/postage"
import { isEddmSize, type EddmSize } from "@/lib/eddm/geometry"
import { summarizeSelection, type EddmCoverage, type EddmRouteSnapshot } from "@/lib/eddm/routes"

import type { Click2MailConfig, Click2MailProductOptions } from "./config"
import { postcardJobProduct } from "./products"
import type { MailOrderRecord } from "./order-record"
import type { Click2MailClient, EddmMailerInfo } from "./types"

/**
 * Product names are not in Click2Mail's public EDDM reference.
 * Override them when Click2Mail confirms the strings. Until then the
 * staging submit flag stays off.
 */
export function eddmDocumentClass(size: EddmSize, env: NodeJS.ProcessEnv = process.env): string {
  const configured =
    size === "6.5x9" ? env.C2M_EDDM_CLASS_6_5X9 : env.C2M_EDDM_CLASS_6_25X11
  const trimmed = configured?.trim()
  if (trimmed) return trimmed
  return size === "6.5x9" ? "Postcard 6.5 x 9" : "Postcard 6.25 x 11"
}

export function eddmJobProduct(size: EddmSize, env: NodeJS.ProcessEnv = process.env): Click2MailProductOptions {
  const base = postcardJobProduct("5x8")
  return {
    ...base,
    documentClass: eddmDocumentClass(size, env),
    mailClass: env.C2M_EDDM_MAIL_CLASS?.trim() || "Standard Mail",
  }
}

export interface PlaceEddmOrderInput {
  client: Click2MailClient
  config: Click2MailConfig
  pdf: Uint8Array<ArrayBufferLike>
  size: EddmSize
  coverage: EddmCoverage
  routes: readonly EddmRouteSnapshot[]
  mailer: EddmMailerInfo
  uspsAccountId: string
  /** Must be the staging flag. Production is refused even when this is true. */
  submitEnabled: boolean
  documentName: string
  artwork: MailOrderRecord["artwork"]
  submit: boolean
  proof: boolean
  existing?: MailOrderRecord
  now?: () => string
}

export async function placeEddmOrder(input: PlaceEddmOrderInput): Promise<MailOrderRecord> {
  const now = input.now ?? (() => new Date().toISOString())
  const summary = summarizeSelection(input.routes, input.coverage)
  const postage = eddmPostageEstimate(summary.pieces)
  const product = eddmJobProduct(input.size)
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
      const job = await input.client.createJob({
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
        await input.client.setEddmRoute(order.jobId, {
          poName: route.postOfficeName || `Post office ${route.zip}`,
          route: route.route,
          postalCode: route.zip,
          totalPieces: input.coverage === "residential" ? route.residential : route.residential + route.business,
        })
      }
      for (const office of summary.postOffices) {
        await input.client.setEddmPostOffice(order.jobId, {
          name: office.name,
          address: office.address,
          hours: office.hours,
          totalPieces: office.totalPieces,
        })
      }
      await input.client.updateEddmJob(order.jobId, {
        crid: input.uspsAccountId,
        quantity: summary.pieces,
      })
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
    return "Staging EDDM submit is off until Click2Mail confirms the product names and the USPS account id field. Set C2M_EDDM_SUBMIT=true on staging after that."
  }
  if (!input.uspsAccountId.trim()) {
    return "Add the USPS account id in C2M_EDDM_CRID before a staging Every Door order can be sent."
  }
  if (!isEddmSize(input.size)) {
    return "Choose a 6.5×9 or 6.25×11 card."
  }
  return limitMessages[0] ?? null
}
