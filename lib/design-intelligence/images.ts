import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { createVercelBlobObjectStore } from "@/lib/storage/blob-store"

import { loadLibrary, localReferenceRoot, type LibraryImage, type LibraryRecord } from "./library"

const LOCAL_ROOT = path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "design-library")

export interface LoadedImage {
  bytes: Buffer
  mediaType: "image/jpeg" | "image/png" | "image/webp"
}

export function isForbiddenResearchPath(filePath: string): boolean {
  const parts = filePath.replace(/\\/g, "/").split("/")
  return parts.some((part) => part.toLowerCase() === "private" || part.startsWith(".."))
}

export async function saveLibraryImage(input: {
  id: string
  fileName: string
  bytes: Buffer
  contentType: string
  env?: NodeJS.ProcessEnv
}): Promise<LibraryImage> {
  if (isForbiddenResearchPath(input.fileName) || isForbiddenResearchPath(input.id)) {
    throw new Error("Refusing to store a private research path.")
  }
  const safeName = input.fileName.replace(/[^A-Za-z0-9._-]/g, "")
  const pathname = `design-library/${input.id}/${safeName}`
  const token = input.env?.BLOB_READ_WRITE_TOKEN?.trim() || process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (token) {
    const store = createVercelBlobObjectStore(token)
    await store.put(pathname, input.bytes, input.contentType)
  } else {
    const full = path.join(/*turbopackIgnore: true*/ LOCAL_ROOT, input.id, safeName)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(/*turbopackIgnore: true*/ full, input.bytes)
  }
  return { role: "front", path: pathname, contentType: input.contentType }
}

export async function loadLibraryImage(id: string, env: NodeJS.ProcessEnv = process.env): Promise<LoadedImage | null> {
  const records = await loadLibrary()
  const record = records.find((item) => item.id === id)
  if (!record) return null
  return readRecordImage(record, env)
}

export async function readRecordImage(record: LibraryRecord, env: NodeJS.ProcessEnv = process.env): Promise<LoadedImage | null> {
  const image = [...record.images]
    .filter((item) => !isForbiddenResearchPath(item.path))
    .sort((a, b) => (a.role === "front" ? -1 : 1) - (b.role === "front" ? -1 : 1))[0]
  if (!image) return null
  const mediaType = mediaTypeFor(image.contentType, image.path)
  if (!mediaType) return null
  const token = env.BLOB_READ_WRITE_TOKEN?.trim()
  if (token && image.path.startsWith("design-library/")) {
    const stored = await createVercelBlobObjectStore(token).get(image.path)
    if (stored) return { bytes: stored.body, mediaType }
  }
  const full = resolveLocalImage(image.path, env)
  if (!full) return null
  try {
    return { bytes: await readFile(/*turbopackIgnore: true*/ full), mediaType }
  } catch {
    return null
  }
}

export function resolveLocalImage(storedPath: string, env: NodeJS.ProcessEnv = process.env): string | null {
  if (isForbiddenResearchPath(storedPath)) return null
  if (!storedPath.startsWith("design-library/")) {
    const referenceRoot = path.resolve(/*turbopackIgnore: true*/ localReferenceRoot(env))
    const fromReference = path.resolve(/*turbopackIgnore: true*/ referenceRoot, storedPath)
    if (fromReference.startsWith(referenceRoot + path.sep)) return fromReference
  }
  if (storedPath.startsWith("design-library/")) {
    const fromStore = path.resolve(/*turbopackIgnore: true*/ LOCAL_ROOT, storedPath.replace(/^design-library\//, ""))
    if (fromStore.startsWith(path.resolve(/*turbopackIgnore: true*/ LOCAL_ROOT) + path.sep)) return fromStore
  }
  return null
}

function mediaTypeFor(contentType: string, filePath: string): LoadedImage["mediaType"] | null {
  if (contentType === "image/jpeg" || contentType === "image/png" || contentType === "image/webp") return contentType
  if (filePath.endsWith(".png")) return "image/png"
  if (filePath.endsWith(".webp")) return "image/webp"
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg"
  return null
}
