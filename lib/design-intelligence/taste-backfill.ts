import { existsSync, readdirSync, readFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"

import type { DocumentStore } from "@/lib/storage/document-store"

import { isForbiddenResearchPath, readRecordImage } from "./images"
import { discoverLocalImages, loadLibrary, localReferenceRoot, type LibraryImage } from "./library"
import type { TasteAnalysis } from "./taste"
import { listTaste, readTaste, tasteStore, writeTaste } from "./taste-store"
import { analyzeMailerTaste } from "./taste-vision"

/**
 * Analyzes reference images that do not yet have a vision reading.
 * One batch per run. The daily sync calls this with a small cap.
 * The backfill script and the protected endpoint call it until the backlog is gone.
 * Anything under private/ is skipped and never stored.
 */

export interface TasteImageJob {
  id: string
  path: string
  mediaType: "image/jpeg" | "image/png" | "image/webp"
  bytes?: Buffer
  load?: () => Promise<Buffer | null>
}

export interface TasteBackfillReport {
  status: "ok" | "skipped" | "partial"
  reason?: string
  analyzed: string[]
  skippedExisting: number
  skippedPrivate: string[]
  remaining: number
  errors: string[]
}

export async function backfillDesignTaste(input?: {
  batch?: number
  env?: NodeJS.ProcessEnv
  store?: DocumentStore
  root?: string
  analyze?: (job: TasteImageJob) => Promise<TasteAnalysis | null>
  now?: string
}): Promise<TasteBackfillReport> {
  const env = input?.env ?? process.env
  const batch = batchSize(input?.batch, env)
  const store = input?.store ?? tasteStore()
  const jobs = await jobsNeedingTaste(store, input?.root ?? localReferenceRoot(env))
  const report: TasteBackfillReport = {
    status: "ok",
    analyzed: [],
    skippedExisting: 0,
    skippedPrivate: jobs.skippedPrivate,
    remaining: jobs.pending.length,
    errors: [],
  }
  if (jobs.pending.length === 0) return report
  const analyze = input?.analyze ?? (env.ANTHROPIC_API_KEY?.trim() ? defaultAnalyze(env, input?.now) : null)
  if (!analyze) {
    return {
      ...report,
      status: "skipped",
      reason: "ANTHROPIC_API_KEY is not set. Vision taste waits. Written notes still load.",
    }
  }
  for (const job of jobs.pending.slice(0, batch)) {
    if (isForbiddenResearchPath(job.path) || job.id.toLowerCase().includes("private")) {
      report.skippedPrivate.push(job.path || job.id)
      continue
    }
    try {
      const bytes = job.bytes ?? (job.load ? await job.load() : await readFile(job.path))
      if (!bytes) {
        report.errors.push(`${job.id} has no image bytes.`)
        continue
      }
      const analysis = await analyze({ ...job, bytes })
      if (!analysis || analysis.id !== job.id) {
        report.errors.push(`${job.id} did not return a grounded analysis.`)
        continue
      }
      await writeTaste(store, analysis)
      report.analyzed.push(job.id)
    } catch (error) {
      report.errors.push(error instanceof Error ? error.message : `${job.id} failed.`)
    }
  }
  report.remaining = Math.max(0, jobs.pending.length - report.analyzed.length)
  if (report.errors.length > 0) report.status = report.analyzed.length > 0 ? "partial" : "partial"
  return report
}

async function jobsNeedingTaste(
  store: DocumentStore,
  root: string
): Promise<{ pending: TasteImageJob[]; skippedPrivate: string[] }> {
  const known = new Set((await listTaste(store)).map((item) => item.id))
  const skippedPrivate = privatePathsUnder(root)
  const pending = new Map<string, TasteImageJob>()

  for (const [id, images] of discoverLocalImages(root)) {
    if (id.toLowerCase().includes("private")) {
      skippedPrivate.push(id)
      continue
    }
    if (known.has(id) || (await readTaste(store, id))) continue
    const image = frontImage(images)
    if (!image) continue
    if (isForbiddenResearchPath(image.path)) {
      skippedPrivate.push(image.path)
      continue
    }
    const mediaType = mediaTypeFor(image)
    if (!mediaType) continue
    const absolute = path.resolve(root, image.path)
    if (!absolute.startsWith(path.resolve(root) + path.sep)) continue
    pending.set(id, { id, path: absolute, mediaType })
  }

  const records = await loadLibrary().catch(() => [])
  for (const record of records) {
    if (known.has(record.id) || pending.has(record.id)) continue
    if (await readTaste(store, record.id)) continue
    const image = frontImage(record.images)
    if (!image || isForbiddenResearchPath(image.path)) {
      if (image && isForbiddenResearchPath(image.path)) skippedPrivate.push(image.path)
      continue
    }
    const mediaType = mediaTypeFor(image)
    if (!mediaType) continue
    pending.set(record.id, {
      id: record.id,
      path: image.path,
      mediaType,
      load: async () => (await readRecordImage(record))?.bytes ?? null,
    })
  }

  return { pending: [...pending.values()].sort((a, b) => a.id.localeCompare(b.id)), skippedPrivate }
}

function defaultAnalyze(env: NodeJS.ProcessEnv, now?: string) {
  return async (job: TasteImageJob): Promise<TasteAnalysis | null> => {
    if (!job.bytes) return null
    const result = await analyzeMailerTaste({
      id: job.id,
      bytes: job.bytes,
      mediaType: job.mediaType,
      env,
      now,
    })
    return result.analysis
  }
}

/**
 * The image index drops private/ before discovery. The report still names
 * those paths so a backfill can show what it refused to read.
 */
function privatePathsUnder(root: string): string[] {
  const skipped: string[] = []
  const indexPath = path.join(root, "mando", "images", "index.json")
  if (existsSync(indexPath)) {
    try {
      const index = JSON.parse(readFileSync(indexPath, "utf8")) as unknown
      const rows = Array.isArray(index) ? index : []
      for (const row of rows) {
        if (!row || typeof row !== "object") continue
        const record = row as { path?: unknown }
        if (typeof record.path !== "string") continue
        const relative = path.posix.join("mando", record.path.split(path.sep).join("/"))
        if (isForbiddenResearchPath(relative)) skipped.push(relative)
      }
    } catch {
      skipped.push("mando/images/index.json")
    }
  }
  const physical = path.join(root, "c3po", "assets", "physical")
  if (existsSync(physical)) {
    for (const entry of readdirSync(physical, { withFileTypes: true })) {
      const relative = path.posix.join("c3po", "assets", "physical", entry.name)
      if (isForbiddenResearchPath(relative)) skipped.push(relative)
    }
  }
  return skipped
}

function frontImage(images: readonly LibraryImage[]): LibraryImage | undefined {
  return [...images].sort((a, b) => (a.role === "front" ? -1 : 1) - (b.role === "front" ? -1 : 1))[0]
}

function mediaTypeFor(image: LibraryImage): TasteImageJob["mediaType"] | null {
  if (image.contentType === "image/jpeg" || image.contentType === "image/png" || image.contentType === "image/webp") {
    return image.contentType
  }
  if (image.path.endsWith(".png")) return "image/png"
  if (image.path.endsWith(".webp")) return "image/webp"
  if (/\.jpe?g$/i.test(image.path)) return "image/jpeg"
  return null
}

export function batchSize(explicit: number | undefined, env: NodeJS.ProcessEnv): number {
  const parsed = explicit ?? Number(env.DESIGN_TASTE_BATCH ?? env.DESIGN_TASTE_CAP ?? 4)
  if (!Number.isFinite(parsed)) return 4
  return Math.max(1, Math.min(12, Math.round(parsed)))
}
