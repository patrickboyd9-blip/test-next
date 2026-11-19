import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { ImageGenerationAdapter } from "@/lib/campaign-creator/image-generation"
import { POSTCARD_SLOT_ASPECT } from "@/lib/campaign-creator/image-generation"
import { IMAGEN_IMAGE_MODEL } from "@/lib/campaign-creator/replicate-image-generation"

import {
  CENTS_PER_IMAGE,
  EXPANSION_HARD_CAP_CENTS,
  expansionSpendDecision,
  planGalleryExpansion,
  type GalleryExpansionSlot,
} from "./gallery-expansion"

export interface ExpansionSpendEntry {
  templateId: string
  usd: string
  at: string
  status: "saved" | "failed"
}

export interface ExpansionSpendLog {
  currency: "USD"
  hardCapUsd: string
  estimateUsd: string
  totalUsd: string
  entries: ExpansionSpendEntry[]
}

export function emptyExpansionSpendLog(): ExpansionSpendLog {
  return {
    currency: "USD",
    hardCapUsd: usd(EXPANSION_HARD_CAP_CENTS),
    estimateUsd: usd(CENTS_PER_IMAGE),
    totalUsd: usd(0),
    entries: [],
  }
}

export interface ExpansionRunOptions {
  limit?: number
  dryRun?: boolean
  adapter?: ImageGenerationAdapter
  photoDir?: string
  spendPath?: string
  manifestPath?: string
  jobs?: GalleryExpansionSlot[]
}

export interface ExpansionRunResult {
  planned: number
  requested: number
  saved: number
  spentCents: number
  stopped: "ceiling" | "limit" | "done"
}

/** Runs the expansion. Tests pass a mock adapter. The script passes the Replicate adapter. */
export async function runGalleryExpansion(options: ExpansionRunOptions = {}): Promise<ExpansionRunResult> {
  const jobs = (options.jobs ?? planGalleryExpansion().items).slice(0, options.limit ?? Number.POSITIVE_INFINITY)
  const spendPath = options.spendPath ?? path.join(process.cwd(), ".data", "gallery-expansion-spend.json")
  const photoDir = options.photoDir ?? path.join(process.cwd(), "public", "gallery")
  const manifestPath = options.manifestPath ?? path.join(process.cwd(), "lib", "mail-templates", "gallery-photo-manifest.json")
  const spend = await readSpend(spendPath)
  let spent = spend.entries.reduce((sum, entry) => sum + cents(entry.usd), 0)
  let requested = 0
  let saved = 0
  let stopped: ExpansionRunResult["stopped"] = "done"

  if (options.dryRun) {
    return { planned: jobs.length, requested: 0, saved: 0, spentCents: spent, stopped: "done" }
  }
  if (!options.adapter) throw new Error("No picture adapter was provided. No photograph was requested.")

  await mkdir(photoDir, { recursive: true })
  for (const job of jobs) {
    const already = spend.entries.some((entry) => entry.templateId === job.id && entry.status === "saved")
    if (already) continue
    if (expansionSpendDecision(spent, CENTS_PER_IMAGE) !== "ok") {
      stopped = "ceiling"
      break
    }
    spent += CENTS_PER_IMAGE
    requested += 1
    spend.totalUsd = usd(spent)
    spend.entries.push({ templateId: job.id, usd: usd(CENTS_PER_IMAGE), at: new Date().toISOString(), status: "failed" })
    await writeSpend(spendPath, spend)
    try {
      const asset = await options.adapter.generate(job.brief, { slotAspect: POSTCARD_SLOT_ASPECT })
      const png = pngFromDataUrl(asset.src)
      await writeFile(path.join(photoDir, job.fileName), png)
      const entry = spend.entries.at(-1)
      if (entry) entry.status = "saved"
      await writeSpend(spendPath, spend)
      await upsertManifest(manifestPath, job.id, job.publicPath)
      saved += 1
    } catch (error) {
      await writeSpend(spendPath, spend)
      throw error
    }
  }
  if (options.limit !== undefined && requested >= options.limit && stopped === "done") stopped = "limit"
  return { planned: jobs.length, requested, saved, spentCents: spent, stopped }
}

export function expansionModelName(): string {
  return IMAGEN_IMAGE_MODEL
}

function usd(cents: number): string {
  return (cents / 100).toFixed(2)
}

function cents(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

async function readSpend(file: string): Promise<ExpansionSpendLog> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as ExpansionSpendLog
    if (!Array.isArray(parsed.entries)) return emptyExpansionSpendLog()
    return { ...emptyExpansionSpendLog(), ...parsed, entries: parsed.entries }
  } catch {
    return emptyExpansionSpendLog()
  }
}

async function writeSpend(file: string, spend: ExpansionSpendLog): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(spend, null, 2)}\n`)
}

async function upsertManifest(file: string, id: string, src: string): Promise<void> {
  const current = JSON.parse(await readFile(file, "utf8").catch(() => "{\"photos\":[]}")) as { photos: { id: string; src: string }[] }
  const photos = (current.photos ?? []).filter((photo) => photo.id !== id)
  photos.push({ id, src })
  photos.sort((a, b) => a.id.localeCompare(b.id))
  await writeFile(file, `${JSON.stringify({ photos }, null, 2)}\n`)
}

function pngFromDataUrl(src: string): Buffer {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(src)
  if (!match?.[1]) throw new Error("The photo was not a PNG.")
  return Buffer.from(match[1], "base64")
}
