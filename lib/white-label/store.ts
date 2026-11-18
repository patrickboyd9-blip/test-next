import { createHash } from "node:crypto"

import { createAppDocumentStore } from "@/lib/storage/document-store"

import { defaultWhiteLabel, type WhiteLabelSettings } from "./brand"

function keyFor(ownerId: string): string {
  return createHash("sha256").update(ownerId).digest("hex").slice(0, 32)
}

export async function readWhiteLabel(ownerId: string): Promise<WhiteLabelSettings> {
  const store = createAppDocumentStore("white_label")
  const raw = await store.get(keyFor(ownerId))
  if (!raw || typeof raw !== "object") return defaultWhiteLabel()
  const record = raw as Partial<WhiteLabelSettings>
  return {
    ...defaultWhiteLabel(),
    ...record,
    enabled: record.enabled !== false,
    logoDataUrl: typeof record.logoDataUrl === "string" ? record.logoDataUrl : null,
    faviconDataUrl: typeof record.faviconDataUrl === "string" ? record.faviconDataUrl : null,
  }
}

export async function writeWhiteLabel(ownerId: string, settings: WhiteLabelSettings): Promise<void> {
  const store = createAppDocumentStore("white_label")
  await store.put(keyFor(ownerId), { ...settings, ownerId })
}
