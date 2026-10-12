import { randomUUID } from "crypto"

import {
  MAX_DESIGN_REQUEST_IMAGES,
  parseDesignRequest,
  validateIncomingImage,
} from "./parse"
import type { DesignRequestStore } from "./store"
import { getDesignRequestStore } from "./store"
import type { DesignRequest, DesignRequestFiles, DesignRequestInput } from "./types"
import {
  extensionFor,
  resolveDesignRequestUploadStore,
  uploadRecord,
  type DesignRequestUploadStore,
} from "./uploads"

export type SaveDesignRequestResult =
  | { ok: true; request: DesignRequest }
  | { ok: false; error: string }

/**
 * Validates the request, stores images, then writes the record.
 * Images go to Vercel Blob when the token is set. No email is sent.
 */
export async function saveDesignRequest(
  input: DesignRequestInput,
  files: DesignRequestFiles = {},
  options?: { requests?: DesignRequestStore; uploads?: DesignRequestUploadStore }
): Promise<SaveDesignRequestResult> {
  const parsed = parseDesignRequest(input)
  if (!parsed.ok) return parsed

  const images = (files.images ?? []).filter((image) => image.bytes.byteLength > 0 || image.fileName)
  if (images.length > MAX_DESIGN_REQUEST_IMAGES) {
    return { ok: false, error: "You can add up to 8 other images." }
  }

  if (files.logo) {
    const problem = validateIncomingImage(files.logo, "The logo")
    if (problem) return { ok: false, error: problem }
  }
  for (const image of images) {
    const problem = validateIncomingImage(image, "An image")
    if (problem) return { ok: false, error: problem }
  }

  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const uploads = options?.uploads ?? resolveDesignRequestUploadStore()
  const stored = []

  if (files.logo) {
    const key = `logo.${extensionFor(files.logo.mediaType)}`
    await uploads.put(id, key, files.logo.bytes, imageContentType(files.logo.mediaType))
    stored.push(uploadRecord(files.logo, "logo", key, randomUUID()))
  }

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index]
    if (!image) continue
    const key = `image-${index + 1}.${extensionFor(image.mediaType)}`
    await uploads.put(id, key, image.bytes, imageContentType(image.mediaType))
    stored.push(uploadRecord(image, "image", key, randomUUID()))
  }

  const request: DesignRequest = {
    id,
    ...parsed.value,
    uploads: stored,
    createdAt,
  }
  const requests = options?.requests ?? getDesignRequestStore()
  await requests.put(request)
  return { ok: true, request }
}

function imageContentType(mediaType: string): string {
  if (mediaType === "image/jpg") return "image/jpeg"
  return mediaType
}
