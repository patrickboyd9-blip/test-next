import { mkdir, readdir, readFile, writeFile } from "fs/promises"
import path from "path"

import {
  createNeonExecutor,
  postgresUrl,
  type SqlExecutor,
} from "@/lib/storage/document-store"

import type { PaymentRecord, PaymentStatus } from "./types"

export interface PaymentStore {
  get(id: string): Promise<PaymentRecord | null>
  put(payment: PaymentRecord): Promise<void>
  list(): Promise<PaymentRecord[]>
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/

const DDL = `CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)`

const STATUSES = new Set<PaymentStatus>(["pending", "paid", "failed", "cancelled", "refunded"])

export function defaultPaymentDirectory(): string {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "payments")
}

export function createFilePaymentStore(directory: string): PaymentStore {
  return {
    async get(id) {
      if (!SAFE_ID.test(id)) return null
      try {
        const raw = await readFile(path.join(directory, `${id}.json`), "utf-8")
        return parsePayment(JSON.parse(raw) as unknown)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
        throw error
      }
    },
    async put(payment) {
      if (!SAFE_ID.test(payment.id)) throw new Error("Payment id cannot be stored as a file name.")
      await mkdir(directory, { recursive: true })
      await writeFile(path.join(directory, `${payment.id}.json`), JSON.stringify(payment, null, 2), "utf-8")
    },
    async list() {
      let names: string[] = []
      try {
        names = await readdir(directory)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
        throw error
      }
      const payments: PaymentRecord[] = []
      for (const name of names) {
        if (!name.endsWith(".json")) continue
        const payment = await this.get(name.slice(0, -".json".length))
        if (payment) payments.push(payment)
      }
      return payments.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    },
  }
}

export function createPostgresPaymentStore(executor: SqlExecutor): PaymentStore {
  let ensuring: Promise<void> | null = null
  const ensure = (): Promise<void> => {
    if (!ensuring) {
      ensuring = executor
        .query(DDL)
        .then(() => undefined)
        .catch((error: unknown) => {
          ensuring = null
          throw error
        })
    }
    return ensuring
  }
  return {
    async get(id) {
      await ensure()
      const rows = await executor.query<{ data: unknown }>(`SELECT data FROM payments WHERE id = $1`, [id])
      const row = rows[0]
      if (!row) return null
      const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data
      return parsePayment(data)
    },
    async put(payment) {
      await ensure()
      await executor.query(
        `INSERT INTO payments (id, data, created_at)
         VALUES ($1, $2::jsonb, $3::timestamptz)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [payment.id, JSON.stringify(payment), payment.createdAt]
      )
    },
    async list() {
      await ensure()
      const rows = await executor.query<{ data: unknown }>(
        `SELECT data FROM payments ORDER BY created_at DESC`
      )
      return rows
        .map((row) => parsePayment(typeof row.data === "string" ? JSON.parse(row.data) : row.data))
        .filter((payment): payment is PaymentRecord => payment !== null)
    },
  }
}

export function createPaymentStore(options?: { directory?: string; executor?: SqlExecutor }): PaymentStore {
  if (options?.executor) return createPostgresPaymentStore(options.executor)
  if (options?.directory) return createFilePaymentStore(options.directory)
  const url = postgresUrl()
  if (url) return createPostgresPaymentStore(createNeonExecutor(url))
  return createFilePaymentStore(defaultPaymentDirectory())
}

let store: PaymentStore | null = null

export function getPaymentStore(): PaymentStore {
  if (!store) store = createPaymentStore()
  return store
}

export function parsePayment(value: unknown): PaymentRecord | null {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<PaymentRecord>
  if (typeof record.id !== "string" || typeof record.campaignId !== "string" || typeof record.orderId !== "string") {
    return null
  }
  if (!record.status || !STATUSES.has(record.status)) return null
  if (typeof record.amountCents !== "number") return null
  return {
    id: record.id,
    campaignId: record.campaignId,
    orderId: record.orderId,
    status: record.status,
    amountCents: record.amountCents,
    currency: "usd",
    pieceCount: record.pieceCount ?? 0,
    productId: record.productId ?? "",
    mailClass: record.mailClass ?? "",
    perCardLabel: record.perCardLabel ?? "",
    totalLabel: record.totalLabel ?? "",
    stripeCheckoutSessionId: record.stripeCheckoutSessionId,
    stripePaymentIntentId: record.stripePaymentIntentId,
    createdAt: record.createdAt ?? new Date(0).toISOString(),
    updatedAt: record.updatedAt ?? record.createdAt ?? new Date(0).toISOString(),
    paidAt: record.paidAt,
    cancelledAt: record.cancelledAt,
    refundedAt: record.refundedAt,
    refundId: record.refundId,
    failureMessage: record.failureMessage,
    fulfillment: record.fulfillment,
  }
}
