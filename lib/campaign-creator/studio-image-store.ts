import { mkdir, readFile, unlink, writeFile } from "fs/promises"
import path from "path"

import {
  blobReadWriteToken,
  createVercelBlobObjectStore,
  studioImageBlobPath,
  type BlobObjectStore,
} from "@/lib/storage/blob-store"

import type { GeneratedAsset } from "./image-generation"
import {
  defaultStudioImageCacheRoot,
  resolveStudioImageFile,
  studioImagePublicPath,
} from "./studio-image-paths"

export interface StudioImageSidecar {
  fingerprint?: string
  asset?: GeneratedAsset
  tier?: "preview" | "final"
  status?: "queued" | "running" | "ready" | "failed"
  attempts?: number
  alternates?: GeneratedAsset[]
  error?: string
  claim?: string
  claimedAt?: string
}

/**
 * Where a conceived photograph and its sidecar live.
 * File implementation writes under the cache root. Blob implementation
 * uploads to a private Vercel Blob store and returns the app image route.
 * The browser never opens the private blob URL.
 */
export interface StudioImageStore {
  readSidecar(campaignId: string, fileBase: string): Promise<StudioImageSidecar | null>
  writeSidecar(
    campaignId: string,
    fileBase: string,
    sidecar: StudioImageSidecar
  ): Promise<void>
  /** True when this caller created the sidecar. False when it already existed. */
  createSidecar(
    campaignId: string,
    fileBase: string,
    sidecar: StudioImageSidecar
  ): Promise<boolean>
  deleteSidecar(campaignId: string, fileBase: string): Promise<void>
  persistPng(campaignId: string, fileName: string, bytes: Buffer): Promise<string>
}

const storeScopes = new WeakMap<StudioImageStore, string>()
let storeScopeCount = 0

function scopeForStore(store: StudioImageStore): string {
  let scope = storeScopes.get(store)
  if (!scope) {
    storeScopeCount += 1
    scope = `store-${storeScopeCount}-${Math.random().toString(36).slice(2)}`
    storeScopes.set(store, scope)
  }
  return scope
}

export function createFileStudioImageStore(cacheRoot: string): StudioImageStore {
  return {
    async readSidecar(campaignId, fileBase) {
      const filePath = jsonPath(cacheRoot, campaignId, fileBase)
      if (!filePath) return null
      try {
        return JSON.parse(await readFile(filePath, "utf8")) as StudioImageSidecar
      } catch {
        return null
      }
    },

    async writeSidecar(campaignId, fileBase, sidecar) {
      const filePath = jsonPath(cacheRoot, campaignId, fileBase)
      if (!filePath) throw new Error("Invalid studio image id")
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, JSON.stringify(sidecar))
    },

    async createSidecar(campaignId, fileBase, sidecar) {
      const filePath = jsonPath(cacheRoot, campaignId, fileBase)
      if (!filePath) throw new Error("Invalid studio image id")
      await mkdir(path.dirname(filePath), { recursive: true })
      try {
        await writeFile(filePath, JSON.stringify(sidecar), { flag: "wx" })
        return true
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") return false
        throw error
      }
    },

    async deleteSidecar(campaignId, fileBase) {
      const filePath = jsonPath(cacheRoot, campaignId, fileBase)
      if (!filePath) return
      try {
        await unlink(filePath)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return
        throw error
      }
    },

    async persistPng(campaignId, fileName, bytes) {
      const filePath = resolveStudioImageFile(campaignId, fileName, cacheRoot)
      if (!filePath) throw new Error("Invalid studio image file")
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, bytes)
      return studioImagePublicPath(campaignId, fileName)
    },
  }
}

function jsonPath(cacheRoot: string, campaignId: string, fileBase: string): string | null {
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(fileBase)) return null
  const fileName = `${fileBase}.json`
  const root = path.resolve(cacheRoot)
  const filePath = path.resolve(root, campaignId, fileName)
  if (filePath !== path.join(root, campaignId, fileName)) return null
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(campaignId)) return null
  return filePath
}

export function createBlobStudioImageStore(blobs: BlobObjectStore): StudioImageStore {
  return {
    async readSidecar(campaignId, fileBase) {
      if (!safePair(campaignId, fileBase)) return null
      const object = await blobs.get(studioImageBlobPath(campaignId, `${fileBase}.json`))
      if (!object) return null
      try {
        return JSON.parse(object.body.toString("utf8")) as StudioImageSidecar
      } catch {
        return null
      }
    },

    async writeSidecar(campaignId, fileBase, sidecar) {
      if (!safePair(campaignId, fileBase)) throw new Error("Invalid studio image id")
      await blobs.put(
        studioImageBlobPath(campaignId, `${fileBase}.json`),
        JSON.stringify(sidecar),
        "application/json"
      )
    },

    async createSidecar(campaignId, fileBase, sidecar) {
      if (!safePair(campaignId, fileBase)) throw new Error("Invalid studio image id")
      const created = await blobs.putNew(
        studioImageBlobPath(campaignId, `${fileBase}.json`),
        JSON.stringify(sidecar),
        "application/json"
      )
      return created !== null
    },

    async deleteSidecar(campaignId, fileBase) {
      if (!safePair(campaignId, fileBase)) return
      await blobs.remove(studioImageBlobPath(campaignId, `${fileBase}.json`))
    },

    async persistPng(campaignId, fileName, bytes) {
      if (!resolveStudioImageFile(campaignId, fileName, defaultStudioImageCacheRoot())) {
        throw new Error("Invalid studio image file")
      }
      await blobs.put(
        studioImageBlobPath(campaignId, fileName),
        bytes,
        "image/png"
      )
      return studioImagePublicPath(campaignId, fileName)
    },
  }
}

function safePair(campaignId: string, fileBase: string): boolean {
  return (
    /^[a-zA-Z0-9_-]{1,80}$/.test(campaignId) &&
    /^[a-zA-Z0-9_-]{1,160}$/.test(fileBase)
  )
}

export function resolveStudioImageStore(options: {
  cacheRoot?: string
  imageStore?: StudioImageStore
  dedupeScope?: string
}): { store: StudioImageStore; scope: string } {
  if (options.imageStore) {
    return {
      store: options.imageStore,
      scope: options.dedupeScope ?? scopeForStore(options.imageStore),
    }
  }
  if (options.cacheRoot) {
    return {
      store: createFileStudioImageStore(options.cacheRoot),
      scope: options.dedupeScope ?? options.cacheRoot,
    }
  }
  const token = blobReadWriteToken()
  if (token) {
    return {
      store: createBlobStudioImageStore(createVercelBlobObjectStore(token)),
      scope: options.dedupeScope ?? "vercel-blob",
    }
  }
  const root = defaultStudioImageCacheRoot()
  return {
    store: createFileStudioImageStore(root),
    scope: options.dedupeScope ?? root,
  }
}

export type OpenedStudioImage = { kind: "bytes"; bytes: Buffer }

/**
 * Local file first, then the private blob when Blob is configured.
 * Used by /api/studio-image so both storage modes stay addressable.
 * The route always returns the bytes. A private blob URL is not public.
 */
export async function openStudioImage(
  campaignId: string,
  fileName: string,
  options?: { cacheRoot?: string; blobs?: BlobObjectStore | null }
): Promise<OpenedStudioImage | null> {
  const filePath = resolveStudioImageFile(
    campaignId,
    fileName,
    options?.cacheRoot ?? defaultStudioImageCacheRoot()
  )
  if (!filePath) return null

  try {
    const bytes = await readFile(filePath)
    return { kind: "bytes", bytes }
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

  const object = await blobs.get(studioImageBlobPath(campaignId, fileName))
  if (!object) return null
  return { kind: "bytes", bytes: object.body }
}
