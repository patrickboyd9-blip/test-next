import assert from "node:assert/strict"
import { test } from "node:test"

import { toImageBrief, type ImageBrief } from "./image-brief"
import {
  GENERATED_ASSET_SOURCE_CLASS,
  type GeneratedAsset,
  type ImageGenerationAdapter,
} from "./image-generation"
import {
  OPENAI_IMAGE_HARD_NEGATIVES,
  OPENAI_IMAGE_MODEL,
  OPENAI_IMAGE_PROVIDER,
  OPENAI_IMAGE_QUALITY,
  OPENAI_IMAGE_SIZE,
  OPENAI_IMAGES_GENERATIONS_URL,
  OpenAIImageGenerationAdapter,
  OpenAIImageGenerationFailedError,
  OpenAIImageGenerationNotConfiguredError,
  buildOpenAIImagePrompt,
  buildOpenAIImageRequest,
  createOpenAIImageGenerationAdapter,
} from "./openai-image-generation"
import type { CreativeSpec } from "./types"

function spec(overrides: Partial<CreativeSpec> = {}): CreativeSpec {
  return {
    layoutVariant: "type_primary_split",
    headline: "Free Inspection Now",
    body: "Licensed local crew ready to inspect.",
    callToAction: "Call to book",
    visualDirection:
      "An original illustrative scene of a pest control technician at a homeowner's front door with equipment, shown as a general representation of professional service rather than a documented job at this recipient's home.",
    tone: "Reassuring, professional, local",
    palette: ["#1e3a5f", "#4a90a4", "#f5f5f0"],
    imagery: "stock_hvac",
    leadJob: "trust",
    imageryRole: "crew",
    ...overrides,
  }
}

function requireBrief(overrides: Partial<CreativeSpec> = {}): ImageBrief {
  const brief = toImageBrief(spec(overrides))
  assert.ok(brief)
  return brief
}

function keysOf(value: object): string[] {
  return Object.keys(value).sort()
}

const GENERATED_ASSET_KEYS = [
  "generatedAt",
  "id",
  "model",
  "provider",
  "sourceClass",
  "src",
] as const

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

test("ImageBrief fields are translated into the provider request", () => {
  const brief = requireBrief({
    layoutVariant: "image_grounded",
    leadJob: "urgency",
    imageryRole: "consequence",
    visualDirection:
      "A few ants trailing across a kitchen counter as a general category reminder, not this recipient's home.",
    tone: "Urgent, direct, motivating",
  })
  const request = buildOpenAIImageRequest(brief)
  const prompt = request.prompt

  assert.equal(request.model, OPENAI_IMAGE_MODEL)
  assert.equal(request.size, OPENAI_IMAGE_SIZE)
  assert.equal(request.quality, OPENAI_IMAGE_QUALITY)
  assert.equal(request.n, 1)
  assert.equal(request.output_format, "png")
  assert.equal(request.moderation, "auto")
  assert.match(prompt, /Execute this already-conceived photograph only/)
  assert.match(prompt, /Imagery role: consequence/)
  assert.match(prompt, /Lead job: urgency/)
  assert.match(prompt, /Occupancy: field/)
  assert.match(prompt, /Tone: Urgent, direct, motivating/)
  assert.match(prompt, /A few ants trailing across a kitchen counter/)
  assert.doesNotMatch(prompt, /Free Inspection Now/)
  assert.doesNotMatch(prompt, /Call to book/)
})

test("hard negatives are present in the request prompt", () => {
  const prompt = buildOpenAIImagePrompt(requireBrief())

  for (const negative of OPENAI_IMAGE_HARD_NEGATIVES) {
    assert.match(prompt, new RegExp(negative.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  assert.match(prompt, /Do not generate headline, offer, CTA/)
})

test("doNotInvent constraints are preserved in the request prompt", () => {
  const brief = requireBrief()
  const prompt = buildOpenAIImagePrompt(brief)

  for (const item of brief.doNotInvent) {
    assert.match(prompt, new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  assert.match(prompt, /not documentation of this recipient's home/)
  assert.match(prompt, /communication, not evidence/)
  assert.match(prompt, /cheap fear or gore escalation/)
})

test("occupancy is reflected distinctly in the request", () => {
  const field = buildOpenAIImagePrompt(
    requireBrief({
      layoutVariant: "image_grounded",
      imageryRole: "neighborhood",
      leadJob: "offer",
    })
  )
  const supporting = buildOpenAIImagePrompt(requireBrief())
  const witness = buildOpenAIImagePrompt(
    requireBrief({
      imagePresence: "accent",
      imageryRole: "neighborhood",
      leadJob: "offer",
    })
  )

  assert.match(field, /Occupancy: field/)
  assert.match(field, /visual ground/)
  assert.match(field, /full-bleed-ready/)
  assert.match(supporting, /Occupancy: supporting/)
  assert.match(supporting, /supporting image beside type/)
  assert.match(witness, /Occupancy: witness/)
  assert.match(witness, /small witness/)
  assert.notEqual(field, supporting)
  assert.notEqual(supporting, witness)
})

test("successful provider response maps to GeneratedAsset", async () => {
  const brief = requireBrief()
  let requestedUrl = ""
  let requestedAuth = ""
  let requestedBody: unknown

  const adapter = new OpenAIImageGenerationAdapter({
    apiKey: "test-openai-key",
    now: () => new Date("2026-09-24T04:30:00.000Z"),
    createId: () => "gen-openai-1",
    fetch: async (input, init) => {
      requestedUrl = String(input)
      requestedAuth = String(
        init && typeof init === "object" && "headers" in init
          ? (init.headers as Record<string, string>).Authorization
          : ""
      )
      requestedBody = JSON.parse(String(init?.body))
      return jsonResponse({ data: [{ b64_json: "abc123" }] })
    },
  })

  const asContract: ImageGenerationAdapter = adapter
  const asset = await asContract.generate(brief)

  assert.equal(requestedUrl, OPENAI_IMAGES_GENERATIONS_URL)
  assert.equal(requestedAuth, "Bearer test-openai-key")
  assert.deepEqual(requestedBody, buildOpenAIImageRequest(brief))
  assert.deepEqual(asset, {
    id: "gen-openai-1",
    src: "data:image/png;base64,abc123",
    sourceClass: GENERATED_ASSET_SOURCE_CLASS,
    provider: OPENAI_IMAGE_PROVIDER,
    model: OPENAI_IMAGE_MODEL,
    generatedAt: "2026-09-24T04:30:00.000Z",
  } satisfies GeneratedAsset)
  assert.deepEqual(keysOf(asset), [...GENERATED_ASSET_KEYS])
})

test("missing API credentials fail clearly and server-side", () => {
  assert.throws(
    () => new OpenAIImageGenerationAdapter({ apiKey: "" }),
    OpenAIImageGenerationNotConfiguredError
  )
  assert.throws(
    () => new OpenAIImageGenerationAdapter({ apiKey: "   " }),
    /OPENAI_API_KEY on the server/
  )

  const previous = process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY
  try {
    assert.throws(
      () => createOpenAIImageGenerationAdapter(),
      OpenAIImageGenerationNotConfiguredError
    )
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previous
  }
})

test("malformed or empty provider responses fail clearly", async () => {
  const brief = requireBrief()

  async function generateWith(body: unknown, status = 200) {
    const adapter = new OpenAIImageGenerationAdapter({
      apiKey: "test-openai-key",
      fetch: async () => jsonResponse(body, status),
    })
    return adapter.generate(brief)
  }

  await assert.rejects(
    () => generateWith({ error: "bad request" }, 400),
    OpenAIImageGenerationFailedError
  )
  await assert.rejects(
    () => generateWith({ data: [] }),
    /empty or malformed image payload/
  )
  await assert.rejects(
    () => generateWith({ data: [{}] }),
    /empty or malformed image payload/
  )
  await assert.rejects(
    () => generateWith({}),
    /empty or malformed image payload/
  )
})

test("provider-specific details do not leak into the ImageGenerationAdapter contract", () => {
  const brief = requireBrief()
  const request = buildOpenAIImageRequest(brief)

  assert.equal("prompt" in brief, false)
  assert.equal("size" in brief, false)
  assert.equal("quality" in brief, false)
  assert.equal("model" in brief, false)
  assert.equal("openai" in brief, false)

  const adapter: ImageGenerationAdapter = new OpenAIImageGenerationAdapter({
    apiKey: "test-openai-key",
    fetch: async () => jsonResponse({ data: [{ b64_json: "xyz" }] }),
  })
  assert.equal(typeof adapter.generate, "function")
  assert.equal("buildOpenAIImageRequest" in adapter, false)
  assert.equal("apiKey" in adapter, false)

  return adapter.generate(brief).then((asset) => {
    assert.deepEqual(keysOf(asset), [...GENERATED_ASSET_KEYS])
    assert.equal("prompt" in asset, false)
    assert.equal("size" in asset, false)
    assert.equal("quality" in asset, false)
    assert.equal("b64_json" in asset, false)
    assert.equal("output_format" in asset, false)
    assert.equal(request.model, OPENAI_IMAGE_MODEL)
    assert.notEqual(asset.model, brief.visualDirection)
  })
})
