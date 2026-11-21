import assert from "node:assert/strict"
import test from "node:test"

import { OPS_DDL } from "@/lib/ops/schema"

import { dailyEditLimit, memoryPhotoEditLedger, monthlyCapCents, PHOTO_EDIT_CENTS } from "./spend"

test("the monthly cap defaults to $25 and the daily limit defaults to 20", () => {
  assert.equal(monthlyCapCents({} as unknown as NodeJS.ProcessEnv), 2500)
  assert.equal(monthlyCapCents({ GEMINI_MONTHLY_CAP_USD: "25" } as unknown as NodeJS.ProcessEnv), 2500)
  assert.equal(dailyEditLimit({} as unknown as NodeJS.ProcessEnv), 20)
  assert.equal(PHOTO_EDIT_CENTS, 4)
  assert.ok(OPS_DDL.some((statement) => statement.includes("photo_edit_spend")))
})

test("a month stops before the next edit would pass the cap", async () => {
  const ledger = memoryPhotoEditLedger()
  const now = new Date("2026-11-21T12:00:00.000Z")
  const first = await ledger.reserve({ userId: "a", cents: 4, now, capCents: 8, dailyLimit: 20 })
  const second = await ledger.reserve({ userId: "b", cents: 4, now, capCents: 8, dailyLimit: 20 })
  const third = await ledger.reserve({ userId: "c", cents: 4, now, capCents: 8, dailyLimit: 20 })
  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  assert.deepEqual(third, { ok: false, reason: "month" })
})

test("one customer stops after the daily edit limit", async () => {
  const ledger = memoryPhotoEditLedger()
  const now = new Date("2026-11-21T12:00:00.000Z")
  const first = await ledger.reserve({ userId: "a", cents: 4, now, capCents: 2500, dailyLimit: 2 })
  const second = await ledger.reserve({ userId: "a", cents: 4, now, capCents: 2500, dailyLimit: 2 })
  const third = await ledger.reserve({ userId: "a", cents: 4, now, capCents: 2500, dailyLimit: 2 })
  const other = await ledger.reserve({ userId: "b", cents: 4, now, capCents: 2500, dailyLimit: 2 })
  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  assert.deepEqual(third, { ok: false, reason: "day" })
  assert.equal(other.ok, true)
})

test("releasing a failed edit gives the allowance back", async () => {
  const ledger = memoryPhotoEditLedger()
  const now = new Date("2026-11-21T12:00:00.000Z")
  const held = await ledger.reserve({ userId: "a", cents: 4, now, capCents: 4, dailyLimit: 20 })
  assert.equal(held.ok, true)
  if (!held.ok) return
  await ledger.release(held.id)
  const again = await ledger.reserve({ userId: "a", cents: 4, now, capCents: 4, dailyLimit: 20 })
  assert.equal(again.ok, true)
})
