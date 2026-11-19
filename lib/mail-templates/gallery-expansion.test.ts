import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import type { GeneratedAsset, ImageGenerationAdapter } from "@/lib/campaign-creator/image-generation"
import { headlineWordCount } from "@/lib/campaign-creator/headline-repair"
import { leaksReferenceIdentity } from "@/lib/design-intelligence/patrick-gold"

import {
  EXPANSION_HARD_CAP_CENTS,
  expansionSpendDecision,
  expansionTemplates,
  favoriteIdsInOrder,
  planGalleryExpansion,
  sourceTier,
} from "./gallery-expansion"
import { runGalleryExpansion } from "./gallery-expansion-run"

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

test("the expansion is 144 original scenes and fits under $22", () => {
  const plan = planGalleryExpansion()
  assert.equal(plan.status, "ready")
  assert.equal(plan.items.length, 144)
  assert.equal(plan.images, 144)
  assert.equal(plan.estimatedCents, 2160)
  assert.equal(plan.capCents, 2200)
  assert.equal(expansionSpendDecision(0, 2160), "ok")
  assert.equal(expansionSpendDecision(2186, 15), "ceiling")
  assert.equal(expansionSpendDecision(2185, 15), "ok")
  const scenes = new Set(plan.items.map((item) => item.scene))
  assert.equal(scenes.size, 144)
  for (const item of plan.items) {
    assert.match(item.scene, /no people/i)
    assert.match(item.scene, /no logos/i)
    assert.match(item.prompt, /no people/i)
    assert.match(item.prompt, /No logos and no lettering/)
    assert.doesNotMatch(item.scene, /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/)
    assert.equal(leaksReferenceIdentity(item.scene), false)
    assert.equal(leaksReferenceIdentity(item.prompt), false)
    const words = headlineWordCount(item.headline)
    assert.ok(words >= 3 && words <= 6, `${item.id} headline has ${words} words`)
  }
  for (const vertical of ["real_estate", "auto_repair"] as const) {
    assert.ok(plan.items.filter((item) => item.vertical === vertical).every((item) => item.sourceId === null))
  }
  assert.ok(plan.items.some((item) => item.vertical === "roofing" && item.sourceId?.startsWith("MMR-")))
  assert.deepEqual(favoriteIdsInOrder(), ["PM-066", "PM-067", "PM-068", "PM-069", "PM-070"])
  assert.ok(sourceTier("PM-066") < sourceTier("MMR-001"))
  const templates = expansionTemplates()
  assert.equal(templates.length, 144)
  assert.equal(new Set(templates.map((item) => item.id)).size, 144)
})

test("a mock run saves only the limited pictures and stops at the cap", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-expand-"))
  const calls: string[] = []
  const adapter: ImageGenerationAdapter = {
    async generate(brief): Promise<GeneratedAsset> {
      calls.push(brief.visualDirection)
      return {
        id: "mock",
        src: PNG,
        sourceClass: "generated",
        provider: "mock",
        model: "mock",
        generatedAt: new Date().toISOString(),
      }
    },
  }
  try {
    const jobs = planGalleryExpansion().items
    const result = await runGalleryExpansion({
      jobs,
      limit: 2,
      adapter,
      photoDir: directory,
      spendPath: path.join(directory, "spend.json"),
      manifestPath: path.join(directory, "manifest.json"),
    })
    assert.equal(result.requested, 2)
    assert.equal(result.saved, 2)
    assert.equal(result.spentCents, 30)
    assert.equal(calls.length, 2)
    const spend = JSON.parse(await readFile(path.join(directory, "spend.json"), "utf8")) as { totalUsd: string }
    assert.equal(spend.totalUsd, "0.30")
    assert.equal(result.stopped, "limit")
    assert.ok(result.spentCents <= EXPANSION_HARD_CAP_CENTS)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
