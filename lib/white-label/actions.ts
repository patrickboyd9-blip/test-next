"use server"

import { getSession } from "@/lib/auth/session"

import { parseWhiteLabel } from "./brand"
import { readWhiteLabel, writeWhiteLabel } from "./store"

export async function saveWhiteLabel(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession()
  if (!session) return { ok: false, error: "Sign in required." }
  const previous = await readWhiteLabel(session.userId)
  const logo = await imageDataUrl(formData.get("logo"))
  const favicon = await imageDataUrl(formData.get("favicon"))
  if (!logo.ok) return logo
  if (!favicon.ok) return favicon
  const parsed = parseWhiteLabel(
    {
      enabled: formData.get("enabled") === "on",
      appName: stringField(formData.get("appName")),
      accent: stringField(formData.get("accent")),
      hidePoweredBy: formData.get("hidePoweredBy") === "on",
      supportEmail: stringField(formData.get("supportEmail")),
      supportName: stringField(formData.get("supportName")),
      logoDataUrl: logo.value === undefined ? undefined : logo.value,
      faviconDataUrl: favicon.value === undefined ? undefined : favicon.value,
    },
    previous
  )
  if (!parsed.ok) return parsed
  await writeWhiteLabel(session.userId, parsed.value)
  return { ok: true }
}

function stringField(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : ""
}

async function imageDataUrl(
  value: FormDataEntryValue | null
): Promise<{ ok: true; value: string | null | undefined } | { ok: false; error: string }> {
  if (!(value instanceof File) || value.size === 0) return { ok: true, value: undefined }
  if (!["image/png", "image/jpeg", "image/webp"].includes(value.type)) {
    return { ok: false, error: "Use a PNG, JPG, or WebP." }
  }
  if (value.size > 350_000) return { ok: false, error: "That image is too large. Use one under about 350 KB." }
  const bytes = Buffer.from(await value.arrayBuffer())
  return { ok: true, value: `data:${value.type};base64,${bytes.toString("base64")}` }
}
