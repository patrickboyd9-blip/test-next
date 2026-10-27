import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { normalizeUspsCrid } from "./usps-crid"

/**
 * There is no customer account yet. The CRID is also saved on the campaign's
 * business record. This file lets the next campaign on this machine show it
 * again so the customer does not type it twice.
 */
export async function readRememberedUspsCrid(dir = defaultDir()): Promise<string | null> {
  try {
    const raw = await readFile(path.join(dir, "usps-crid.json"), "utf8")
    const parsed = JSON.parse(raw) as { crid?: unknown }
    return normalizeUspsCrid(typeof parsed.crid === "string" ? parsed.crid : "")
  } catch {
    return null
  }
}

export async function writeRememberedUspsCrid(crid: string, dir = defaultDir()): Promise<void> {
  const normalized = normalizeUspsCrid(crid)
  if (!normalized) return
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, "usps-crid.json"), JSON.stringify({ crid: normalized }))
}

function defaultDir(): string {
  return path.join(process.cwd(), ".data")
}
