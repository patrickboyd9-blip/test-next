import type { DocumentStore } from "@/lib/storage/document-store"

import { isForbiddenResearchPath, saveLibraryImage } from "./images"
import {
  designLibraryStore,
  loadSeedAnalyses,
  parseStoredRecord,
  type LibraryRecord,
  type MailerAnalysis,
} from "./library"

/**
 * Pulls new mailers from the private research repo.
 * Mando: main branch, images/index.json plus records.
 * C-3PO: cursor/visual-reference-corpus-3752, assets/physical and the intake manifest.
 * Anything under a private/ folder is skipped and never stored.
 * Without RESEARCH_GITHUB_TOKEN the seed analyses still load.
 */

export const DEFAULT_RESEARCH_REPO = "patrickboyd9-blip/modern-mail-research"
export const DEFAULT_MANDO_REF = "main"
export const DEFAULT_C3PO_REF = "cursor/visual-reference-corpus-3752"

export interface SyncEntry {
  id: string
  source: "mando" | "c3po"
  vertical?: string
  imagePath?: string
  recordPath?: string
  skippedPrivate: string[]
}

export interface GithubContentEntry {
  name: string
  path: string
  type: "file" | "dir"
}

export interface GithubReader {
  getJson(filePath: string, ref: string): Promise<unknown | null>
  getBytes(filePath: string, ref: string): Promise<{ bytes: Buffer; contentType: string } | null>
  listDir?(dirPath: string, ref: string): Promise<GithubContentEntry[]>
}

export interface SyncReport {
  status: "skipped" | "ok" | "partial"
  reason?: string
  added: string[]
  analyzed: string[]
  skippedPrivate: string[]
  errors: string[]
}

export function entriesFromMandoIndex(index: unknown): SyncEntry[] {
  const rows = rowsOf(index, ["records", "items", "images"])
  return rows.flatMap((row) => {
    if (typeof row === "string") {
      return [{ id: row, source: "mando" as const, imagePath: `images/${row}.jpg`, skippedPrivate: [] }]
    }
    if (!row || typeof row !== "object") return []
    const record = row as Record<string, unknown>
    const id = stringField(record, ["id", "mmrId", "mmr_id", "name"])
    if (!id) return []
    // Mando's images/index.json uses `path` for the jpeg (images/MMR-019.jpg).
    // A non-image path is a written record, not a photograph.
    const pathValue = stringField(record, ["path"])
    const pathIsImage = Boolean(pathValue && /\.(jpe?g|png|webp)$/i.test(pathValue))
    const imagePath = stringField(record, ["image", "imagePath", "front", "src"]) ?? (pathIsImage ? pathValue : undefined)
    const recordPath = stringField(record, ["record", "recordPath"]) ?? (pathValue && !pathIsImage ? pathValue : undefined)
    return [entry("mando", id, imagePath, recordPath, stringField(record, ["vertical"]))]
  })
}

export function entriesFromC3poManifest(manifest: unknown): SyncEntry[] {
  const rows = rowsOf(manifest, ["pieces", "items", "mailers", "records"])
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return []
    const record = row as Record<string, unknown>
    const id = stringField(record, ["id", "pmId", "name"])
    if (!id) return []
    const files = Array.isArray(record.files) ? record.files.filter((file): file is string => typeof file === "string") : []
    const imagePath = files.find((file) => !isForbiddenResearchPath(file) && /\.(jpe?g|png|webp)$/i.test(file))
      ?? stringField(record, ["front", "image", "src"])
    return [entry("c3po", id, imagePath ?? `assets/physical/${id}/front.jpg`, stringField(record, ["record", "analysis"]), stringField(record, ["vertical"]), files)]
  })
}

export async function syncReferenceLibraries(input: {
  env?: NodeJS.ProcessEnv
  reader?: GithubReader
  store?: DocumentStore
  analyze?: (entry: SyncEntry, bytes: Buffer) => Promise<MailerAnalysis | null>
  now?: string
}): Promise<SyncReport> {
  const env = input.env ?? process.env
  const token = env.RESEARCH_GITHUB_TOKEN?.trim()
  if (!token && !input.reader) {
    return {
      status: "skipped",
      reason: "RESEARCH_GITHUB_TOKEN is not set. Seed analyses still load.",
      added: [],
      analyzed: [],
      skippedPrivate: [],
      errors: [],
    }
  }
  const reader = input.reader ?? githubReader(token!, env)
  const repoNote = env.RESEARCH_GITHUB_REPO?.trim() || DEFAULT_RESEARCH_REPO
  const mandoRef = env.RESEARCH_MANDO_REF?.trim() || DEFAULT_MANDO_REF
  const c3poRef = env.RESEARCH_C3PO_REF?.trim() || DEFAULT_C3PO_REF
  const report: SyncReport = { status: "ok", added: [], analyzed: [], skippedPrivate: [], errors: [] }
  const entries: SyncEntry[] = []
  try {
    const index = await reader.getJson("images/index.json", mandoRef)
    if (index) entries.push(...entriesFromMandoIndex(index))
    else report.errors.push(`${repoNote}@${mandoRef} has no images/index.json yet.`)
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : "Mando index failed.")
  }
  try {
    const manifest = await reader.getJson("reports/physical-intake-manifest.json", c3poRef)
    if (manifest) entries.push(...entriesFromC3poManifest(manifest))
    else report.errors.push(`${repoNote}@${c3poRef} has no physical-intake manifest yet.`)
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : "C-3PO manifest failed.")
  }
  if (reader.listDir) {
    try {
      entries.push(...(await entriesFromPhysicalTree(reader, c3poRef)))
    } catch (error) {
      report.errors.push(error instanceof Error ? error.message : "C-3PO folder listing failed.")
    }
  }

  const deduped = new Map<string, SyncEntry>()
  for (const entry of entries) {
    const current = deduped.get(entry.id)
    if (!current) {
      deduped.set(entry.id, entry)
      continue
    }
    deduped.set(entry.id, {
      ...current,
      imagePath: current.imagePath ?? entry.imagePath,
      recordPath: current.recordPath ?? entry.recordPath,
      vertical: current.vertical ?? entry.vertical,
      skippedPrivate: [...current.skippedPrivate, ...entry.skippedPrivate],
    })
  }
  const planned = [...deduped.values()]

  const store = input.store ?? designLibraryStore()
  const known = new Set(loadSeedAnalyses().map((analysis) => analysis.id))
  const index = await store.get("index")
  const storedIds = new Set(indexIds(index))
  const batch = Math.max(1, Math.min(80, Number(env.DESIGN_SYNC_BATCH ?? 40) || 40))
  const analyzeCap = Math.max(0, Math.min(12, Number(env.DESIGN_ANALYZE_CAP ?? 8) || 8))
  let analyzed = 0
  const kept: string[] = [...storedIds]

  for (const entry of planned) {
    report.skippedPrivate.push(...entry.skippedPrivate)
    if (!entry.imagePath && entry.skippedPrivate.length > 0) continue
    if (report.added.length >= batch) break
    if (storedIds.has(entry.id) && known.has(entry.id)) continue
    if (isForbiddenResearchPath(entry.imagePath ?? "") || isForbiddenResearchPath(entry.recordPath ?? "")) {
      report.skippedPrivate.push(entry.imagePath || entry.recordPath || entry.id)
      continue
    }
    const existingRaw = await store.get(entry.id)
    const existing = parseStoredRecord(existingRaw)
    let images = existing?.images ?? []
    if (entry.imagePath && images.length === 0) {
      const file = await reader.getBytes(entry.imagePath, entry.source === "mando" ? mandoRef : c3poRef)
      if (file && !isForbiddenResearchPath(entry.imagePath)) {
        const saved = await saveLibraryImage({
          id: entry.id,
          fileName: entry.imagePath.split("/").pop() || "front.jpg",
          bytes: file.bytes,
          contentType: file.contentType,
          env,
        })
        images = [saved]
      }
    }
    let analysis = existing?.analysis
    if (!analysis && !known.has(entry.id) && images.length > 0 && input.analyze && analyzed < analyzeCap) {
      const file = entry.imagePath
        ? await reader.getBytes(entry.imagePath, entry.source === "mando" ? mandoRef : c3poRef)
        : null
      if (file) {
        analysis = (await input.analyze(entry, file.bytes)) ?? undefined
        if (analysis) {
          analyzed += 1
          report.analyzed.push(entry.id)
        }
      }
    }
    const record: LibraryRecord = {
      id: entry.id,
      source: analysis && !existing?.analysis && !known.has(entry.id) ? "analyzed" : entry.source,
      analysis,
      images,
      vertical: entry.vertical ?? analysis?.vertical,
      grade: analysis?.grade,
      needsAnalysis: !analysis && !known.has(entry.id),
      syncedAt: input.now ?? new Date().toISOString(),
    }
    await store.put(entry.id, record)
    if (!kept.includes(entry.id)) {
      kept.push(entry.id)
      report.added.push(entry.id)
    }
  }
  await store.put("index", { ids: kept })
  if (report.errors.length > 0) report.status = report.added.length > 0 ? "partial" : "partial"
  return report
}

/** PM folders on the C-3PO branch. The intake manifest records uploads, not ids. */
export async function entriesFromPhysicalTree(reader: GithubReader, ref: string): Promise<SyncEntry[]> {
  if (!reader.listDir) return []
  const dirs = await reader.listDir("assets/physical", ref)
  const entries: SyncEntry[] = []
  for (const dir of dirs) {
    if (dir.type !== "dir" || !/^PM-\d+$/.test(dir.name)) continue
    if (isForbiddenResearchPath(dir.path)) {
      entries.push({ id: dir.name, source: "c3po", skippedPrivate: [dir.path] })
      continue
    }
    const files = await reader.listDir(dir.path, ref)
    const skippedPrivate = files.filter((file) => isForbiddenResearchPath(file.path)).map((file) => file.path)
    const images = files.filter((file) => file.type === "file" && /\.(jpe?g|png|webp)$/i.test(file.name) && !isForbiddenResearchPath(file.path))
    const front = images.find((file) => /front/i.test(file.name)) ?? images[0]
    entries.push({
      id: dir.name,
      source: "c3po",
      imagePath: front?.path,
      skippedPrivate,
    })
  }
  return entries
}

export function githubReader(token: string, env: NodeJS.ProcessEnv): GithubReader {
  const repo = env.RESEARCH_GITHUB_REPO?.trim() || DEFAULT_RESEARCH_REPO
  return {
    async getJson(filePath, ref) {
      if (isForbiddenResearchPath(filePath)) return null
      const response = await fetch(contentsUrl(repo, filePath, ref), { headers: githubHeaders(token, "application/vnd.github.raw") })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`GitHub ${response.status} for ${filePath}`)
      return (await response.json()) as unknown
    },
    async getBytes(filePath, ref) {
      if (isForbiddenResearchPath(filePath)) return null
      const response = await fetch(contentsUrl(repo, filePath, ref), { headers: githubHeaders(token, "application/vnd.github.raw") })
      if (!response.ok) return null
      const bytes = Buffer.from(await response.arrayBuffer())
      const contentType = response.headers.get("content-type")?.split(";")[0] || contentTypeFor(filePath)
      return { bytes, contentType }
    },
    async listDir(dirPath, ref) {
      if (isForbiddenResearchPath(dirPath)) return []
      const response = await fetch(contentsUrl(repo, dirPath, ref), {
        headers: githubHeaders(token, "application/vnd.github+json"),
      })
      if (response.status === 404) return []
      if (!response.ok) throw new Error(`GitHub ${response.status} for ${dirPath}`)
      const payload = (await response.json()) as unknown
      if (!Array.isArray(payload)) return []
      return payload.flatMap((item) => {
        if (!item || typeof item !== "object") return []
        const row = item as { name?: unknown; path?: unknown; type?: unknown }
        if (typeof row.name !== "string" || typeof row.path !== "string") return []
        if (row.type !== "file" && row.type !== "dir") return []
        if (isForbiddenResearchPath(row.path)) return []
        return [{ name: row.name, path: row.path, type: row.type }]
      })
    },
  }
}

function entry(
  source: "mando" | "c3po",
  id: string,
  imagePath: string | undefined,
  recordPath: string | undefined,
  vertical: string | undefined,
  extraPaths: string[] = []
): SyncEntry {
  const skippedPrivate = [imagePath, recordPath, ...extraPaths].filter((file): file is string => Boolean(file && isForbiddenResearchPath(file)))
  return {
    id,
    source,
    vertical,
    imagePath: imagePath && !isForbiddenResearchPath(imagePath) ? imagePath : undefined,
    recordPath: recordPath && !isForbiddenResearchPath(recordPath) ? recordPath : undefined,
    skippedPrivate,
  }
}

function rowsOf(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== "object") return []
  const record = value as Record<string, unknown>
  for (const key of keys) {
    const candidate = record[key]
    if (Array.isArray(candidate)) return candidate
  }
  return []
}

function stringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return undefined
}

function indexIds(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return []
  const ids = (raw as { ids?: unknown }).ids
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []
}

function contentsUrl(repo: string, filePath: string, ref: string): string {
  const encoded = filePath.split("/").map(encodeURIComponent).join("/")
  return `https://api.github.com/repos/${repo}/contents/${encoded}?ref=${encodeURIComponent(ref)}`
}

function githubHeaders(token: string, accept: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "modern-mail-design-library",
  }
}

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".png")) return "image/png"
  if (filePath.endsWith(".webp")) return "image/webp"
  return "image/jpeg"
}
