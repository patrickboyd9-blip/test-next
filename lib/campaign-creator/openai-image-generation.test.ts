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
import {
  OPENAI_IMAGE_MODEL_FALLBACK,
  OPENAI_IMAGE_MODEL_PIN,
  OPENAI_IMAGE_QUALITY_FINAL,
  OPENAI_IMAGE_SIZE_FINAL,
  OPENAI_IMAGE_SIZE_TRIM,
  isSupportedGptImageSize,
  resolveOpenAIImageModel,
  resolveOpenAIImageSettings,
  snapGptImageSize,
} from "./openai-image-settings"
import type { CampaignBrief, CreativeSpec } from "./types"

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
  assert.match(prompt, /Shot:/)
  assert.match(prompt, /Subject and action:/)
  assert.match(prompt, /A few ants trailing across a kitchen counter/)
  assert.match(prompt, /Tone of the situation: Urgent, direct, motivating/)
  assert.match(prompt, /upper-left third/)
  assert.match(prompt, /35mm at f\/4/)
  assert.match(prompt, /QR codes/)
  assert.doesNotMatch(prompt, /Free Inspection Now/)
  assert.doesNotMatch(prompt, /Call to book/)
  assert.doesNotMatch(prompt, /\b(beautiful|perfect|stunning|luxury)\b/i)
})

test("hard negatives are present in the request prompt", () => {
  const prompt = buildOpenAIImagePrompt(requireBrief())

  for (const negative of OPENAI_IMAGE_HARD_NEGATIVES) {
    assert.match(prompt, new RegExp(negative.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  assert.match(prompt, /single photograph, not an ad layout/i)
  assert.match(prompt, /Hands that appear have a clear job/)
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

test("shot list order, shared look, and layout negative space", () => {
  const fieldBrief = requireBrief({
    layoutVariant: "image_grounded",
    imageryRole: "neighborhood",
    leadJob: "offer",
  })
  const supportingBrief = requireBrief()
  const witnessBrief = requireBrief({
    imagePresence: "accent",
    imageryRole: "neighborhood",
    leadJob: "offer",
  })
  const bandedBrief = requireBrief({
    layoutVariant: "banded_split",
    imageryRole: "crew",
    leadJob: "trust",
  })
  const field = buildOpenAIImagePrompt(fieldBrief)
  const supporting = buildOpenAIImagePrompt(supportingBrief)
  const witness = buildOpenAIImagePrompt(witnessBrief)
  const banded = buildOpenAIImagePrompt(bandedBrief)

  const labels = [
    "Shot:",
    "Subject and action:",
    "Setting and region:",
    "Light:",
    "Camera and lens:",
    "Imperfections:",
    "Negative space:",
    "Exclusions:",
  ]
  const indexes = labels.map((label) => field.indexOf(label))
  assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b))
  assert.ok(indexes.every((index) => index >= 0))

  assert.match(field, /upper-left third/)
  assert.match(field, /24mm/)
  assert.match(supporting, /right half/)
  assert.match(supporting, /50mm/)
  assert.match(witness, /small witness/)
  assert.match(banded, /horizontal band/)
  assert.match(banded, /50mm/)
  assert.equal(fieldBrief.lookBlock, supportingBrief.lookBlock)
  assert.equal(field.includes(fieldBrief.lookBlock), true)
  assert.equal(supporting.includes(supportingBrief.lookBlock), true)
  assert.notEqual(field, supporting)
  assert.notEqual(supporting, witness)
  assert.notEqual(supporting, banded)
})

test("successful provider response maps to GeneratedAsset", async () => {
  const brief = requireBrief()
  let requestedUrl = ""
  let requestedAuth = ""
  let requestedBody: unknown

  const adapter = new OpenAIImageGenerationAdapter({
    apiKey: "test-openai-key",
    env: {},
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
  assert.deepEqual(requestedBody, buildOpenAIImageRequest(brief, { env: {} }))
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

test("final settings cover the bleed canvas and stay configurable", () => {
  assert.equal(isSupportedGptImageSize(OPENAI_IMAGE_SIZE_TRIM), true)
  assert.equal(isSupportedGptImageSize("2550x1650"), false)
  assert.equal(snapGptImageSize(2550, 1650), OPENAI_IMAGE_SIZE_FINAL)

  const finalRequest = buildOpenAIImageRequest(requireBrief(), { tier: "final", env: {} })
  assert.equal(finalRequest.quality, OPENAI_IMAGE_QUALITY_FINAL)
  assert.equal(finalRequest.size, OPENAI_IMAGE_SIZE_FINAL)
  assert.equal(finalRequest.model, OPENAI_IMAGE_MODEL_PIN)

  const overridden = resolveOpenAIImageSettings("final", {
    OPENAI_IMAGE_MODEL: "gpt-image-2.5-sunburst",
    OPENAI_IMAGE_SIZE_FINAL: OPENAI_IMAGE_SIZE_TRIM,
    OPENAI_IMAGE_QUALITY_FINAL: "xhigh",
    OPENAI_IMAGE_CANDIDATES_FINAL: "2",
  })
  assert.equal(overridden.model, "gpt-image-2.5-sunburst")
  assert.equal(overridden.size, OPENAI_IMAGE_SIZE_TRIM)
  assert.equal(overridden.quality, "xhigh")
  assert.equal(overridden.candidateCount, 2)

  const invalid = resolveOpenAIImageSettings("preview", {
    OPENAI_IMAGE_SIZE_PREVIEW: "100x100",
    OPENAI_IMAGE_QUALITY_PREVIEW: "nope",
    OPENAI_IMAGE_CANDIDATES_PREVIEW: "9",
  })
  assert.equal(invalid.size, OPENAI_IMAGE_SIZE)
  assert.equal(invalid.quality, "medium")
  assert.equal(invalid.candidateCount, 3)
  assert.equal(resolveOpenAIImageModel({}), OPENAI_IMAGE_MODEL_PIN)
  assert.equal(
    resolveOpenAIImageModel({ OPENAI_IMAGE_MODEL: "  gpt-image-2  " }),
    "gpt-image-2"
  )
})

test("one campaign look is copied word for word and does not name the city", () => {
  const coastal: CampaignBrief = {
    goal: "Book roof inspections",
    audience: { description: "Homeowners in Chula Vista" },
    businessInfo: { name: "ABC Roofers", address: "Chula Vista, CA" },
  }
  const inland: CampaignBrief = {
    goal: "Book jobs",
    businessInfo: { name: "Other Co", address: "Denver, CO" },
  }
  const crew = toImageBrief(spec(), { campaign: coastal, variationKey: "dir-crew" })
  const place = toImageBrief(
    spec({
      imageryRole: "neighborhood",
      layoutVariant: "peer_split",
      visualDirection:
        "Rooflines along an ordinary residential street after rain, none of them this recipient's address.",
    }),
    { campaign: coastal, variationKey: "dir-place" }
  )
  const other = toImageBrief(spec(), { campaign: inland, variationKey: "dir-crew" })
  assert.ok(crew && place && other)
  assert.equal(crew.lookBlock, place.lookBlock)
  assert.notEqual(crew.lookBlock, other.lookBlock)
  assert.match(crew.lookBlock, /coastal/)
  assert.doesNotMatch(crew.lookBlock, /Chula Vista/)
  const crewPrompt = buildOpenAIImagePrompt(crew)
  const placePrompt = buildOpenAIImagePrompt(place)
  assert.equal(crewPrompt.includes(crew.lookBlock), true)
  assert.equal(placePrompt.includes(place.lookBlock), true)
  assert.match(placePrompt, /left third/)
})

test("largest candidate is kept and the call is metered", async () => {
  const brief = requireBrief()
  const lines: string[] = []
  const original = console.info
  console.info = (line?: unknown) => {
    lines.push(String(line))
  }
  try {
    const adapter = new OpenAIImageGenerationAdapter({
      apiKey: "test-openai-key",
      env: { OPENAI_IMAGE_CANDIDATES_FINAL: "2" },
      createId: () => "gen-cost",
      fetch: async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as { n: number; quality: string; size: string }
        assert.equal(body.n, 2)
        assert.equal(body.quality, "high")
        assert.equal(body.size, OPENAI_IMAGE_SIZE_FINAL)
        return jsonResponse({
          data: [{ b64_json: "aa" }, { b64_json: "bbbb" }],
          usage: {
            input_tokens: 20,
            output_tokens: 100,
            output_tokens_details: { image_tokens: 100 },
          },
        })
      },
    })
    const result = await adapter.generateDetailed(brief, {
      tier: "final",
      campaignId: "camp-1",
      directionId: "dir-1",
    })
    assert.equal(result.asset.src, "data:image/png;base64,bbbb")
    assert.equal(result.alternates.length, 1)
    assert.equal(result.alternates[0]?.src, "data:image/png;base64,aa")
  } finally {
    console.info = original
  }
  assert.equal(lines.length, 1)
  assert.match(lines[0] ?? "", /"event":"studio_image_cost"/)
  assert.match(lines[0] ?? "", /"estimatedUsd":0.0031/)
  assert.match(lines[0] ?? "", /"output_tokens":100/)
})

test("an unknown model falls back once to gpt-image-2", async () => {
  const brief = requireBrief()
  let calls = 0
  const adapter = new OpenAIImageGenerationAdapter({
    apiKey: "test-openai-key",
    env: {},
    fetch: async (_input, init) => {
      calls += 1
      const body = JSON.parse(String(init?.body)) as { model: string }
      if (calls === 1) {
        assert.equal(body.model, OPENAI_IMAGE_MODEL_PIN)
        return jsonResponse(
          { error: { code: "model_not_found", message: "The model does not exist" } },
          404
        )
      }
      assert.equal(body.model, OPENAI_IMAGE_MODEL_FALLBACK)
      return jsonResponse({ data: [{ b64_json: "ok" }] })
    },
  })
  const asset = await adapter.generate(brief)
  assert.equal(calls, 2)
  assert.equal(asset.model, OPENAI_IMAGE_MODEL_FALLBACK)
  assert.equal(asset.src, "data:image/png;base64,ok")
})
