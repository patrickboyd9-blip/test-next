import assert from "node:assert/strict"
import { test } from "node:test"

import type { SqlExecutor } from "@/lib/storage/document-store"

import { AUDIT_EVENTS_DDL, ensureOpsTables, PHOTO_EDIT_SPEND_DDL, RATE_EVENTS_DDL, WORD_CHANGE_EDITS_DDL } from "./schema"

class ScriptedSql implements SqlExecutor {
  readonly statements: string[] = []
  failCreates = 0
  failMessage = 'duplicate key value violates unique constraint "pg_type_typname_nsp_index"'
  failCode = "23505"

  async query<T extends Record<string, unknown>>(text: string): Promise<T[]> {
    const sql = text.replace(/\s+/g, " ").trim()
    this.statements.push(sql)
    if (sql.startsWith("CREATE TABLE") && this.failCreates > 0) {
      this.failCreates -= 1
      const error = new Error(this.failMessage)
      ;(error as { code?: string }).code = this.failCode
      throw error
    }
    return []
  }
}

test("the ops migration creates the audit log and the rate window", async () => {
  const sql = new ScriptedSql()
  await ensureOpsTables(sql)
  assert.match(sql.statements[0] ?? "", /CREATE TABLE IF NOT EXISTS audit_events/)
  assert.match(sql.statements[1] ?? "", /CREATE TABLE IF NOT EXISTS rate_events/)
  assert.match(sql.statements[2] ?? "", /CREATE TABLE IF NOT EXISTS photo_edit_spend/)
  assert.match(sql.statements[3] ?? "", /CREATE TABLE IF NOT EXISTS word_change_edits/)
  assert.equal(sql.statements.length, 4)
  await ensureOpsTables(sql)
  assert.equal(sql.statements.length, 4)
})

test("a Neon create race is ignored and the next table is still created", async () => {
  const sql = new ScriptedSql()
  sql.failCreates = 1
  await ensureOpsTables(sql)
  const created = sql.statements.join("\n")
  assert.match(created, /audit_events/)
  assert.match(created, /rate_events/)
  assert.match(created, /photo_edit_spend/)
  assert.match(created, /word_change_edits/)
})

test("a real database error is not cached", async () => {
  const sql = new ScriptedSql()
  sql.failCreates = 1
  sql.failMessage = "permission denied"
  sql.failCode = "42501"
  await assert.rejects(() => ensureOpsTables(sql), /permission denied/)
  sql.failCreates = 0
  await ensureOpsTables(sql)
  const created = sql.statements.join("\n")
  assert.match(created, /audit_events/)
  assert.match(created, /rate_events/)
  assert.match(created, /photo_edit_spend/)
  assert.match(created, /word_change_edits/)
})

test("the statements are the ones the app uses", () => {
  assert.match(AUDIT_EVENTS_DDL, /before jsonb/)
  assert.match(RATE_EVENTS_DDL, /at_ms bigint/)
  assert.match(PHOTO_EDIT_SPEND_DDL, /cents integer/)
  assert.match(WORD_CHANGE_EDITS_DDL, /user_id text/)
  assert.doesNotMatch(
    `${AUDIT_EVENTS_DDL}\n${RATE_EVENTS_DDL}\n${PHOTO_EDIT_SPEND_DDL}\n${WORD_CHANGE_EDITS_DDL}`,
    /\bUPDATE\b|\bDELETE\b/
  )
})
