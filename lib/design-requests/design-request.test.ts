import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import { MemorySql } from "@/lib/storage/memory-sql"
import type { BlobObjectStore } from "@/lib/storage/blob-store"

import { parseDesignRequest } from "./parse"
import { readDesignRequestImage } from "./read"
import { saveDesignRequest } from "./save"
import { createFileDesignRequestStore, createPostgresDesignRequestStore } from "./store"
import type { DesignRequestInput } from "./types"
import { createFileDesignRequestUploadStore } from "./uploads-file"
import { createBlobDesignRequestUploadStore } from "./uploads"

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
)

const complete: DesignRequestInput = {
  companyName: "Harbor Roofing",
  address: "100 Main St, Austin, TX 78701",
  vibe: "Calm and local",
  offer: "Free inspection this month",
  responseMethods: ["qr", "phone", "website", "other"],
  qrUrl: "https://harborroofing.com/inspect",
  phone: "(512) 555-0148",
  websiteUrl: "https://harborroofing.com",
  otherResponse: "Stop by the shop",
  notes: "Use the blue logo",
  size: "6x9",
}

test("a request requires the company, address, vibe, offer, and a response method", () => {
  assert.equal(parseDesignRequest({}).ok, false)
  assert.match(parseDesignRequest({ companyName: "Harbor" }).error ?? "", /address/)
  const missingMethod = parseDesignRequest({
    companyName: "Harbor Roofing",
    address: "100 Main St",
    vibe: "Calm",
    offer: "Free inspection",
  })
  assert.equal(missingMethod.ok, false)
  if (!missingMethod.ok) assert.match(missingMethod.error, /respond/)

  const qrOnly = parseDesignRequest({
    ...complete,
    responseMethods: ["qr"],
    qrUrl: "not a url",
  })
  assert.equal(qrOnly.ok, false)
  if (!qrOnly.ok) assert.match(qrOnly.error, /QR code link/)

  const phoneOnly = parseDesignRequest({
    ...complete,
    responseMethods: ["phone"],
    phone: "555",
  })
  assert.equal(phoneOnly.ok, false)

  const parsed = parseDesignRequest(complete)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.deepEqual(parsed.value.responseMethods, ["qr", "phone", "website", "other"])
  assert.equal(parsed.value.size, "6x9")
  assert.equal(parsed.value.qrUrl, "https://harborroofing.com/inspect")
})

test("requests and their images round-trip in files and in postgres", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-requests-"))
  const uploads = await mkdtemp(path.join(tmpdir(), "mm-request-uploads-"))
  try {
    const requests = createFileDesignRequestStore(directory)
    const files = createFileDesignRequestUploadStore(uploads)
    const saved = await saveDesignRequest(
      complete,
      {
        logo: { fileName: "logo.png", mediaType: "image/png", bytes: PNG },
        images: [{ fileName: "truck.jpg", mediaType: "image/jpeg", bytes: PNG }],
      },
      { requests, uploads: files }
    )
    assert.equal(saved.ok, true)
    if (!saved.ok) return
    assert.equal(saved.request.uploads.length, 2)
    assert.equal(saved.request.uploads[0]?.key, "logo.png")
    assert.equal(saved.request.uploads[1]?.key, "image-1.jpg")

    const listed = await requests.list()
    assert.equal(listed.length, 1)
    assert.equal(listed[0]?.companyName, "Harbor Roofing")

    const image = await readDesignRequestImage(saved.request.id, "logo.png", {
      requests,
      uploads: files,
    })
    assert.equal(image?.mediaType, "image/png")
    assert.equal(image?.bytes.byteLength, PNG.byteLength)
    assert.equal(
      await readDesignRequestImage(saved.request.id, "image-2.jpg", { requests, uploads: files }),
      null
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
    await rm(uploads, { recursive: true, force: true })
  }
})

test("postgres stores the record and blob stores the upload", async () => {
  const sql = new MemorySql()
  const requests = createPostgresDesignRequestStore(sql)
  const blobs = memoryBlobs()
  const uploads = createBlobDesignRequestUploadStore(blobs)

  const first = await saveDesignRequest(
    { ...complete, companyName: "Older Co" },
    { logo: { fileName: "mark.webp", mediaType: "image/webp", bytes: PNG } },
    { requests, uploads }
  )
  assert.equal(first.ok, true)
  if (!first.ok) return
  first.request.createdAt = "2026-10-01T00:00:00.000Z"
  await requests.put(first.request)

  const second = await saveDesignRequest(
    { ...complete, companyName: "Newer Co", responseMethods: ["phone"], phone: "(512) 555-0100" },
    {},
    { requests, uploads }
  )
  assert.equal(second.ok, true)
  if (!second.ok) return
  second.request.createdAt = "2026-10-12T00:00:00.000Z"
  await requests.put(second.request)

  const listed = await requests.list()
  assert.deepEqual(
    listed.map((request) => request.companyName),
    ["Newer Co", "Older Co"]
  )
  assert.match(sql.statements.join("\n"), /CREATE TABLE IF NOT EXISTS design_requests/)
  assert.match(sql.statements.join("\n"), /ORDER BY created_at DESC/)

  const opened = await blobs.get(`design-requests/${first.request.id}/logo.webp`)
  assert.equal(opened?.body.byteLength, PNG.byteLength)
})

test("an image that is not a png, jpeg, or webp is refused", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-requests-bad-"))
  try {
    const saved = await saveDesignRequest(
      complete,
      { logo: { fileName: "logo.gif", mediaType: "image/gif", bytes: PNG } },
      { requests: createFileDesignRequestStore(directory) }
    )
    assert.equal(saved.ok, false)
    if (saved.ok) return
    assert.match(saved.error, /PNG, JPEG, or WebP/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

function memoryBlobs(): BlobObjectStore {
  const objects = new Map<string, Buffer>()
  return {
    async put(pathname, body) {
      objects.set(pathname, Buffer.from(body))
      return { url: `blob://${pathname}` }
    },
    async stat(pathname) {
      return objects.has(pathname) ? { url: `blob://${pathname}` } : null
    },
    async get(pathname) {
      const body = objects.get(pathname)
      if (!body) return null
      return { url: `blob://${pathname}`, body }
    },
    async putNew() {
      return null
    },
    async remove(pathname) {
      objects.delete(pathname)
    },
  }
}
