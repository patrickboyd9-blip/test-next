import assert from "node:assert/strict"
import { test } from "node:test"

import { generateLeadDirectionImage } from "./generate-lead-direction-image"
import {
  GENERATED_ASSET_SOURCE_CLASS,
  type GeneratedAsset,
  type ImageGenerationAdapter,
} from "./image-generation"
import { getMockCreativeDirections } from "./mock-creative-data"
import { OpenAIImageGenerationFailedError } from "./openai-image-generation"
import { resolveCreativeImage } from "./resolve-creative-image"
import type { Campaign, CreativeSpec } from "./types"
import { createEmptyCampaignCreative } from "./types"

const CREW_SRC = "/creative-studio/imagery/crew_trades_handshake.jpg"

const GENERATED: GeneratedAsset = {
  id: "gen-lead-1",
  src: "/tmp/generated-lead.png",
  sourceClass: GENERATED_ASSET_SOURCE_CLASS,
  provider: "test",
  model: "test-model",
  generatedAt: "2026-09-24T05:20:00.000Z",
}

function campaignWithDirections(
  specOverrides: Partial<CreativeSpec> = {}
): Campaign {
  const directions = getMockCreativeDirections()
  const lead = directions[0]
  assert.ok(lead)
  lead.spec = { ...lead.spec, ...specOverrides }

  return {
    id: "campaign-lead-image",
    ownerId: "owner@example.com",
    status: "creative_ready",
    brief: { offer: "15% off your first service call" },
    creative: {
      ...createEmptyCampaignCreative(),
      directions,
      selectedDirectionId: lead.id,
      recommendedDirectionId: lead.id,
      activeSpec: lead.spec,
    },
    transcript: [],
    readyForBriefReview: true,
    createdAt: "2026-09-24T05:00:00.000Z",
    updatedAt: "2026-09-24T05:10:00.000Z",
  }
}

function snapshotCreative(campaign: Campaign) {
  return structuredClone(campaign.creative)
}

test("null ImageBrief does not invoke the adapter", async () => {
  const campaign = campaignWithDirections({ imageryRole: "none" })
  const before = snapshotCreative(campaign)
  let adapterCalls = 0

  const result = await generateLeadDirectionImage(
    campaign,
    "dir-trusted-local",
    () => {
      adapterCalls += 1
      return {
        async generate() {
          throw new Error("adapter should not run")
        },
      }
    }
  )

  assert.deepEqual(result, {
    directionId: "dir-trusted-local",
    generated: null,
  })
  assert.equal(adapterCalls, 0)
  assert.deepEqual(campaign.creative, before)
})

test("successful image generation returns the GeneratedAsset", async () => {
  const campaign = campaignWithDirections()
  let receivedBriefRole: string | undefined

  const adapter: ImageGenerationAdapter = {
    async generate(brief) {
      receivedBriefRole = brief.imageryRole
      return GENERATED
    },
  }

  const result = await generateLeadDirectionImage(
    campaign,
    "dir-trusted-local",
    () => adapter
  )

  assert.equal(receivedBriefRole, "crew")
  assert.deepEqual(result, {
    directionId: "dir-trusted-local",
    generated: GENERATED,
  })
  assert.equal(result.generated?.sourceClass, GENERATED_ASSET_SOURCE_CLASS)
})

test("adapter failure does not mutate campaign creative state", async () => {
  const campaign = campaignWithDirections()
  const before = snapshotCreative(campaign)
  const failure = new OpenAIImageGenerationFailedError(
    "OpenAI image generation failed with status 429."
  )

  await assert.rejects(
    () =>
      generateLeadDirectionImage(campaign, "dir-trusted-local", () => ({
        async generate() {
          throw failure
        },
      })),
    (error: unknown) => {
      assert.equal(error, failure)
      assert.ok(error instanceof OpenAIImageGenerationFailedError)
      return true
    }
  )

  assert.deepEqual(campaign.creative, before)
  assert.equal(campaign.status, "creative_ready")
  assert.equal("generated" in campaign.creative, false)
  assert.equal(
    campaign.creative.directions.some((direction) => "generated" in direction),
    false
  )
  assert.equal("generated" in (campaign.creative.activeSpec ?? {}), false)
})

test("LeadReveal render path receives the generated asset when available", () => {
  const campaign = campaignWithDirections()
  const spec = campaign.creative.directions[0]?.spec
  assert.ok(spec)

  const resolved = resolveCreativeImage(
    spec.imagery,
    spec.imageryRole,
    GENERATED
  )
  assert.equal(resolved.src, GENERATED.src)
  assert.equal(resolved.showMonogram, false)
})

test("existing curated fallback remains intact when no generated asset exists", () => {
  const campaign = campaignWithDirections()
  const spec = campaign.creative.directions[0]?.spec
  assert.ok(spec)

  assert.deepEqual(resolveCreativeImage(spec.imagery, spec.imageryRole), {
    src: CREW_SRC,
    showMonogram: false,
  })
  assert.deepEqual(resolveCreativeImage(spec.imagery, spec.imageryRole, null), {
    src: CREW_SRC,
    showMonogram: false,
  })
})
