import assert from "node:assert/strict"
import { test } from "node:test"

import { createVercelBlobObjectStore, STUDIO_BLOB_ACCESS, type VercelBlobSdk } from "./blob-store"

test("studio files are written and read with private blob access", async () => {
  const calls: Array<{ method: string; access?: string; token?: string }> = []
  const sdk = {
    async put(_pathname: string, _body: unknown, options: { access?: string; token?: string }) {
      calls.push({ method: "put", access: options.access, token: options.token })
      return {
        url: "https://store.private.blob.vercel-storage.com/studio-images/c/a.png",
        downloadUrl: "https://store.private.blob.vercel-storage.com/studio-images/c/a.png",
        pathname: "studio-images/c/a.png",
        contentType: "image/png",
        contentDisposition: "inline",
        etag: "etag",
      }
    },
    async get(_pathname: string, options: { access?: string; token?: string }) {
      calls.push({ method: "get", access: options.access, token: options.token })
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(Buffer.from("hello")))
          controller.close()
        },
      })
      return {
        statusCode: 200,
        stream,
        blob: {
          url: "https://store.private.blob.vercel-storage.com/studio-images/c/a.png",
          downloadUrl: "https://store.private.blob.vercel-storage.com/studio-images/c/a.png",
          pathname: "studio-images/c/a.png",
          contentType: "image/png",
          contentDisposition: "inline",
          etag: "etag",
          size: 5,
          uploadedAt: new Date("2026-10-10T00:00:00.000Z"),
          cacheControl: "public, max-age=31536000",
        },
        headers: new Headers(),
      }
    },
    async head() {
      throw new Error("head is not used to serve the photograph")
    },
    async del() {
      throw new Error("del is not used")
    },
  } as unknown as VercelBlobSdk

  const store = createVercelBlobObjectStore("rw-token", sdk)
  const saved = await store.put("studio-images/c/a.png", Buffer.from("hi"), "image/png")
  assert.match(saved.url, /\.private\.blob\.vercel-storage\.com/)
  const created = await store.putNew("studio-images/c/a.json", "{}", "application/json")
  assert.ok(created)
  const loaded = await store.get("studio-images/c/a.png")
  assert.equal(loaded?.body.toString(), "hello")
  assert.deepEqual(calls, [
    { method: "put", access: STUDIO_BLOB_ACCESS, token: "rw-token" },
    { method: "put", access: STUDIO_BLOB_ACCESS, token: "rw-token" },
    { method: "get", access: STUDIO_BLOB_ACCESS, token: "rw-token" },
  ])
  assert.equal(STUDIO_BLOB_ACCESS, "private")
})
