import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "fs/promises"
import { tmpdir } from "os"
import path from "path"
import { test } from "node:test"

import {
  GENERATED_ASSET_SOURCE_CLASS,
  type GeneratedAsset,
  type ImageGenerationAdapter,
} from "./image-generation"
import { resolveCreativeImage } from "./resolve-creative-image"
import { ensureStudioDirectionImages } from "./studio-image-cache"
import {
  fingerprintForSpec,
  lookupStudioImage,
  studioImageEntries,
} from "./studio-image-fingerprint"
import type { Campaign, CreativeSpec } from "./types"
import { createEmptyCampaignCreative } from "./types"

const CREW_SRC = "/creative-studio/imagery/crew_trades_handshake.jpg"
const CAMPAIGN_ID = "camp-visual-1"

function spec(overrides: Partial<CreativeSpec> = {}): CreativeSpec {
  return {
    layoutVariant: "image_grounded",
    headline: "Don't Wait, Inspect",
    body: "Water inside means the roof is already talking.",
    callToAction: "Call for an inspection",
    visualDirection: "Interior ceiling stain from a roof leak, illustrative, not a specific house",
    tone: "Urgent, plain, local",
    palette: ["#1c1917", "#c4552a", "#f4f1ea"],
    imagery: "stock_generic_local",
    leadJob: "problem",
    imageryRole: "consequence",
    phone: "(619) 555-0148",
    website: "https://summitroofing.com/inspect",
    ...overrides,
  }
}

function generated(src: string, id = "gen-1"): GeneratedAsset {
  return {
    id,
    src,
    sourceClass: GENERATED_ASSET_SOURCE_CLASS,
    provider: "test",
    model: "test-model",
    generatedAt: "2026-10-07T00:00:00.000Z",
  }
}

function campaignFor(active?: CreativeSpec): Campaign {
  const lead = spec()
  return {
    id: CAMPAIGN_ID,
    ownerId: "owner@example.com",
    status: "creative_ready",
    brief: {
      businessInfo: { name: "Summit Roofing", phone: "619-555-0148" },
      website: "https://summitroofing.com/inspect",
    },
    creative: {
      ...createEmptyCampaignCreative(),
      directions: [
        {
          id: "dir-inspect",
          name: "Don't Wait",
          rationale: "The leak is the interrupt.",
          designedToDrive: "Inspection calls",
          tags: ["Problem"],
          spec: lead,
          recommended: true,
          createdAt: "2026-10-07T00:00:00.000Z",
        },
        {
          id: "dir-quiet",
          name: "Type only",
          rationale: "No photograph.",
          designedToDrive: "Inspection calls",
          tags: ["Type"],
          spec: spec({
            layoutVariant: "type_only",
            imageryRole: "none",
            visualDirection: "No photograph. The headline is the interrupt.",
          }),
          recommended: false,
          createdAt: "2026-10-07T00:00:00.000Z",
        },
      ],
      selectedDirectionId: "dir-inspect",
      activeSpec: active ?? lead,
    },
    transcript: [],
    readyForBriefReview: true,
    createdAt: "2026-10-07T00:00:00.000Z",
    updatedAt: "2026-10-07T00:00:00.000Z",
  }
}

test("a generated photograph is cached and reused by every Studio view", async () => {
  const cacheRoot = await mkdtemp(path.join(tmpdir(), "studio-images-"))
  const campaign = campaignFor()
  const before = structuredClone(campaign.creative)
  const asset = generated("data:image/png;base64,aGVsbG8=")
  let calls = 0
  const adapter: ImageGenerationAdapter = {
    async generate() {
      calls += 1
      return asset
    },
  }

  const first = await ensureStudioDirectionImages({
    campaignId: campaign.id,
    entries: studioImageEntries(campaign.creative),
    createAdapter: () => adapter,
    cacheRoot,
  })

  assert.equal(calls, 1)
  assert.equal(first.length, 1)
  assert.equal(first[0]?.directionId, "dir-inspect")
  assert.match(first[0]?.asset.src ?? "", /^\/api\/studio-image\/camp-visual-1\/dir-inspect--[a-f0-9]+\.png$/)
  const png = await readFile(
    path.join(cacheRoot, campaign.id, first[0]!.asset.src.split("/").pop()!)
  )
  assert.equal(png.toString(), "hello")
  assert.deepEqual(campaign.creative, before)

  const specForViews = campaign.creative.directions[0]!.spec
  const focus = lookupStudioImage(first, "dir-inspect", specForViews)
  const compare = lookupStudioImage(first, "dir-inspect", specForViews)
  const refine = lookupStudioImage(first, "dir-inspect", specForViews)
  const approve = lookupStudioImage(first, "dir-inspect", specForViews)
  assert.equal(focus?.src, first[0]?.asset.src)
  assert.equal(compare?.src, focus?.src)
  assert.equal(refine?.src, focus?.src)
  assert.equal(approve?.src, focus?.src)

  const resolved = resolveCreativeImage(
    specForViews.imagery,
    specForViews.imageryRole,
    focus
  )
  assert.equal(resolved.src, focus?.src)
  assert.notEqual(resolved.src, CREW_SRC)

  const second = await ensureStudioDirectionImages({
    campaignId: campaign.id,
    entries: studioImageEntries(campaign.creative),
    createAdapter: () => adapter,
    cacheRoot,
  })
  assert.equal(calls, 1)
  assert.equal(second[0]?.asset.src, first[0]?.asset.src)
  assert.deepEqual(campaign.creative, before)

  await rm(cacheRoot, { recursive: true, force: true })
})

test("a changed photograph misses the cache and does not reuse the old one", async () => {
  const cacheRoot = await mkdtemp(path.join(tmpdir(), "studio-images-"))
  const original = spec()
  const revised = spec({
    visualDirection: "Close illustrative view of a damp ceiling joint, still not a documented house",
  })
  assert.notEqual(fingerprintForSpec(original), fingerprintForSpec(revised))

  let calls = 0
  const adapter: ImageGenerationAdapter = {
    async generate() {
      calls += 1
      return generated(`/tmp/generated-${calls}.png`, `gen-${calls}`)
    },
  }

  const first = await ensureStudioDirectionImages({
    campaignId: CAMPAIGN_ID,
    entries: [{ directionId: "dir-inspect", spec: original }],
    createAdapter: () => adapter,
    cacheRoot,
  })
  const second = await ensureStudioDirectionImages({
    campaignId: CAMPAIGN_ID,
    entries: [{ directionId: "dir-inspect", spec: revised }],
    createAdapter: () => adapter,
    cacheRoot,
  })

  assert.equal(calls, 2)
  assert.equal(lookupStudioImage(first, "dir-inspect", original)?.src, "/tmp/generated-1.png")
  assert.equal(lookupStudioImage(second, "dir-inspect", revised)?.src, "/tmp/generated-2.png")
  assert.equal(lookupStudioImage([...first, ...second], "dir-inspect", original)?.src, "/tmp/generated-1.png")
  assert.equal(lookupStudioImage(second, "dir-inspect", original), null)

  await rm(cacheRoot, { recursive: true, force: true })
})

test("active spec is requested alongside the original direction spec", () => {
  const campaign = campaignFor(
    spec({ visualDirection: "A different conceived leak, still illustrative" })
  )
  const entries = studioImageEntries(campaign.creative)
  const inspect = entries.filter((entry) => entry.directionId === "dir-inspect")
  assert.equal(inspect.length, 2)
  assert.equal(inspect[0]?.spec.visualDirection, spec().visualDirection)
  assert.notEqual(
    fingerprintForSpec(inspect[0]!.spec),
    fingerprintForSpec(inspect[1]!.spec)
  )
})
