import { createHash, randomUUID } from "node:crypto"
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import type { MailApproval } from "./approval"

export type MailJobState = "awaiting_payment" | "payment_unknown" | "paid" | "held"

export interface MailJob {
  id: string
  ownerId: string
  campaignId: string
  approvalId: string
  idempotencyKey: string
  currency: "usd"
  amountCents: number
  listHash: string
  listCount: number
  proofHash: string
  state: MailJobState
  appliedEventIds: string[]
  heldReason?: string
  createdAt: string
  updatedAt: string
}

export class JourneyConflict extends Error {
  readonly status = 409
}

const SAFE_KEY = /^[A-Za-z0-9_-]{8,80}$/

export function assertIdempotencyKey(key: string): void {
  if (!SAFE_KEY.test(key)) {
    throw new JourneyConflict("Use a new checkout key of letters, numbers, or dashes.")
  }
}

export function jobFromApproval(approval: MailApproval, idempotencyKey: string, nowIso: string): MailJob {
  assertIdempotencyKey(idempotencyKey)
  return {
    id: randomUUID(),
    ownerId: approval.ownerId,
    campaignId: approval.campaignId,
    approvalId: approval.id,
    idempotencyKey,
    currency: approval.quote.currency,
    amountCents: approval.quote.totalCents,
    listHash: approval.listHash,
    listCount: approval.listCount,
    proofHash: approval.proofHash,
    state: "awaiting_payment",
    appliedEventIds: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  }
}

export interface JourneyStore {
  saveApproval(approval: MailApproval): Promise<void>
  getApproval(id: string): Promise<MailApproval | null>
  createJob(job: MailJob): Promise<{ job: MailJob; created: boolean }>
  getJob(id: string): Promise<MailJob | null>
  saveJob(job: MailJob): Promise<void>
  saveListReview(review: StoredListReview): Promise<void>
  getListReview(campaignId: string, ownerId: string): Promise<StoredListReview | null>
}

export interface StoredListReview {
  campaignId: string
  ownerId: string
  csv: string
  createdAt: string
  jobId?: string
}

function safeFile(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(value)) {
    throw new Error("That id cannot be stored as a file name.")
  }
  return value
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf-8")) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

/**
 * File store. The idempotency name is published with link(2) only after the
 * job file is fully written, so a concurrent retry reads the winner.
 */
export function createFileJourneyStore(directory: string): JourneyStore {
  const jobFile = (id: string) => path.join(directory, `job-${safeFile(id)}.json`)
  const approvalFile = (id: string) => path.join(directory, `approval-${safeFile(id)}.json`)
  const idemFile = (key: string) => path.join(directory, `idem-${safeFile(key)}.json`)
  const reviewFile = (campaignId: string, ownerId: string) => {
    const name = createHash("sha256").update(`${ownerId}\n${campaignId}`).digest("hex").slice(0, 40)
    return path.join(directory, `review-${name}.json`)
  }

  return {
    async saveApproval(approval) {
      await mkdir(directory, { recursive: true })
      await writeFile(approvalFile(approval.id), JSON.stringify(approval), "utf-8")
    },
    async getApproval(id) {
      return readJson<MailApproval>(approvalFile(id))
    },
    async createJob(job) {
      await mkdir(directory, { recursive: true })
      const pointer = idemFile(job.idempotencyKey)
      const existingPointer = await readJson<{ id: string }>(pointer)
      if (existingPointer) {
        const existing = await readJson<MailJob>(jobFile(existingPointer.id))
        if (!existing) throw new JourneyConflict("The earlier checkout record is missing.")
        assertSameCheckout(existing, job)
        return { job: existing, created: false }
      }
      await writeFile(jobFile(job.id), JSON.stringify(job), "utf-8")
      const temp = path.join(directory, `.tmp-${job.id}`)
      await writeFile(temp, JSON.stringify({ id: job.id }), "utf-8")
      try {
        await link(temp, pointer)
        return { job, created: true }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
        const winner = await readJson<{ id: string }>(pointer)
        if (!winner) throw new JourneyConflict("The checkout key could not be read.")
        const existing = await readJson<MailJob>(jobFile(winner.id))
        if (!existing) throw new JourneyConflict("The earlier checkout record is missing.")
        assertSameCheckout(existing, job)
        return { job: existing, created: false }
      } finally {
        await unlink(temp).catch(() => undefined)
      }
    },
    async getJob(id) {
      return readJson<MailJob>(jobFile(id))
    },
    async saveJob(job) {
      await mkdir(directory, { recursive: true })
      const current = await readJson<MailJob>(jobFile(job.id))
      if (!current) throw new JourneyConflict("That order does not exist.")
      if (current.ownerId !== job.ownerId) throw new JourneyConflict("That order does not exist.")
      await writeFile(jobFile(job.id), JSON.stringify(job), "utf-8")
    },
    async saveListReview(review) {
      await mkdir(directory, { recursive: true })
      await writeFile(reviewFile(review.campaignId, review.ownerId), JSON.stringify(review), "utf-8")
    },
    async getListReview(campaignId, ownerId) {
      return readJson<StoredListReview>(reviewFile(campaignId, ownerId))
    },
  }
}

function assertSameCheckout(existing: MailJob, incoming: MailJob): void {
  const same =
    existing.ownerId === incoming.ownerId &&
    existing.campaignId === incoming.campaignId &&
    existing.approvalId === incoming.approvalId &&
    existing.amountCents === incoming.amountCents &&
    existing.currency === incoming.currency
  if (!same) {
    throw new JourneyConflict("That checkout key was already used for a different order.")
  }
}

export function defaultJourneyDirectory(): string {
  return path.join(process.cwd(), ".data", "mail-journey")
}

let singleton: JourneyStore | null = null

export function getJourneyStore(): JourneyStore {
  if (!singleton) singleton = createFileJourneyStore(defaultJourneyDirectory())
  return singleton
}
