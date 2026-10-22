import assert from "node:assert/strict"
import { test } from "node:test"

import { cancellationDeadline, isBeforeCancellationDeadline, mailingCutoffWarning } from "./cutoff"

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

test("a mailing can be cancelled until the next 8:00 PM ET business-day cutoff", () => {
  // Tuesday 13 Oct 2026, 3:00 PM EDT. Cutoff is the same day at 8:00 PM EDT (midnight UTC).
  const afternoon = new Date("2026-10-13T19:00:00.000Z")
  assert.equal(cancellationDeadline(afternoon).toISOString(), "2026-10-14T00:00:00.000Z")
  assert.equal(isBeforeCancellationDeadline(afternoon, new Date("2026-10-13T23:59:00.000Z")), true)
  assert.equal(isBeforeCancellationDeadline(afternoon, new Date("2026-10-14T00:00:00.000Z")), false)

  // Submitted at the cutoff, so the next chance is Wednesday 8:00 PM EDT.
  const atCutoff = new Date("2026-10-14T00:00:00.000Z")
  assert.equal(cancellationDeadline(atCutoff).toISOString(), "2026-10-15T00:00:00.000Z")

  // Saturday waits until Monday 19 Oct 2026, 8:00 PM EDT.
  const saturday = new Date("2026-10-17T15:00:00.000Z")
  assert.equal(cancellationDeadline(saturday).toISOString(), "2026-10-20T00:00:00.000Z")

  // Friday after 8:00 PM EDT also waits until Monday.
  const fridayNight = new Date("2026-10-17T01:00:00.000Z")
  assert.equal(cancellationDeadline(fridayNight).toISOString(), "2026-10-20T00:00:00.000Z")

  // Tuesday 6 Jan 2026, 3:00 PM EST is 20:00 UTC. Cutoff is 8:00 PM EST, 01:00 UTC Wednesday.
  const winter = new Date("2026-01-06T20:00:00.000Z")
  assert.equal(cancellationDeadline(winter).toISOString(), "2026-01-07T01:00:00.000Z")
})
