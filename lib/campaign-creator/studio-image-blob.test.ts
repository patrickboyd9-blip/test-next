import assert from "node:assert/strict"
import { mkdtemp, rm } from "fs/promises"
import os from "os"
import path from "path"
import { test } from "node:test"

import {
  GENERATED_ASSET_SOURCE_CLASS,
  type GeneratedAsset,
  type ImageGenerationAdapter,
} from "./image-generation"
import { ensureStudioDirectionImages } from "./studio-image-cache"
import { openStudioImage, createBlobStudioImageStore } from "./studio-image-store"
import type { CreativeSpec } from "./types"
import { blobReadWriteToken, studioImageBlobPath, type BlobObjectStore } from "../storage/blob-store"

class MemoryBlob implements BlobObjectStore {
  readonly objects = new Map<string, { body: Buffer; contentType: string; url: string }>()

  async put(pathname: string, body: Buffer | string, contentType: string) {
    const url = `https://blob.example/${pathname}`
    const bytes = typeof body === "string" ? Buffer.from(body) : Buffer.from(body)
    this.objects.set(pathname, { body: bytes, contentType, url })
    return { url }
  }

  async stat(pathname: string) {
    const found = this.objects.get(pathname)
    return found ? { url: found.url } : null
  }

  async get(pathname: string) {
    const found = this.objects.get(pathname)
    return found ? { url: found.url, body: Buffer.from(found.body) } : null
  }

  async putNew(pathname: string, body: Buffer | string, contentType: string) {
    if (this.objects.has(pathname)) return null
    return this.put(pathname, body, contentType)
  }

  async remove(pathname: string) {
    this.objects.delete(pathname)
  }
}

function spec(): CreativeSpec {
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
  }
}

function generated(src: string): GeneratedAsset {
  return {
    id: "gen-1",
    src,
    sourceClass: GENERATED_ASSET_SOURCE_CLASS,
    provider: "test",
    model: "test-model",
    generatedAt: "2026-10-07T00:00:00.000Z",
  }
}

test("blob storage keeps the in-flight dedupe and serves the image route by redirect", async () => {
  const blobs = new MemoryBlob()
  const store = createBlobStudioImageStore(blobs)
  let calls = 0
  const adapter: ImageGenerationAdapter = {
    async generate() {
      calls += 1
      await new Promise((resolve) => setTimeout(resolve, 20))
      return generated("data:image/png;base64,aGVsbG8=")
    },
  }
  const entries = [{ directionId: "dir-inspect", spec: spec() }]

  const [first, second] = await Promise.all([
    ensureStudioDirectionImages({
      campaignId: "camp-blob-1",
      entries,
      createAdapter: () => adapter,
      imageStore: store,
    }),
    ensureStudioDirectionImages({
      campaignId: "camp-blob-1",
      entries,
      createAdapter: () => adapter,
      imageStore: store,
    }),
  ])

  assert.equal(calls, 1)
  assert.equal(first.records.length, 1)
  assert.equal(first.records[0]?.asset.src, second.records[0]?.asset.src)
  assert.match(first.records[0]?.asset.src ?? "", /^https:\/\/blob\.example\/studio-images\/camp-blob-1\/dir-inspect--[a-f0-9]+\.png$/)

  const fileName = first.records[0]!.asset.src.split("/").pop()!
  const png = blobs.objects.get(studioImageBlobPath("camp-blob-1", fileName))
  assert.equal(png?.body.toString(), "hello")
  assert.equal(png?.contentType, "image/png")

  const again = await ensureStudioDirectionImages({
    campaignId: "camp-blob-1",
    entries,
    createAdapter: () => adapter,
    imageStore: store,
  })
  assert.equal(calls, 1)
  assert.equal(again.records[0]?.asset.src, first.records[0]?.asset.src)

  const opened = await openStudioImage("camp-blob-1", fileName, {
    cacheRoot: path.join(os.tmpdir(), "studio-images-missing"),
    blobs,
  })
  assert.equal(opened?.kind, "redirect")
  if (opened?.kind === "redirect") {
    assert.equal(opened.url, first.records[0]?.asset.src)
  }
})

test("a local studio image is served as bytes and a missing blob is a 404", async () => {
  const cacheRoot = await mkdtemp(path.join(os.tmpdir(), "studio-images-local-"))
  try {
    const adapter: ImageGenerationAdapter = {
      async generate() {
        return generated("data:image/png;base64,aGVsbG8=")
      },
    }
    const saved = await ensureStudioDirectionImages({
      campaignId: "camp-local-1",
      entries: [{ directionId: "dir-inspect", spec: spec() }],
      createAdapter: () => adapter,
      cacheRoot,
    })
    const fileName = saved.records[0]!.asset.src.split("/").pop()!
    assert.match(saved.records[0]?.asset.src ?? "", /^\/api\/studio-image\/camp-local-1\//)

    const opened = await openStudioImage("camp-local-1", fileName, {
      cacheRoot,
      blobs: null,
    })
    assert.equal(opened?.kind, "bytes")
    if (opened?.kind === "bytes") assert.equal(opened.bytes.toString(), "hello")

    const missing = await openStudioImage("camp-local-1", "missing-file.png", {
      cacheRoot,
      blobs: new MemoryBlob(),
    })
    assert.equal(missing, null)
    const unsafe = await openStudioImage("not safe", fileName, { cacheRoot, blobs: null })
    assert.equal(unsafe, null)
  } finally {
    await rm(cacheRoot, { recursive: true, force: true })
  }
})

test("blob is selected only when BLOB_READ_WRITE_TOKEN is set", () => {
  assert.equal(blobReadWriteToken({}), null)
  assert.equal(blobReadWriteToken({ BLOB_READ_WRITE_TOKEN: "  " }), null)
  assert.equal(blobReadWriteToken({ BLOB_READ_WRITE_TOKEN: "token" }), "token")
})
