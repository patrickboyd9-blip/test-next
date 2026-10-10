import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile, mkdir } from "fs/promises"
import { tmpdir } from "os"
import path from "path"
import { test } from "node:test"

import {
  GENERATED_ASSET_SOURCE_CLASS,
  type GeneratedAsset,
  type ImageGenerationOptions,
} from "./image-generation"
import { fingerprintForSpec, imageBriefContextFor } from "./studio-image-fingerprint"
import {
  scheduleAfterResponse,
  studioImageFileBase,
  syncStudioDirectionImages,
} from "./studio-image-jobs"
import type { CampaignBrief, CampaignCreative, CreativeSpec } from "./types"
import { createEmptyCampaignCreative } from "./types"

const CAMPAIGN_ID = "camp-jobs-1"

function spec(overrides: Partial<CreativeSpec> = {}): CreativeSpec {
  return {
    layoutVariant: "image_grounded",
    headline: "Don't Wait, Inspect",
    body: "Water inside means the roof is already talking.",
    callToAction: "Call for an inspection",
    visualDirection:
      "A slow drip from a ceiling stain into a bucket in an ordinary living room, illustrative and not this house.",
    tone: "Urgent, plain, local",
    palette: ["#1c1917", "#c4552a", "#f4f1ea"],
    imagery: "stock_generic_local",
    leadJob: "problem",
    imageryRole: "consequence",
    ...overrides,
  }
}

function generated(id: string): GeneratedAsset {
  return {
    id,
    src: "data:image/png;base64,aGVsbG8=",
    sourceClass: GENERATED_ASSET_SOURCE_CLASS,
    provider: "test",
    model: "test-model",
    generatedAt: "2026-10-09T00:00:00.000Z",
  }
}

function creative(selected = false): CampaignCreative {
  return {
    ...createEmptyCampaignCreative(),
    directions: [
      {
        id: "dir-a",
        name: "Leak",
        rationale: "The leak is the interrupt.",
        designedToDrive: "Inspection calls",
        tags: ["Problem"],
        spec: spec(),
        recommended: true,
        createdAt: "2026-10-09T00:00:00.000Z",
      },
      {
        id: "dir-b",
        name: "Crew",
        rationale: "The work is the interrupt.",
        designedToDrive: "Inspection calls",
        tags: ["Trust"],
        spec: spec({
          layoutVariant: "peer_split",
          imageryRole: "crew",
          leadJob: "trust",
          visualDirection:
            "Hands setting a course of shingles along a ridge, only hands and materials, not a posed crew.",
        }),
        recommended: false,
        createdAt: "2026-10-09T00:00:00.000Z",
      },
    ],
    selectedDirectionId: selected ? "dir-a" : undefined,
  }
}

const brief: CampaignBrief = {
  goal: "Book roof inspections",
  businessInfo: { name: "Summit Roofing", address: "Denver, CO" },
}

test("after() is given the photograph promise, not a callback that drops it", async () => {
  let seen: Promise<unknown> | undefined
  const work = Promise.resolve()
  scheduleAfterResponse(
    (task) => {
      seen = task()
    },
    () => work
  )
  assert.equal(seen, work)
  await seen
})

test("a photograph job returns before the provider runs, then polls to ready", async () => {
  const cacheRoot = await mkdtemp(path.join(tmpdir(), "studio-jobs-"))
  const calls: string[] = []
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const scheduled: Array<() => Promise<void>> = []

  const first = await syncStudioDirectionImages({
    campaignId: CAMPAIGN_ID,
    creative: creative(false),
    campaignBrief: brief,
    cacheRoot,
    configured: true,
    schedule(work) {
      scheduled.push(work)
    },
    createAdapter: () => ({
      async generate(_brief, options?: ImageGenerationOptions) {
        calls.push(`${options?.directionId}:${options?.tier}`)
        await gate
        return generated("gen-a")
      },
    }),
  })

  assert.equal(calls.length, 0)
  assert.equal(first.pending, true)
  assert.equal(first.records.length, 0)
  assert.equal(scheduled.length, 1)

  const running = scheduled[0]!()
  const started = Date.now()
  while (calls.length === 0 && Date.now() - started < 2000) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.deepEqual(calls, ["dir-a:preview"])
  release?.()
  await running

  const second = await syncStudioDirectionImages({
    campaignId: CAMPAIGN_ID,
    creative: creative(false),
    campaignBrief: brief,
    cacheRoot,
    configured: true,
    runInline: true,
    createAdapter: () => ({
      async generate(_brief, options?: ImageGenerationOptions) {
        calls.push(`${options?.directionId}:${options?.tier}`)
        return generated("gen-b")
      },
    }),
  })

  assert.equal(second.pending, false)
  assert.equal(second.records.length, 2)
  assert.deepEqual(
    calls.filter((call) => call.startsWith("dir-a")),
    ["dir-a:preview"]
  )
  assert.equal(second.misses.length, 0)
  const saved = second.records.find((record) => record.directionId === "dir-a")
  assert.match(saved?.asset.src ?? "", /^\/api\/studio-image\/camp-jobs-1\/dir-a--/)
  const png = await readFile(
    path.join(cacheRoot, CAMPAIGN_ID, saved!.asset.src.split("/").pop()!)
  )
  assert.equal(png.toString(), "hello")

  await rm(cacheRoot, { recursive: true, force: true })
})

test("a failed photograph retries once and a finished one is kept", async () => {
  const cacheRoot = await mkdtemp(path.join(tmpdir(), "studio-jobs-retry-"))
  const calls: string[] = []

  const adapter = () => ({
    async generate(_brief: unknown, options?: ImageGenerationOptions) {
      const id = options?.directionId ?? ""
      calls.push(id)
      if (id === "dir-b") throw new Error("provider down")
      return generated(`gen-${id}`)
    },
  })

  const options = {
    campaignId: CAMPAIGN_ID,
    creative: creative(false),
    campaignBrief: brief,
    cacheRoot,
    configured: true,
    runInline: true,
    createAdapter: adapter,
  }

  let load = await syncStudioDirectionImages(options)
  for (let step = 0; step < 6 && load.pending; step += 1) {
    load = await syncStudioDirectionImages(options)
  }

  assert.equal(load.pending, false)
  assert.equal(load.records.length, 1)
  assert.equal(load.records[0]?.directionId, "dir-a")
  assert.equal(load.misses.length, 1)
  assert.equal(load.misses[0]?.directionId, "dir-b")
  assert.equal(load.misses[0]?.fallback, "failed")
  assert.deepEqual(
    calls.filter((id) => id === "dir-a"),
    ["dir-a"]
  )
  assert.deepEqual(
    calls.filter((id) => id === "dir-b"),
    ["dir-b", "dir-b"]
  )

  const again = await syncStudioDirectionImages(options)
  assert.equal(again.records.length, 1)
  assert.equal(calls.filter((id) => id === "dir-a").length, 1)

  await rm(cacheRoot, { recursive: true, force: true })
})

test("the chosen direction is regenerated at final size after the previews", async () => {
  const cacheRoot = await mkdtemp(path.join(tmpdir(), "studio-jobs-final-"))
  const tiers: string[] = []
  const options = {
    campaignId: CAMPAIGN_ID,
    creative: creative(true),
    campaignBrief: brief,
    cacheRoot,
    configured: true,
    runInline: true,
    createAdapter: () => ({
      async generate(_brief: unknown, imageOptions?: ImageGenerationOptions) {
        tiers.push(`${imageOptions?.directionId}:${imageOptions?.tier}`)
        return generated(`gen-${tiers.length}`)
      },
    }),
  }

  let load = await syncStudioDirectionImages(options)
  for (let step = 0; step < 6 && load.pending; step += 1) {
    load = await syncStudioDirectionImages(options)
  }

  assert.equal(load.pending, false)
  assert.deepEqual(tiers, ["dir-a:preview", "dir-b:preview", "dir-a:final"])
  const finals = load.records.filter((record) => record.tier === "final")
  assert.equal(finals.length, 1)
  assert.match(finals[0]?.asset.src ?? "", /--final\.png$/)

  await rm(cacheRoot, { recursive: true, force: true })
})

test("a stale running job can be retried and a fresh one is left alone", async () => {
  const cacheRoot = await mkdtemp(path.join(tmpdir(), "studio-jobs-stale-"))
  const specA = spec()
  const fingerprint = fingerprintForSpec(specA, imageBriefContextFor("dir-a", brief))
  assert.ok(fingerprint)
  const fileBase = studioImageFileBase("dir-a", fingerprint, "preview")
  await mkdir(path.join(cacheRoot, CAMPAIGN_ID), { recursive: true })
  await writeFile(
    path.join(cacheRoot, CAMPAIGN_ID, `${fileBase}.json`),
    JSON.stringify({
      fingerprint,
      tier: "preview",
      status: "running",
      attempts: 1,
      claimedAt: "2026-10-09T00:00:00.000Z",
    })
  )

  const fresh = await syncStudioDirectionImages({
    campaignId: CAMPAIGN_ID,
    creative: creative(false),
    campaignBrief: brief,
    cacheRoot,
    configured: true,
    now: () => new Date("2026-10-09T00:00:10.000Z"),
    createAdapter: () => ({
      async generate() {
        throw new Error("should not run while the claim is fresh")
      },
    }),
  })
  assert.equal(fresh.pending, true)
  assert.equal(fresh.records.length, 0)

  let calls = 0
  const retried = await syncStudioDirectionImages({
    campaignId: CAMPAIGN_ID,
    creative: creative(false),
    campaignBrief: brief,
    cacheRoot,
    configured: true,
    runInline: true,
    now: () => new Date("2026-10-09T00:02:00.000Z"),
    createAdapter: () => ({
      async generate() {
        calls += 1
        return generated("gen-stale")
      },
    }),
  })
  assert.equal(calls, 1)
  assert.equal(retried.records.some((record) => record.directionId === "dir-a"), true)

  await rm(cacheRoot, { recursive: true, force: true })
})

test("missing credentials do not start a job", async () => {
  const cacheRoot = await mkdtemp(path.join(tmpdir(), "studio-jobs-off-"))
  let calls = 0
  const load = await syncStudioDirectionImages({
    campaignId: CAMPAIGN_ID,
    creative: creative(false),
    campaignBrief: brief,
    cacheRoot,
    configured: false,
    runInline: true,
    createAdapter: () => ({
      async generate() {
        calls += 1
        return generated("gen-nope")
      },
    }),
  })
  assert.equal(calls, 0)
  assert.equal(load.pending, false)
  assert.equal(load.records.length, 0)
  assert.equal(load.misses.length, 2)
  assert.equal(load.misses[0]?.fallback, "not_configured")
  await rm(cacheRoot, { recursive: true, force: true })
})
