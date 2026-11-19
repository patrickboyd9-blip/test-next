import assert from "node:assert/strict"
import { test } from "node:test"

import { askComet } from "./ask"
import { placeLayer, placementLimits } from "./placement"
import { mockImageEditProvider } from "./provider"
import type { ProofLayer } from "./types"

const text: ProofLayer = {
  id: "words",
  face: "front",
  kind: "text",
  x: 20,
  y: 20,
  w: 30,
  h: 10,
  z: 1,
  text: "Old offer",
  color: "#102033",
}

test("a back layer cannot sit on the address or barcode", () => {
  const limits = placementLimits("5x8", "back")
  const placed = placeLayer({ x: 70, y: 70, w: 30, h: 20 }, limits)
  for (const block of limits.blocked) {
    const hits =
      placed.x < block.x + block.w &&
      placed.x + placed.w > block.x &&
      placed.y < block.y + block.h &&
      placed.y + placed.h > block.y
    assert.equal(hits, false)
  }
  assert.ok(placed.x >= limits.safe.x)
  assert.ok(placed.y >= limits.safe.y)
})

test("changing words updates a text layer and leaves the photograph alone", async () => {
  let called = false
  const provider = {
    id: "mock" as const,
    async edit() {
      called = true
      return mockImageEditProvider.edit({ instruction: "", face: "front", size: "5x8" })
    },
  }
  const result = await askComet({
    instruction: "change the words to Spring tune-up",
    layers: [text],
    face: "front",
    size: "5x8",
    provider,
  })
  assert.equal(called, false)
  assert.equal(result.layers[0]?.text, "Spring tune-up")
  assert.match(result.message, /text layer/i)
  assert.doesNotMatch(result.message, /gemini|openai|flux|qwen|seedream|nano banana|gpt-image/i)
})

test("words baked into a photo are not rewritten", async () => {
  const result = await askComet({
    instruction: "change the words to Spring tune-up",
    layers: [],
    face: "front",
    size: "5x8",
  })
  assert.equal(result.layers.length, 0)
  assert.match(result.message, /cannot be rewritten/)
  assert.match(result.message, /text layer/)
})

test("adding words creates a text layer instead of a new photograph", async () => {
  const result = await askComet({
    instruction: "add the words Spring tune-up",
    layers: [],
    face: "front",
    size: "5x8",
  })
  assert.equal(result.layers.length, 1)
  assert.equal(result.layers[0]?.kind, "text")
  assert.equal(result.layers[0]?.text, "Spring tune-up")
})

test("a photo instruction is held and nothing is charged", async () => {
  const result = await askComet({
    instruction: "add a red truck to the photo",
    layers: [text],
    face: "front",
    size: "5x8",
  })
  assert.equal(result.kind, "photo")
  assert.equal(result.layers.length, 1)
  assert.match(result.message, /not run/)
  assert.match(result.message, /nothing was charged/)
  assert.doesNotMatch(result.message, /gemini|openai|flux|qwen|seedream|nano banana|\$/i)
})

test("paid photo edits stay refused even if the allow flag is set", async () => {
  const { getImageEditProvider } = await import("./provider")
  const provider = getImageEditProvider({ IMAGE_EDIT_ALLOW_PAID: "true" } as unknown as NodeJS.ProcessEnv)
  const result = await provider.edit({ instruction: "add a logo to the roof", face: "front", size: "5x8" })
  assert.equal(result.status, "not-run")
  assert.match(result.message, /not approved/)
})
