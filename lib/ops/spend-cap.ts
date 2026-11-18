/**
 * Per-account spending cap. The assistant cannot change it.
 * A charge is refused when the full price would pass the cap.
 * An approval is refused when the full price, plus money already
 * approved and not yet paid, would pass the cap.
 */

import { createNeonExecutor, isBenignCreateRace, postgresUrl, type SqlExecutor } from "@/lib/storage/document-store"

import { readAudit, type AuditEvent } from "./audit"

export const DEFAULT_SPENDING_CAP_CENTS = 50_000
const MIN_CAP_CENTS = 100
const MAX_CAP_CENTS = 5_000_000

const CAPS_DDL = `CREATE TABLE IF NOT EXISTS spending_caps (
  user_id text PRIMARY KEY,
  cap_cents integer NOT NULL
)`

const caps = new Map<string, number>()
const ready = new WeakMap<SqlExecutor, Promise<void>>()

export function resetSpendingCaps(): void {
  caps.clear()
}

export interface SpendPosition {
  capCents: number
  spentCents: number
  reservedCents: number
}

export function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export function parseCapDollars(input: string): { ok: true; capCents: number } | { ok: false; message: string } {
  const trimmed = input.trim().replace(/[$,\s]/g, "")
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, message: "Enter a dollar amount, such as 500." }
  }
  const capCents = Math.round(Number(trimmed) * 100)
  if (capCents < MIN_CAP_CENTS) return { ok: false, message: "Set a cap of at least $1." }
  if (capCents > MAX_CAP_CENTS) return { ok: false, message: "Set a cap of $50,000 or less." }
  return { ok: true, capCents }
}

export function spendFromAudit(events: readonly AuditEvent[], actorId: string, exceptSubjectId?: string): { spentCents: number; reservedCents: number } {
  const spentBySubject = new Map<string, number>()
  const approved = new Map<string, { at: string; amount: number }>()
  for (const event of events) {
    if (event.actorId !== actorId) continue
    const after = asRecord(event.after)
    if (!after) continue
    const amount = after.amountCents
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0) continue
    if (event.action === "charge" && after.charged === true) {
      spentBySubject.set(event.subjectId, Math.max(spentBySubject.get(event.subjectId) ?? 0, amount))
    }
    if (event.action === "approve" && after.approved === true) {
      const prev = approved.get(event.subjectId)
      if (!prev || prev.at <= event.at) approved.set(event.subjectId, { at: event.at, amount })
    }
  }
  let spentCents = 0
  for (const amount of spentBySubject.values()) spentCents += amount
  let reservedCents = 0
  for (const [subjectId, approval] of approved) {
    if (subjectId === exceptSubjectId) continue
    if ((spentBySubject.get(subjectId) ?? 0) > 0) continue
    reservedCents += approval.amount
  }
  return { spentCents, reservedCents }
}

export async function readSpendingCap(actorId: string, env: NodeJS.ProcessEnv = process.env): Promise<number> {
  if (!postgresUrl(env)) return caps.get(actorId) ?? DEFAULT_SPENDING_CAP_CENTS
  const sql = neon(env)
  await ensure(sql)
  const rows = await sql.query<{ cap_cents: number }>(`SELECT cap_cents FROM spending_caps WHERE user_id = $1`, [actorId])
  const value = rows[0]?.cap_cents
  return Number.isInteger(value) ? Number(value) : DEFAULT_SPENDING_CAP_CENTS
}

export async function setSpendingCap(actorId: string, capCents: number, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (!Number.isInteger(capCents) || capCents < MIN_CAP_CENTS || capCents > MAX_CAP_CENTS) {
    throw new Error("Set a cap between $1 and $50,000.")
  }
  if (!postgresUrl(env)) {
    caps.set(actorId, capCents)
    return
  }
  const sql = neon(env)
  await ensure(sql)
  await sql.query(
    `INSERT INTO spending_caps (user_id, cap_cents) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET cap_cents = EXCLUDED.cap_cents`,
    [actorId, capCents]
  )
}

export async function spendPosition(actorId: string, exceptSubjectId?: string, executor?: SqlExecutor): Promise<SpendPosition> {
  const [capCents, events] = await Promise.all([readSpendingCap(actorId), readAudit(executor)])
  const totals = spendFromAudit(events, actorId, exceptSubjectId)
  return { capCents, ...totals }
}

export async function approvalFitsCap(
  actorId: string,
  subjectId: string,
  amountCents: number,
  executor?: SqlExecutor
): Promise<{ ok: true; position: SpendPosition } | { ok: false; message: string; position: SpendPosition }> {
  const position = await spendPosition(actorId, subjectId, executor)
  if (position.spentCents + position.reservedCents + amountCents > position.capCents) {
    return {
      ok: false,
      position,
      message: `This total is over your ${formatDollars(position.capCents)} spending cap. Nothing was charged and nothing was mailed.`,
    }
  }
  return { ok: true, position }
}

export async function chargeFitsCap(
  actorId: string,
  amountCents: number,
  executor?: SqlExecutor
): Promise<{ ok: true; position: SpendPosition } | { ok: false; message: string; position: SpendPosition }> {
  const position = await spendPosition(actorId, undefined, executor)
  if (position.spentCents + amountCents > position.capCents) {
    return {
      ok: false,
      position,
      message: "This is over the spending cap. Nothing was charged.",
    }
  }
  return { ok: true, position }
}

function asRecord(value: unknown): { charged?: boolean; approved?: boolean; amountCents?: number } | null {
  if (!value || typeof value !== "object") return null
  return value as { charged?: boolean; approved?: boolean; amountCents?: number }
}

function neon(env: NodeJS.ProcessEnv): SqlExecutor {
  const url = postgresUrl(env)
  if (!url) throw new Error("Postgres is not configured.")
  return createNeonExecutor(url)
}

function ensure(sql: SqlExecutor): Promise<void> {
  let pending = ready.get(sql)
  if (!pending) {
    pending = sql
      .query(CAPS_DDL)
      .then(() => undefined)
      .catch((error: unknown) => {
        if (isBenignCreateRace(error)) return
        ready.delete(sql)
        throw error
      })
    ready.set(sql, pending)
  }
  return pending
}
