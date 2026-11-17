import assert from "node:assert/strict"
import { test } from "node:test"

import { classifyDesignUpload, DESIGN_PREVIEW_BYTE_LIMIT } from "./design-preview"

const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0])
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])
const PDF = Uint8Array.from(Buffer.from("%PDF-1.7\n"))

test("a PNG, JPG, or PDF can be previewed from its bytes", () => {
  assert.deepEqual(classifyDesignUpload(PNG), { ok: true, mediaType: "image/png" })
  assert.deepEqual(classifyDesignUpload(JPEG), { ok: true, mediaType: "image/jpeg" })
  assert.deepEqual(classifyDesignUpload(PDF), { ok: true, mediaType: "application/pdf" })
})

test("an empty file, a huge file, or a text file explains why there is no preview", () => {
  const empty = classifyDesignUpload(new Uint8Array())
  assert.equal(empty.ok, false)
  if (!empty.ok) assert.match(empty.error, /empty/)

  const huge = new Uint8Array(DESIGN_PREVIEW_BYTE_LIMIT + 1)
  huge.set(PNG)
  const tooBig = classifyDesignUpload(huge)
  assert.equal(tooBig.ok, false)
  if (!tooBig.ok) assert.match(tooBig.error, /8 MB/)

  const text = classifyDesignUpload(Uint8Array.from(Buffer.from("not a postcard")))
  assert.equal(text.ok, false)
  if (!text.ok) assert.match(text.error, /PNG, JPG, or PDF/)
})
