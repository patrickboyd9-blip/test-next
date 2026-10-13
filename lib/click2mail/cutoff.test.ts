import assert from "node:assert/strict"
import { test } from "node:test"

import { mailingCutoffWarning } from "./cutoff"

test("a job near 8:00 PM ET warns that the batch queue can miss the cutoff", () => {
  // Tuesday 13 Oct 2026, 6:00 PM EDT is exactly two hours before the cutoff.
  assert.match(mailingCutoffWarning(new Date("2026-10-13T22:00:00.000Z")) ?? "", /close to Click2Mail/)
  assert.match(mailingCutoffWarning(new Date("2026-10-13T23:30:00.000Z")) ?? "", /close to Click2Mail/)
  // 5:59 PM EDT is still outside the warning window.
  assert.equal(mailingCutoffWarning(new Date("2026-10-13T21:59:00.000Z")), null)
  // Noon is a normal business-day submission.
  assert.equal(mailingCutoffWarning(new Date("2026-10-13T16:00:00.000Z")), null)
})

test("a job at or after 8:00 PM ET, or on a weekend, waits for the next batch", () => {
  assert.match(mailingCutoffWarning(new Date("2026-10-14T00:00:00.000Z")) ?? "", /past Click2Mail/)
  assert.match(mailingCutoffWarning(new Date("2026-10-14T01:15:00.000Z")) ?? "", /past Click2Mail/)
  // Saturday afternoon.
  assert.match(mailingCutoffWarning(new Date("2026-10-17T19:00:00.000Z")) ?? "", /business days/)
  // Sunday evening, which is close to 8 PM on the clock but not a mailing day.
  assert.match(mailingCutoffWarning(new Date("2026-10-18T23:00:00.000Z")) ?? "", /business days/)
})
