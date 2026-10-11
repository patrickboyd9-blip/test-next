import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import {
  blobReadWriteToken,
  createVercelBlobObjectStore,
  type BlobObjectStore,
} from "@/lib/storage/blob-store"

const SAFE_CAMPAIGN_ID = /^[A-Za-z0-9_-]{1,80}$/
const SAFE_KEY = /^(front|back|print)\.(pdf|png|jpe?g)$/

export interface UploadedDesignStore {
  put(campaignId: string, key: string, bytes: Buffer, contentType: string): Promise<void>
  get(campaignId: string, key: string): Promise<{ bytes: Buffer } | null>
}

export function uploadedDesignBlobPath(campaignId: string, key: string): string {
  return `uploaded-designs/${campaignId}/${key}`
}

export function uploadedDesignKey(role: "front" | "back" | "print", mediaType: string): string {
  if (role === "print" || mediaType === "application/pdf") return `${role}.pdf`
  if (mediaType === "image/jpeg") return `${role}.jpg`
  return `${role}.png`
}

export function mediaTypeForKey(key: string): string {
  if (key.endsWith(".pdf")) return "application/pdf"
  if (key.endsWith(".png")) return "image/png"
  return "image/jpeg"
}

function safePair(campaignId: string, key: string): boolean {
  return SAFE_CAMPAIGN_ID.test(campaignId) && SAFE_KEY.test(key)
}

/** Local file under .data/uploaded-designs. The first two segments stay static for tracing. */
function localPath(campaignId: string, key: string): string | null {
  if (!safePair(campaignId, key)) return null
  return path.join(process.cwd(), ".data", "uploaded-designs", campaignId, key)
}

function createLocalUploadedDesignStore(): UploadedDesignStore {
  return {
    async put(campaignId, key, bytes) {
      const filePath = localPath(campaignId, key)
      if (!filePath) throw new Error("Invalid uploaded design path")
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, bytes)
    },
    async get(campaignId, key) {
      const filePath = localPath(campaignId, key)
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

export function createBlobUploadedDesignStore(blobs: BlobObjectStore): UploadedDesignStore {
  return {
    async put(campaignId, key, bytes, contentType) {
      if (!safePair(campaignId, key)) throw new Error("Invalid uploaded design path")
      await blobs.put(uploadedDesignBlobPath(campaignId, key), bytes, contentType)
    },
    async get(campaignId, key) {
      if (!safePair(campaignId, key)) return null
      const object = await blobs.get(uploadedDesignBlobPath(campaignId, key))
      if (!object) return null
      return { bytes: object.body }
    },
  }
}

/** Blob when BLOB_READ_WRITE_TOKEN is set. Otherwise files under .data/uploaded-designs. */
export function resolveUploadedDesignStore(options?: {
  blobs?: BlobObjectStore | null
}): UploadedDesignStore {
  if (options && "blobs" in options) {
    if (options.blobs) return createBlobUploadedDesignStore(options.blobs)
    return createLocalUploadedDesignStore()
  }
  const token = blobReadWriteToken()
  if (token) return createBlobUploadedDesignStore(createVercelBlobObjectStore(token))
  return createLocalUploadedDesignStore()
}

/**
 * Local file first, then the private blob when Blob is configured.
 * The app route streams the bytes. A private blob URL is not public.
 */
export async function openUploadedDesign(
  campaignId: string,
  key: string,
  options?: { blobs?: BlobObjectStore | null }
): Promise<{ bytes: Buffer } | null> {
  const filePath = localPath(campaignId, key)
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
  const object = await blobs.get(uploadedDesignBlobPath(campaignId, key))
  if (!object) return null
  return { bytes: object.body }
}
