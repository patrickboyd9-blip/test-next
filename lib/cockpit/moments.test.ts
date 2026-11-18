import assert from "node:assert/strict"
import { test } from "node:test"

import { limbTint, milestoneLabel, milestoneToShow, pendingMilestone } from "./moments"

test("local hour maps to a subtle dawn, day, dusk, or night tint", () => {
  const dawn = limbTint(6.2)
  const day = limbTint(12)
  const dusk = limbTint(18.4)
  const night = limbTint(23)
  assert.equal(dawn.phase, "dawn")
  assert.equal(day.phase, "day")
  assert.equal(dusk.phase, "dusk")
  assert.equal(night.phase, "night")
  assert.ok(dawn.amber > day.amber)
  assert.ok(dawn.amber > dusk.amber)
  assert.ok(dusk.violet > day.violet)
  assert.ok(dusk.violet > dawn.violet)
  assert.ok(night.night > day.night)
  assert.ok(day.amber < 0.1)
  assert.ok(day.violet < 0.1)
  const before = limbTint(7.2)
  const after = limbTint(7.6)
  assert.ok(Math.abs(before.amber - after.amber) < 0.25)
})

test("milestones fire once, in order, and sample data stays quiet unless it is a labeled preview", () => {
  assert.equal(pendingMilestone(99, []), null)
  assert.equal(pendingMilestone(100, []), 100)
  assert.equal(pendingMilestone(1500, [100]), 1000)
  assert.equal(pendingMilestone(10000, [100, 1000]), 10000)
  assert.equal(pendingMilestone(10000, [100, 1000, 10000]), null)
  assert.equal(milestoneToShow({ total: 5000, seen: [], sample: true, preview: false }), null)
  assert.equal(milestoneToShow({ total: 5000, seen: [], sample: true, preview: true }), 100)
  assert.equal(milestoneToShow({ total: 1000, seen: [], sample: false, preview: false }), 100)
  assert.equal(milestoneLabel(1000, false), "1,000 pieces mailed")
  assert.equal(milestoneLabel(1000, true), "Preview · 1,000 pieces mailed")
})
