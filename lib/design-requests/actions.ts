"use server"

import { designRequestInputFromForm, imageTypeFor } from "./parse"
import { saveDesignRequest, type SaveDesignRequestResult } from "./save"
import type { IncomingImage } from "./types"
import { getDesignRequestStore } from "./store"
import type { DesignRequest } from "./types"

export async function submitDesignRequest(formData: FormData): Promise<SaveDesignRequestResult> {
  const logo = await readImage(formData.get("logo"))
  if (isImageError(logo)) return { ok: false, error: logo.error }
  const images: IncomingImage[] = []
  for (const value of formData.getAll("images")) {
    const image = await readImage(value)
    if (isImageError(image)) return { ok: false, error: image.error }
    if (image) images.push(image)
  }
  return saveDesignRequest(designRequestInputFromForm(formData), { logo, images })
}

export async function listDesignRequests(): Promise<DesignRequest[]> {
  return getDesignRequestStore().list()
}

async function readImage(
  value: FormDataEntryValue | null
): Promise<IncomingImage | { error: string } | null> {
  if (!value || typeof value === "string") return null
  if (typeof value.arrayBuffer !== "function") return null
  if (value.size === 0) return null
  const bytes = Buffer.from(await value.arrayBuffer())
  const named = value.type || guessType(value.name)
  const mediaType = imageTypeFor(named) ?? (imageTypeFor(guessType(value.name)) ? guessType(value.name) : "")
  if (!mediaType) return { error: "Use a PNG, JPEG, or WebP image." }
  return {
    fileName: value.name || "image",
    mediaType,
    bytes,
  }
}

function isImageError(
  value: IncomingImage | { error: string } | null
): value is { error: string } {
  return Boolean(value && "error" in value)
}

function guessType(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  return ""
}
