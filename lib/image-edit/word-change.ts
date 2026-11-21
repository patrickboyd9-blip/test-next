import { randomUUID } from "node:crypto"

import { ensureOpsTables } from "@/lib/ops/schema"
import { createNeonExecutor, postgresUrl, type SqlExecutor } from "@/lib/storage/document-store"

import { utcDay } from "./spend"

/** Free word changes on one account before a card is required. Billing is not built. */
export const FREE_WORD_CHANGES = 5

export type WordChangeBlock = "allowance" | "account-day" | "site-day"

export function decideWordChange(input: {
  paid: boolean
  accountTotal: number
  accountToday: number
  siteToday: number
  freeAllowance: number
  accountDaily: number
  siteDaily: number
}): { ok: true } | { ok: false; reason: WordChangeBlock } {
  if (input.siteToday >= input.siteDaily) return { ok: false, reason: "site-day" }
  if (input.accountToday >= input.accountDaily) return { ok: false, reason: "account-day" }
  if (!input.paid && input.accountTotal >= input.freeAllowance) return { ok: false, reason: "allowance" }
  return { ok: true }
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 1) return fallback
  return Math.floor(value)
}

export function wordChangeFreeAllowance(env: NodeJS.ProcessEnv = process.env): number {
  return positiveInt(env.WORD_CHANGE_FREE_ALLOWANCE, FREE_WORD_CHANGES)
}

export function wordChangeAccountDaily(env: NodeJS.ProcessEnv = process.env): number {
  return positiveInt(env.WORD_CHANGE_ACCOUNT_DAILY_CAP, 20)
}

export function wordChangeSiteDaily(env: NodeJS.ProcessEnv = process.env): number {
  return positiveInt(env.WORD_CHANGE_SITE_DAILY_CAP, 300)
}

/** Stub. Card payments are not built, so this stays off unless an operator turns it on. */
export function wordChangeIsPaid(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.WORD_CHANGE_PAID?.trim().toLowerCase() === "true"
}

export interface WordChangeReservation {
  ok: true
  id: string
}

export interface WordChangeLedger {
  reserve(input: {
    userId: string
    now: Date
    paid: boolean
    freeAllowance: number
    accountDaily: number
    siteDaily: number
  }): Promise<WordChangeReservation | { ok: false; reason: WordChangeBlock }>
  release(id: string): Promise<void>
}

interface WordChangeRow {
  id: string
  day: string
  userId: string
}

export function memoryWordChangeLedger(rows: WordChangeRow[] = []): WordChangeLedger {
  return {
    async reserve(input) {
      const day = utcDay(input.now)
      const decision = decideWordChange({
        paid: input.paid,
        accountTotal: rows.filter((row) => row.userId === input.userId).length,
        accountToday: rows.filter((row) => row.userId === input.userId && row.day === day).length,
        siteToday: rows.filter((row) => row.day === day).length,
        freeAllowance: input.freeAllowance,
        accountDaily: input.accountDaily,
        siteDaily: input.siteDaily,
      })
      if (!decision.ok) return decision
      const id = randomUUID()
      rows.push({ id, day, userId: input.userId })
      return { ok: true, id }
    },
    async release(id) {
      const index = rows.findIndex((row) => row.id === id)
      if (index >= 0) rows.splice(index, 1)
    },
  }
}

export function postgresWordChangeLedger(sql: SqlExecutor): WordChangeLedger {
  return {
    async reserve(input) {
      await ensureOpsTables(sql)
      const day = utcDay(input.now)
      const before = await wordChangeCounts(sql, input.userId, day)
      const decision = decideWordChange({ ...before, ...input })
      if (!decision.ok) return decision
      const id = randomUUID()
      await sql.query(
        `INSERT INTO word_change_edits (id, at, day, user_id) VALUES ($1, $2, $3, $4)`,
        [id, input.now.toISOString(), day, input.userId]
      )
      const after = await wordChangeCounts(sql, input.userId, day)
      const overSite = after.siteToday > input.siteDaily
      const overAccount = after.accountToday > input.accountDaily
      const overFree = !input.paid && after.accountTotal > input.freeAllowance
      if (overSite || overAccount || overFree) {
        await sql.query(`DELETE FROM word_change_edits WHERE id = $1`, [id])
        return {
          ok: false,
          reason: overSite ? "site-day" : overAccount ? "account-day" : "allowance",
        }
      }
      return { ok: true, id }
    },
    async release(id) {
      await ensureOpsTables(sql)
      await sql.query(`DELETE FROM word_change_edits WHERE id = $1`, [id])
    },
  }
}

async function wordChangeCounts(
  sql: SqlExecutor,
  userId: string,
  day: string
): Promise<{ accountTotal: number; accountToday: number; siteToday: number }> {
  const rows = await sql.query<{ account_total: number; account_today: number; site_today: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE user_id = $1)::int AS account_total,
       COUNT(*) FILTER (WHERE user_id = $1 AND day = $2)::int AS account_today,
       COUNT(*) FILTER (WHERE day = $2)::int AS site_today
     FROM word_change_edits`,
    [userId, day]
  )
  const row = rows[0]
  return {
    accountTotal: Number(row?.account_total ?? 0),
    accountToday: Number(row?.account_today ?? 0),
    siteToday: Number(row?.site_today ?? 0),
  }
}

let shared: WordChangeLedger | null = null

export function wordChangeLedger(): WordChangeLedger {
  if (shared) return shared
  const url = postgresUrl()
  shared = url ? postgresWordChangeLedger(createNeonExecutor(url)) : memoryWordChangeLedger()
  return shared
}

/** Tests replace the process ledger. Pass null to build the real one again. */
export function useWordChangeLedgerForTests(ledger: WordChangeLedger | null): void {
  shared = ledger
}
