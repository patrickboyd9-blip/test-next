import { randomUUID } from "crypto"

import {
  addressListPhase,
  mergeProduct,
  type Click2MailConfig,
} from "./config"
import { placeholderCostLabel } from "./cost"
import type { MailOrderRecord } from "./order-record"
import type { Recipient } from "./recipients"
import type { Click2MailClient, ReturnAddress } from "./types"

export interface PlaceOrderInput {
  client: Click2MailClient
  config: Click2MailConfig
  pdf: Uint8Array<ArrayBufferLike>
  recipients: readonly Recipient[]
  documentName: string
  addressListName: string
  returnAddress?: ReturnAddress
  productOverrides?: Partial<Click2MailConfig["product"]>
  artwork: MailOrderRecord["artwork"]
  submit: boolean
  proof: boolean
  existing?: MailOrderRecord
  sleep?: (ms: number) => Promise<void>
  clock?: () => number
  now?: () => string
  pollIntervalMs?: number
  pollTimeoutMs?: number
}

export async function placeClick2MailOrder(input: PlaceOrderInput): Promise<MailOrderRecord> {
  const now = input.now ?? (() => new Date().toISOString())
  const product = mergeProduct(input.config.product, input.productOverrides)
  const existing = input.existing
  const order: MailOrderRecord = existing
    ? { ...existing, error: undefined, updatedAt: now() }
    : {
        id: randomUUID(),
        mode: input.config.environment === "prod" ? "production" : "test",
        environment: input.config.environment,
        pieceCount: input.recipients.length,
        estimatedCostLabel: placeholderCostLabel(input.recipients.length),
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
        createdAt: now(),
        updatedAt: now(),
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

    if (!order.addressListId) {
      const list = await input.client.createAddressList({
        name: input.addressListName,
        mappingId: product.addressMappingId,
        recipients: input.recipients,
      })
      order.addressListId = list.id
      order.addressListStatus = list.status
      order.resultDescription = list.description
      order.updatedAt = now()
    }

    const ready = await waitForAddressList({
      client: input.client,
      config: input.config,
      id: order.addressListId,
      sleep: input.sleep,
      clock: input.clock,
      intervalMs: input.pollIntervalMs,
      timeoutMs: input.pollTimeoutMs,
    })
    order.addressListStatus = ready.status
    order.resultDescription = ready.description
    order.updatedAt = now()
    if (addressListPhase(ready.status, input.config) !== "ready") {
      order.error = `The address list is still processing (status ${ready.status}). Continue the test once Click2Mail marks it ready.`
      return order
    }

    if (!order.jobId) {
      const job = await input.client.createJob({
        documentId: order.documentId,
        addressId: order.addressListId,
        product,
        returnAddress: input.returnAddress,
        quantity: input.recipients.length > 0 ? input.recipients.length : order.pieceCount,
      })
      order.jobId = job.id
      order.jobStatus = job.jobStatus || "EDITING"
      order.resultCode = job.status ?? undefined
      order.resultDescription = job.description
      order.updatedAt = now()
    }

    if (input.proof && !order.proofId) {
      const proof = await input.client.createProof(order.jobId)
      order.proofId = proof.id || undefined
      order.proofDescription = proof.description
      order.updatedAt = now()
    }

    if (input.submit && !order.submitted) {
      // Staging /credit can stay 0.00 after a purchase that returned Success.
      // User Credit submit still succeeds there, so this path does not read or block on balance.
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

export async function waitForAddressList(input: {
  client: Click2MailClient
  config: Click2MailConfig
  id: string
  sleep?: (ms: number) => Promise<void>
  clock?: () => number
  intervalMs?: number
  timeoutMs?: number
}) {
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const clock = input.clock ?? Date.now
  const intervalMs = input.intervalMs ?? 2_000
  const timeoutMs = input.timeoutMs ?? 20_000
  const started = clock()
  let latest = await input.client.getAddressList(input.id)
  for (let polls = 0; polls < 30 && addressListPhase(latest.status, input.config) === "pending"; polls += 1) {
    if (clock() - started >= timeoutMs) return latest
    await sleep(intervalMs)
    latest = await input.client.getAddressList(input.id)
  }
  return latest
}

export async function refreshClick2MailOrder(input: {
  client: Click2MailClient
  order: MailOrderRecord
  now?: () => string
}): Promise<MailOrderRecord> {
  const now = input.now ?? (() => new Date().toISOString())
  const order: MailOrderRecord = { ...input.order, updatedAt: now(), lastPolledAt: now() }
  if (!order.jobId) return order
  try {
    const job = await input.client.getJob(order.jobId)
    order.jobStatus = job.jobStatus || order.jobStatus
    order.resultCode = job.status ?? order.resultCode
    order.resultDescription = job.description || order.resultDescription
    if (order.submitted) {
      try {
        const tracking = await input.client.getTracking(order.jobId, "IMB")
        order.trackingPieceCount = tracking.pieces.length
      } catch {
        order.trackingPieceCount = order.trackingPieceCount ?? 0
      }
    }
    order.error = undefined
    return order
  } catch (error) {
    order.error = error instanceof Error ? error.message : "Status check failed."
    return order
  }
}
