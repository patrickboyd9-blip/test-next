import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import {
  blobReadWriteToken,
  createVercelBlobObjectStore,
  type BlobObjectStore,
} from "@/lib/storage/blob-store"

import { imageTypeFor } from "./parse"
import type { DesignRequestUpload, IncomingImage } from "./types"

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/
const SAFE_KEY = /^(logo|image-\d{1,2})\.(png|jpe?g|webp)$/

export interface DesignRequestUploadStore {
  put(requestId: string, key: string, bytes: Buffer, contentType: string): Promise<void>
  get(requestId: string, key: string): Promise<{ bytes: Buffer } | null>
}

export function designRequestBlobPath(requestId: string, key: string): string {
  return `design-requests/${requestId}/${key}`
}

/** Local file under .data/design-request-uploads. The first segments stay static for tracing. */
function localPath(requestId: string, key: string): string | null {
  if (!SAFE_ID.test(requestId) || !SAFE_KEY.test(key)) return null
  return path.join(process.cwd(), ".data", "design-request-uploads", requestId, key)
}

function createLocalUploadStore(): DesignRequestUploadStore {
  return {
    async put(requestId, key, bytes) {
      const filePath = localPath(requestId, key)
      if (!filePath) throw new Error("Invalid design request image path")
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, bytes)
    },
    async get(requestId, key) {
      const filePath = localPath(requestId, key)
      if (!filePath) return null
      try {
        return { bytes: await readFile(filePath) }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
        throw error
      }
    },
  }
}

export function createBlobDesignRequestUploadStore(
  blobs: BlobObjectStore
): DesignRequestUploadStore {
  return {
    async put(requestId, key, bytes, contentType) {
      if (!SAFE_ID.test(requestId) || !SAFE_KEY.test(key)) {
        throw new Error("Invalid design request image path")
      }
      await blobs.put(designRequestBlobPath(requestId, key), bytes, contentType)
    },
    async get(requestId, key) {
      if (!SAFE_ID.test(requestId) || !SAFE_KEY.test(key)) return null
      const object = await blobs.get(designRequestBlobPath(requestId, key))
      if (!object) return null
      return { bytes: object.body }
    },
  }
}

/** Blob when BLOB_READ_WRITE_TOKEN is set. Otherwise files under .data/design-request-uploads. */
export function resolveDesignRequestUploadStore(options?: {
  blobs?: BlobObjectStore | null
}): DesignRequestUploadStore {
  if (options && "blobs" in options) {
    if (options.blobs) return createBlobDesignRequestUploadStore(options.blobs)
    return createLocalUploadStore()
  }
  const token = blobReadWriteToken()
  if (token) return createBlobDesignRequestUploadStore(createVercelBlobObjectStore(token))
  return createLocalUploadStore()
}

export function uploadRecord(
  image: IncomingImage,
  role: "logo" | "image",
  key: string,
  id: string
): DesignRequestUpload {
  const mediaType = imageTypeFor(image.mediaType)
  if (!mediaType) throw new Error("Use a PNG, JPEG, or WebP image.")
  return {
    id,
    role,
    fileName: safeFileName(image.fileName),
    mediaType,
    byteLength: image.bytes.byteLength,
    key,
  }
}

export function extensionFor(mediaType: string): "png" | "jpg" | "webp" {
  const normalized = imageTypeFor(mediaType)
  if (normalized === "image/png") return "png"
  if (normalized === "image/webp") return "webp"
  if (normalized === "image/jpeg") return "jpg"
  throw new Error("Use a PNG, JPEG, or WebP image.")
}

/**
 * Local file first, then the private blob when Blob is configured.
 * The app route streams the bytes. A private blob URL is not public.
 */
export async function openDesignRequestUpload(
  requestId: string,
  key: string,
  options?: { blobs?: BlobObjectStore | null }
): Promise<{ bytes: Buffer } | null> {
  const filePath = localPath(requestId, key)
  if (!filePath) return null
  try {
    return { bytes: await readFile(filePath) }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }

  const token = blobReadWriteToken()
  const blobs =
    options && "blobs" in options
      ? options.blobs
      : token
        ? createVercelBlobObjectStore(token)
        : null
  if (!blobs) return null
  const object = await blobs.get(designRequestBlobPath(requestId, key))
  if (!object) return null
  return { bytes: object.body }
}

function safeFileName(fileName: string): string {
  const base = path.basename(fileName).replace(/[^\w.\- ]+/g, "").trim()
  return base.slice(0, 120) || "image"
}
