import { createNeonExecutor, postgresUrl, type SqlExecutor } from "@/lib/storage/document-store"

import { ensureOpsTables } from "./schema"

const hits = new Map<string, number[]>()
const ready = new WeakMap<SqlExecutor, Promise<void>>()

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests. Wait a moment and try again.")
    this.name = "RateLimitError"
  }
}

/**
 * Shared window when Postgres is configured. Memory when it is not,
 * which is the local and test default.
 */
export async function consumeRate(
  key: string,
  limit = 30,
  windowMs = 60_000,
  now = Date.now(),
  executor?: SqlExecutor
): Promise<{ ok: true } | { ok: false }> {
  if (!executor && !postgresUrl()) return memoryConsume(key, limit, windowMs, now)
  const sql = executor ?? neon()
  await ensure(sql)
  const since = now - windowMs
  const rows = await sql.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM rate_events WHERE key = $1 AND at_ms > $2`,
    [key, since]
  )
  const count = Number(rows[0]?.count ?? 0)
  if (count >= limit) return { ok: false }
  await sql.query(`INSERT INTO rate_events (key, at_ms) VALUES ($1, $2)`, [key, now])
  return { ok: true }
}

export async function requireRate(key: string, executor?: SqlExecutor): Promise<void> {
  if (!(await consumeRate(key, 30, 60_000, Date.now(), executor)).ok) throw new RateLimitError()
}

function memoryConsume(key: string, limit: number, windowMs: number, now: number): { ok: true } | { ok: false } {
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs)
  if (recent.length >= limit) {
    hits.set(key, recent)
    return { ok: false }
  }
  recent.push(now)
  hits.set(key, recent)
  return { ok: true }
}

function neon(): SqlExecutor {
  const url = postgresUrl()
  if (!url) throw new Error("Postgres is not configured.")
  return createNeonExecutor(url)
}

function ensure(sql: SqlExecutor): Promise<void> {
  let pending = ready.get(sql)
  if (!pending) {
    pending = ensureOpsTables(sql)
    ready.set(sql, pending)
  }
  return pending
}
