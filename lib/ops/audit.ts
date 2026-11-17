/**
 * Append-only record of mail actions. App code inserts and reads.
 * It never updates or deletes a row.
 * Postgres when DATABASE_URL or POSTGRES_URL is set. Memory otherwise.
 */

import { randomUUID } from "node:crypto"

import { createNeonExecutor, postgresUrl, type SqlExecutor } from "@/lib/storage/document-store"

export const AUDIT_ACTIONS = ["create", "proof", "price", "approve", "send", "charge", "scan"] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export interface AuditEvent {
  id: string
  at: string
  actorId: string
  action: AuditAction
  subjectId: string
  before: unknown
  after: unknown
}

const DDL = `CREATE TABLE IF NOT EXISTS audit_events (
  id text PRIMARY KEY,
  at timestamptz NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  subject_id text NOT NULL,
  before jsonb,
  after jsonb
)`

const memory: AuditEvent[] = []
const ready = new WeakMap<SqlExecutor, Promise<void>>()

export function appendAudit(input: Omit<AuditEvent, "id" | "at">, now = new Date(), executor?: SqlExecutor): Promise<AuditEvent> {
  const event: AuditEvent = {
    id: randomUUID(),
    at: now.toISOString(),
    ...input,
  }
  if (!executor && !postgresUrl()) {
    memory.push(Object.freeze(event))
    return Promise.resolve(event)
  }
  return writeEvent(event, executor)
}

export async function readAudit(executor?: SqlExecutor): Promise<readonly AuditEvent[]> {
  if (!executor && !postgresUrl()) return memory
  const sql = executor ?? neon()
  await ensure(sql)
  const rows = await sql.query<{
    id: string
    at: string | Date
    actor_id: string
    action: AuditAction
    subject_id: string
    before: unknown
    after: unknown
  }>(`SELECT id, at, actor_id, action, subject_id, before, after FROM audit_events`)
  return rows.map(toEvent)
}

export async function approvedBy(actorId: string, subjectId: string, executor?: SqlExecutor): Promise<boolean> {
  if (!executor && !postgresUrl()) {
    return memory.some((event) => event.action === "approve" && event.actorId === actorId && event.subjectId === subjectId)
  }
  const sql = executor ?? neon()
  await ensure(sql)
  const rows = await sql.query(
    `SELECT id FROM audit_events WHERE actor_id = $1 AND subject_id = $2 AND action = 'approve'`,
    [actorId, subjectId]
  )
  return rows.length > 0
}

async function writeEvent(event: AuditEvent, executor?: SqlExecutor): Promise<AuditEvent> {
  const sql = executor ?? neon()
  await ensure(sql)
  await sql.query(
    `INSERT INTO audit_events (id, at, actor_id, action, subject_id, before, after)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
    [event.id, event.at, event.actorId, event.action, event.subjectId, JSON.stringify(event.before), JSON.stringify(event.after)]
  )
  return event
}

function neon(): SqlExecutor {
  const url = postgresUrl()
  if (!url) throw new Error("Postgres is not configured.")
  return createNeonExecutor(url)
}

function ensure(sql: SqlExecutor): Promise<void> {
  let pending = ready.get(sql)
  if (!pending) {
    pending = sql.query(DDL).then(() => undefined)
    ready.set(sql, pending)
  }
  return pending
}

function toEvent(row: {
  id: string
  at: string | Date
  actor_id: string
  action: AuditAction
  subject_id: string
  before: unknown
  after: unknown
}): AuditEvent {
  return {
    id: row.id,
    at: row.at instanceof Date ? row.at.toISOString() : String(row.at),
    actorId: row.actor_id,
    action: row.action,
    subjectId: row.subject_id,
    before: parseJson(row.before),
    after: parseJson(row.after),
  }
}

function parseJson(value: unknown): unknown {
  if (typeof value === "string") return JSON.parse(value) as unknown
  return value
}
