import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { MemorySql } from "@/lib/storage/memory-sql"

import { appendAudit, approvedBy, readAudit } from "./audit"
import { consumeRate } from "./rate-limit"

test("two callers share one audit log and cannot rewrite it", async () => {
  const sql = new MemorySql()
  await appendAudit(
    { actorId: "ada@example.com", action: "approve", subjectId: "camp-1", before: null, after: { approved: true } },
    new Date("2026-11-17T00:00:00.000Z"),
    sql
  )
  await appendAudit(
    { actorId: "bea@example.com", action: "price", subjectId: "camp-1", before: null, after: { postageOnly: false } },
    new Date("2026-11-17T00:01:00.000Z"),
    sql
  )
  const rows = await readAudit(sql)
  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.action, "approve")
  assert.equal(await approvedBy("ada@example.com", "camp-1", sql), true)
  assert.equal(await approvedBy("bea@example.com", "camp-1", sql), false)
  await assert.rejects(() => sql.query("UPDATE audit_events SET action = 'send'"), /Refused/)
  await assert.rejects(() => sql.query("DELETE FROM audit_events"), /Refused/)
})

test("two callers share one rate window", async () => {
  const sql = new MemorySql()
  const key = "send:ada@example.com"
  assert.equal((await consumeRate(key, 2, 60_000, 1_000, sql)).ok, true)
  assert.equal((await consumeRate(key, 2, 60_000, 1_500, sql)).ok, true)
  assert.equal((await consumeRate(key, 2, 60_000, 2_000, sql)).ok, false)
  await assert.rejects(() => sql.query("DELETE FROM rate_events"), /Refused/)
})

test("audit and rate app code only inserts and reads", () => {
  const text = ["lib/ops/audit.ts", "lib/ops/rate-limit.ts", "lib/ops/mail-flow.ts"]
    .map((file) => readFileSync(file, "utf8"))
    .join("\n")
  assert.doesNotMatch(text, /\bUPDATE\b|\bDELETE\b/)
})
