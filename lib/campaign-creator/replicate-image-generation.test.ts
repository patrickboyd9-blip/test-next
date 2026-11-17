import assert from "node:assert/strict"
import { test } from "node:test"

import type { ImageBrief } from "./image-brief"
import {
  IMAGEN_IMAGE_MODEL,
  ImagenImageGenerationAdapter,
  NANO_BANANA_RESOLUTION,
  imageModelHttpError,
} from "./replicate-image-generation"

const brief: ImageBrief = {
  imageryRole: "neighborhood",
  visualDirection: "A residential roof in daylight. No people.",
  occupancy: "field",
  leadJob: "offer",
  doNotInvent: [],
  lookBlock: "Open natural light.",
  artDirection: {
    revision: "test",
    trade: "roofing",
    subject: "A residential asphalt-shingle roof. No people.",
    lighting: "Late daylight.",
    framing: "Wide.",
    emotion: "Calm.",
    refuse: "No logos.",
    negativeSpace: "Sky.",
  },
}

test("a retired model 410 is a clear error and does not continue", async () => {
  let calls = 0
  let url = ""
  let raw = ""
  const fetchImpl: typeof fetch = async (input, init) => {
    calls += 1
    url = String(input)
    raw = String(init?.body ?? "")
    return new Response("gone", { status: 410 })
  }
  const adapter = new ImagenImageGenerationAdapter({ token: "test-token", fetch: fetchImpl })
  await assert.rejects(
    () => adapter.generate(brief),
    /The image model google\/nano-banana-pro is retired\. Replicate returned 410, so no photograph was saved\./
  )
  assert.equal(calls, 1)
  assert.match(url, /\/models\/google\/nano-banana-pro\/predictions$/)
  const input = JSON.parse(raw).input as Record<string, unknown>
  assert.equal(input.resolution, NANO_BANANA_RESOLUTION)
  assert.equal(input.output_format, "png")
  assert.equal(input.safety_filter_level, "block_only_high")
  assert.equal("allow_fallback_model" in input, false)
  assert.equal("image_input" in input, false)
  assert.equal(IMAGEN_IMAGE_MODEL, "google/nano-banana-pro")
})

test("another failed status is still an error", () => {
  const error = imageModelHttpError(500, IMAGEN_IMAGE_MODEL)
  assert.match(error.message, /status 500/)
  assert.doesNotMatch(error.message, /retired/)
})
