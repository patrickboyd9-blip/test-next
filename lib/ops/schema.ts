import { isBenignCreateRace, type SqlExecutor } from "@/lib/storage/document-store"

/**
 * One definition for the append-only ops tables.
 * The app creates them on first use. scripts/migrate-ops-tables.ts
 * creates them up front. Both paths run these statements one at a time.
 * Neon does not accept several statements in one query.
 */
export const AUDIT_EVENTS_DDL = `CREATE TABLE IF NOT EXISTS audit_events (
  id text PRIMARY KEY,
  at timestamptz NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  subject_id text NOT NULL,
  before jsonb,
  after jsonb
)`

export const RATE_EVENTS_DDL = `CREATE TABLE IF NOT EXISTS rate_events (
  id bigserial PRIMARY KEY,
  key text NOT NULL,
  at_ms bigint NOT NULL
)`

export const OPS_DDL = [AUDIT_EVENTS_DDL, RATE_EVENTS_DDL] as const

const ready = new WeakMap<SqlExecutor, Promise<void>>()

async function applyOpsTables(sql: SqlExecutor): Promise<void> {
  for (const statement of OPS_DDL) {
    try {
      await sql.query(statement)
    } catch (error) {
      if (!isBenignCreateRace(error)) throw error
    }
  }
}

/**
 * Creates both tables when they are missing.
 * A concurrent create on Neon can raise 23505 even with IF NOT EXISTS.
 * That race is ignored. Any other error is retried on the next call.
 */
export function ensureOpsTables(sql: SqlExecutor): Promise<void> {
  let pending = ready.get(sql)
  if (!pending) {
    pending = applyOpsTables(sql).catch((error: unknown) => {
      ready.delete(sql)
      throw error
    })
    ready.set(sql, pending)
  }
  return pending
}
