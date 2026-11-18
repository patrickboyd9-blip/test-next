import assert from "node:assert/strict"
import { test } from "node:test"

import { isFederalHoliday, isoDate, subtractBusinessDays, weekday } from "./calendar"
import { scheduleCard } from "./schedule"

test("mail date skips weekends and the lock is 7 calendar days earlier", () => {
  const birthday = { year: 2026, month: 3, day: 16 }
  assert.equal(weekday(birthday), 1)
  assert.equal(isoDate(subtractBusinessDays(birthday, 1)), "2026-03-13")
  const schedule = scheduleCard({ month: 3, day: 16, today: { year: 2026, month: 1, day: 1 } })
  assert.equal(schedule.mailDate, "2026-03-05")
  assert.equal(schedule.lockDate, "2026-02-26")
  assert.equal(schedule.recommendedOrderDate, schedule.lockDate)
  assert.equal(schedule.leadConfirmed, false)
  assert.equal(schedule.mayArriveLate, false)
})

test("a holiday and a weekend are not business days", () => {
  assert.equal(isFederalHoliday({ year: 2026, month: 5, day: 25 }), true)
  assert.equal(isoDate(subtractBusinessDays({ year: 2026, month: 5, day: 26 }, 1)), "2026-05-22")
  assert.equal(isFederalHoliday({ year: 2021, month: 12, day: 31 }), true)
})

test("a birthday inside the lead window can send now and may arrive late", () => {
  const schedule = scheduleCard({ month: 1, day: 6, today: { year: 2026, month: 1, day: 5 } })
  assert.equal(schedule.sendNow, true)
  assert.equal(schedule.mayArriveLate, true)
  assert.equal(schedule.mailDate, "2026-01-05")
  assert.equal(schedule.lockDate, "2026-01-05")
})
