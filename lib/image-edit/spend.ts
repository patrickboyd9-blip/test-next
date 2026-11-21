import { randomUUID } from "node:crypto"

import { ensureOpsTables } from "@/lib/ops/schema"
import { createNeonExecutor, postgresUrl, type SqlExecutor } from "@/lib/storage/document-store"

/** Published per-image price for gemini-2.5-flash-image, rounded up to the next cent. */
export const PHOTO_EDIT_CENTS = 4

export interface SpendReservation {
  ok: true
  id: string
}

export interface SpendRefusal {
  ok: false
  reason: "month" | "day"
}

export interface PhotoEditLedger {
  reserve(input: {
    userId: string
    cents: number
    now: Date
    capCents: number
    dailyLimit: number
  }): Promise<SpendReservation | SpendRefusal>
  release(id: string): Promise<void>
}

interface SpendRow {
  id: string
  month: string
  day: string
  userId: string
  cents: number
}

export function monthlyCapCents(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.GEMINI_MONTHLY_CAP_USD ?? "25")
  if (!Number.isFinite(raw) || raw <= 0) return 2500
  return Math.round(raw * 100)
}

export function dailyEditLimit(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.PHOTO_EDIT_DAILY_LIMIT ?? "20")
  if (!Number.isFinite(raw) || raw < 1) return 20
  return Math.floor(raw)
}

export function utcMonth(now: Date): string {
  return now.toISOString().slice(0, 7)
}

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export function memoryPhotoEditLedger(rows: SpendRow[] = []): PhotoEditLedger {
  return {
    async reserve(input) {
      const month = utcMonth(input.now)
      const day = utcDay(input.now)
      const spent = rows.filter((row) => row.month === month).reduce((sum, row) => sum + row.cents, 0)
      if (spent + input.cents > input.capCents) return { ok: false, reason: "month" }
      const count = rows.filter((row) => row.userId === input.userId && row.day === day).length
      if (count >= input.dailyLimit) return { ok: false, reason: "day" }
      const id = randomUUID()
      rows.push({ id, month, day, userId: input.userId, cents: input.cents })
      return { ok: true, id }
    },
    async release(id) {
      const index = rows.findIndex((row) => row.id === id)
      if (index >= 0) rows.splice(index, 1)
    },
  }
}

export function postgresPhotoEditLedger(sql: SqlExecutor): PhotoEditLedger {
  return {
    async reserve(input) {
      await ensureOpsTables(sql)
      const month = utcMonth(input.now)
      const day = utcDay(input.now)
      const spent = await monthCents(sql, month)
      if (spent + input.cents > input.capCents) return { ok: false, reason: "month" }
      const count = await dayCount(sql, input.userId, day)
      if (count >= input.dailyLimit) return { ok: false, reason: "day" }
      const id = randomUUID()
      await sql.query(
        `INSERT INTO photo_edit_spend (id, at, month, day, user_id, cents) VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, input.now.toISOString(), month, day, input.userId, input.cents]
      )
      const spentAfter = await monthCents(sql, month)
      const countAfter = await dayCount(sql, input.userId, day)
      if (spentAfter > input.capCents || countAfter > input.dailyLimit) {
        await sql.query(`DELETE FROM photo_edit_spend WHERE id = $1`, [id])
        return { ok: false, reason: spentAfter > input.capCents ? "month" : "day" }
      }
      return { ok: true, id }
    },
    async release(id) {
      await ensureOpsTables(sql)
      await sql.query(`DELETE FROM photo_edit_spend WHERE id = $1`, [id])
    },
  }
}

async function monthCents(sql: SqlExecutor, month: string): Promise<number> {
  const rows = await sql.query<{ cents: number }>(
    `SELECT COALESCE(SUM(cents), 0)::int AS cents FROM photo_edit_spend WHERE month = $1`,
    [month]
  )
  return Number(rows[0]?.cents ?? 0)
}

async function dayCount(sql: SqlExecutor, userId: string, day: string): Promise<number> {
  const rows = await sql.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM photo_edit_spend WHERE user_id = $1 AND day = $2`,
    [userId, day]
  )
  return Number(rows[0]?.count ?? 0)
}

let shared: PhotoEditLedger | null = null

export function photoEditLedger(): PhotoEditLedger {
  if (shared) return shared
  const url = postgresUrl()
  shared = url ? postgresPhotoEditLedger(createNeonExecutor(url)) : memoryPhotoEditLedger()
  return shared
}

/** Tests replace the process ledger. Pass null to build the real one again. */
export function usePhotoEditLedgerForTests(ledger: PhotoEditLedger | null): void {
  shared = ledger
}
