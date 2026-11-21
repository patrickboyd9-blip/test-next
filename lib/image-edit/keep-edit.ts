import { uploadedDesignKey, type UploadedDesignStore } from "@/lib/bring-your-own-design/store"
import { readRasterSize } from "@/lib/print-spec/raster"

import { PHOTO_SAVE_FAILED } from "./messages"

const MAX_BYTES = 8_000_000

export function decodeKeptJpeg(value: string): Buffer | null {
  const trimmed = value.trim()
  const base64 = trimmed.startsWith("data:") ? trimmed.slice(trimmed.indexOf(",") + 1) : trimmed
  if (!base64 || base64.length > 12_000_000) return null
  const bytes = Buffer.from(base64, "base64")
  if (bytes.length < 4 || bytes.length > MAX_BYTES) return null
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  try {
    if (readRasterSize(bytes).kind !== "jpeg") return null
  } catch {
    return null
  }
  return bytes
}

/** Saves the kept photo the same way an uploaded postcard front is saved. */
export async function keepEditedPhoto(input: {
  imageBase64: string
  campaignId: string
  store: UploadedDesignStore
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const bytes = decodeKeptJpeg(input.imageBase64)
  if (!bytes) return { ok: false, message: PHOTO_SAVE_FAILED }
  const key = uploadedDesignKey("front", "image/jpeg")
  await input.store.put(input.campaignId, key, bytes, "image/jpeg")
  return { ok: true }
}
