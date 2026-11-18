import assert from "node:assert/strict"
import { test } from "node:test"

import { favoriteIdsInOrder, planGalleryExpansion, sourceTier } from "./gallery-expansion"

test("the gallery plan stops before any paid picture", () => {
  const plan = planGalleryExpansion()
  assert.equal(plan.status, "stopped")
  assert.equal(plan.items.length, 8 * 18)
  assert.equal(plan.images, 144)
  assert.equal(plan.estimatedCents, 144 * 15)
  assert.ok(plan.estimatedCents > plan.capCents)
  assert.match(plan.reason, /no pictures were made/)
  for (const item of plan.items) {
    assert.equal(item.images, 1)
    assert.doesNotMatch(item.approach, /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/)
    assert.doesNotMatch(item.approach, /\.png|webp|jpeg/i)
  }
  const roofing = plan.items.filter((item) => item.vertical === "roofing")
  assert.ok(roofing.every((item) => item.sourceId?.startsWith("MMR-")))
  assert.deepEqual(favoriteIdsInOrder(), ["PM-066", "PM-067", "PM-068", "PM-069", "PM-070"])
  assert.ok(sourceTier("PM-066") < sourceTier("PM-070"))
  assert.ok(sourceTier("PM-070") < sourceTier("MMR-001"))
})
