import assert from "node:assert/strict"
import test from "node:test"

import { encodeSolidPng } from "@/lib/print-spec/raster"

import { GEMINI_EDIT_MODEL, PhotoEditError, requestGeminiEdit } from "./gemini"

test("the editor asks the confirmed image model and reads the picture it returns", async () => {
  const png = encodeSolidPng(4, 4, [10, 20, 30])
  let seenUrl = ""
  let seenKey = ""
  const bytes = await requestGeminiEdit({
    image: png,
    mimeType: "image/png",
    instruction: "make the sky sunset",
    apiKey: "secret-key",
    fetchImpl: async (url, init) => {
      seenUrl = String(url)
      seenKey = new Headers(init?.headers).get("x-goog-api-key") ?? ""
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ inlineData: { data: png.toString("base64") } }] } }],
        }),
        { status: 200 }
      )
    },
  })
  assert.equal(bytes.equals(png), true)
  assert.ok(seenUrl.includes(GEMINI_EDIT_MODEL))
  assert.equal(seenKey, "secret-key")
  assert.equal(seenUrl.includes("secret-key"), false)
})

test("a failed edit does not include the key in the error", async () => {
  const png = encodeSolidPng(2, 2, [1, 2, 3])
  await assert.rejects(
    () =>
      requestGeminiEdit({
        image: png,
        mimeType: "image/png",
        instruction: "remove the truck",
        apiKey: "secret-key",
        fetchImpl: async () => new Response("secret-key", { status: 400 }),
      }),
    (error: unknown) => error instanceof PhotoEditError && !error.message.includes("secret-key")
  )
})
