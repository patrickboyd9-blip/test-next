import assert from "node:assert/strict"
import { test } from "node:test"

import { toImageBrief, type ImageBrief } from "./image-brief"
import {
  GENERATED_ASSET_SOURCE_CLASS,
  type GeneratedAsset,
  type ImageGenerationAdapter,
} from "./image-generation"
import { resolveCreativeImage, type ResolvedImage } from "./resolve-creative-image"
import type { CreativeSpec } from "./types"

function spec(overrides: Partial<CreativeSpec> = {}): CreativeSpec {
  return {
    layoutVariant: "type_primary_split",
    headline: "Free Inspection Now",
    body: "Licensed local crew ready to inspect.",
    callToAction: "Call to book",
    visualDirection: "Professional technician at work, warm and trustworthy",
    tone: "Trustworthy, professional, local",
    palette: ["#1e3a5f", "#4a90a4", "#f5f5f0"],
    imagery: "stock_hvac",
    leadJob: "trust",
    imageryRole: "crew",
    ...overrides,
  }
}

function keysOf(value: object): string[] {
  return Object.keys(value).sort()
}

const IMAGE_BRIEF_KEYS = [
  "doNotInvent",
  "imageryRole",
  "leadJob",
  "occupancy",
  "tone",
  "visualDirection",
] as const

const GENERATED_ASSET_KEYS = [
  "generatedAt",
  "id",
  "model",
  "provider",
  "sourceClass",
  "src",
] as const

const PROVIDER_REQUEST_FIELDS = [
  "prompt",
  "size",
  "quality",
  "style",
  "n",
  "response_format",
  "responseFormat",
  "dallE",
  "openai",
  "recraft",
  "flux",
] as const

function fakeAdapter(): ImageGenerationAdapter {
  return {
    async generate(_brief) {
      return {
        id: "gen-test-1",
        src: "/tmp/generated-test.png",
        sourceClass: GENERATED_ASSET_SOURCE_CLASS,
        provider: "test",
        model: "test-model",
        generatedAt: "2026-09-24T04:20:00.000Z",
      }
    },
  }
}

test("adapter accepts an ImageBrief from toImageBrief", async () => {
  const brief = toImageBrief(spec())
  assert.ok(brief)

  const asset = await fakeAdapter().generate(brief)

  assert.equal(asset.sourceClass, "generated")
  assert.equal(asset.src, "/tmp/generated-test.png")
  assert.deepEqual(keysOf(brief), [...IMAGE_BRIEF_KEYS])
})

test("GeneratedAsset is provider-neutral and is not a second brief or spec", async () => {
  const brief = toImageBrief(spec())
  assert.ok(brief)
  const asset = await fakeAdapter().generate(brief)

  assert.deepEqual(keysOf(asset), [...GENERATED_ASSET_KEYS])
  assert.equal(asset.sourceClass, GENERATED_ASSET_SOURCE_CLASS)
  assert.equal(typeof asset.id, "string")
  assert.equal(typeof asset.src, "string")
  assert.equal(typeof asset.provider, "string")
  assert.equal(typeof asset.model, "string")
  assert.equal(typeof asset.generatedAt, "string")

  assert.equal("visualDirection" in asset, false)
  assert.equal("occupancy" in asset, false)
  assert.equal("leadJob" in asset, false)
  assert.equal("doNotInvent" in asset, false)
  assert.equal("imageryRole" in asset, false)
  assert.equal("layoutVariant" in asset, false)
  assert.equal("headline" in asset, false)
  assert.equal("callToAction" in asset, false)
  assert.equal("crop" in asset, false)
  assert.equal("eligibleRole" in asset, false)
  assert.equal("previewSrc" in asset, false)
})

test("provider-specific request fields do not leak into ImageBrief", () => {
  const brief = toImageBrief(spec())
  assert.ok(brief)
  assert.deepEqual(keysOf(brief), [...IMAGE_BRIEF_KEYS])

  for (const field of PROVIDER_REQUEST_FIELDS) {
    assert.equal(field in brief, false, field)
  }

  const adapter: ImageGenerationAdapter = {
    async generate(received: ImageBrief) {
      for (const field of PROVIDER_REQUEST_FIELDS) {
        assert.equal(field in received, false, field)
      }
      return {
        id: "gen-test-2",
        src: "/tmp/generated-test-2.png",
        sourceClass: GENERATED_ASSET_SOURCE_CLASS,
        provider: "test",
        model: "test-model",
        generatedAt: "2026-09-24T04:20:00.000Z",
      }
    },
  }

  return adapter.generate(brief)
})

test("GeneratedAsset.src is the later resolveCreativeImage display field", async () => {
  const brief = toImageBrief(spec())
  assert.ok(brief)
  const asset = await fakeAdapter().generate(brief)

  const fromGenerated: ResolvedImage = {
    src: asset.src,
    showMonogram: false,
  }
  assert.equal(fromGenerated.src, asset.src)
  assert.equal(fromGenerated.showMonogram, false)

  const fromLibrary = resolveCreativeImage(spec().imagery, spec().imageryRole)
  assert.equal(typeof fromLibrary.src, "string")
  assert.notEqual(fromLibrary.src, asset.src)
  assert.equal(fromLibrary.showMonogram, false)
})
