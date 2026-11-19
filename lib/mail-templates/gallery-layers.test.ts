import assert from "node:assert/strict"
import { test } from "node:test"

import { askComet } from "@/lib/image-edit/ask"
import { getMailTemplate } from "@/lib/mail-templates/query"

import { layersForGallery } from "./gallery-layers"

test("a gallery mailer is layers, and Comet edits the words without a new photograph", async () => {
  const template = getMailTemplate("roofing-after-the-storm")
  assert.ok(template)
  if (!template) return
  const layers = layersForGallery(template)
  assert.ok(layers.some((layer) => layer.kind === "color"))
  assert.ok(layers.some((layer) => layer.kind === "text" && layer.text === template.spec.headline))
  assert.equal(layers.some((layer) => layer.kind === "image"), false)
  const changed = await askComet({
    instruction: "change the words to Roof check this week",
    layers,
    face: "front",
    size: "5x8",
  })
  assert.ok(changed.layers.filter((layer) => layer.kind === "text").every((layer) => layer.text === "Roof check this week"))
  const undone = layers
  assert.equal(undone.find((layer) => layer.id === "headline")?.text, template.spec.headline)
  const colored = await askComet({
    instruction: "make the color red",
    layers,
    face: "front",
    size: "5x8",
  })
  assert.ok(colored.layers.filter((layer) => layer.kind === "color").every((layer) => layer.color === "#b42318"))
  assert.doesNotMatch(colored.message, /gemini|openai|flux|qwen|seedream/i)
})
