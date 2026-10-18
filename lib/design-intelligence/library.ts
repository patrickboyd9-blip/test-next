import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import {
  createAppDocumentStore,
  createFileDocumentStore,
  type DocumentStore,
} from "@/lib/storage/document-store"

/**
 * Mailer analyses from the design-knowledge seed, plus anything the private
 * research sync has stored. Images are optional. The seed has no scans.
 * Grades and principles still load before a GitHub token exists.
 */

export interface MailerAnalysis {
  id: string
  corpus?: string
  use_class?: "research_reference" | "style_reference_only" | "anti_example" | string
  mailbox_weight?: string
  vertical?: string
  grade?: string
  focal_point?: string
  eye_path?: string
  grid?: string
  scale_ratios?: string
  type_choices?: string
  palette_hex?: string[]
  photo_art_direction?: string
  offer_placement?: string
  trust_and_cta?: string
  summary?: string
  emulate?: string[]
  do_not_copy?: string[]
  anti_patterns?: string[]
  low_res?: boolean
  shared_vendor_style?: boolean
  faces?: string[]
}

export type LibrarySource = "seed" | "mando" | "c3po" | "analyzed"

export interface LibraryImage {
  role: "front" | "back" | "detail"
  /** Blob pathname or a path relative to the local design-library folder. */
  path: string
  contentType: string
}

export interface LibraryRecord {
  id: string
  source: LibrarySource
  analysis?: MailerAnalysis
  images: LibraryImage[]
  vertical?: string
  grade?: string
  needsAnalysis: boolean
  syncedAt?: string
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/

let seedCache: MailerAnalysis[] | null = null

export function seedDirectory(): string {
  return path.join(process.cwd(), "lib", "design-intelligence", "seed")
}

export function loadSeedAnalyses(directory = path.join(seedDirectory(), "analyses")): MailerAnalysis[] {
  if (seedCache && directory === path.join(seedDirectory(), "analyses")) return seedCache
  const files = readdirSync(directory).filter((name) => name.endsWith(".json")).sort()
  const analyses = files.map((name) => {
    const parsed = JSON.parse(readFileSync(path.join(directory, name), "utf8")) as MailerAnalysis
    if (!parsed.id || !SAFE_ID.test(parsed.id)) {
      throw new Error(`Seed analysis ${name} is missing a safe id.`)
    }
    return parsed
  })
  if (directory === path.join(seedDirectory(), "analyses")) seedCache = analyses
  return analyses
}

export function readSeedText(relativePath: string): string {
  const full = path.join(seedDirectory(), relativePath)
  const root = seedDirectory()
  if (!full.startsWith(root)) throw new Error("Seed path escapes the knowledge folder.")
  return readFileSync(full, "utf8")
}

export function localReferenceRoot(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.REFERENCE_LIBRARY_DIR?.trim()
  if (configured) return configured
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "reference-library")
}

/**
 * Images extracted for local use. They stay under .data, which is gitignored.
 * Provenance notes and any private/ path are ignored.
 */
export function discoverLocalImages(root = localReferenceRoot()): Map<string, LibraryImage[]> {
  const found = new Map<string, LibraryImage[]>()
  if (!existsSync(/*turbopackIgnore: true*/ root)) return found
  const indexPath = path.join(/*turbopackIgnore: true*/ root, "mando", "images", "index.json")
  if (existsSync(/*turbopackIgnore: true*/ indexPath)) {
    const index = JSON.parse(readFileSync(/*turbopackIgnore: true*/ indexPath, "utf8")) as unknown
    const rows = Array.isArray(index) ? index : []
    for (const row of rows) {
      if (!row || typeof row !== "object") continue
      const record = row as { mmr_id?: unknown; path?: unknown; side?: unknown }
      if (typeof record.mmr_id !== "string" || typeof record.path !== "string") continue
      if (isPrivatePath(record.path)) continue
      const absolute = path.resolve(/*turbopackIgnore: true*/ root, "mando", record.path)
      if (!absolute.startsWith(path.resolve(/*turbopackIgnore: true*/ root) + path.sep) || !existsSync(/*turbopackIgnore: true*/ absolute)) continue
      pushImage(found, record.mmr_id, {
        role: imageRole(typeof record.side === "string" ? record.side : record.path),
        path: path.posix.join("mando", record.path.split(path.sep).join("/")),
        contentType: contentTypeFor(record.path),
      })
    }
  }
  const physical = path.join(/*turbopackIgnore: true*/ root, "c3po", "assets", "physical")
  if (existsSync(/*turbopackIgnore: true*/ physical)) {
    for (const dir of readdirSync(/*turbopackIgnore: true*/ physical)) {
      if (!/^PM-\d+$/.test(dir)) continue
      const folder = path.join(/*turbopackIgnore: true*/ physical, dir)
      for (const file of readdirSync(/*turbopackIgnore: true*/ folder)) {
        if (!/\.(jpe?g|png|webp)$/i.test(file)) continue
        if (isPrivatePath(file)) continue
        pushImage(found, dir, {
          role: imageRole(file),
          path: path.posix.join("c3po", "assets", "physical", dir, file),
          contentType: contentTypeFor(file),
        })
      }
    }
  }
  for (const images of found.values()) {
    images.sort((a, b) => roleRank(a.role) - roleRank(b.role))
  }
  return found
}

function pushImage(found: Map<string, LibraryImage[]>, id: string, image: LibraryImage): void {
  const list = found.get(id) ?? []
  if (!list.some((item) => item.path === image.path)) list.push(image)
  found.set(id, list)
}

function imageRole(value: string): LibraryImage["role"] {
  if (/back/i.test(value)) return "back"
  if (/detail/i.test(value)) return "detail"
  return "front"
}

function roleRank(role: LibraryImage["role"]): number {
  if (role === "front") return 0
  if (role === "back") return 1
  return 2
}

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".png")) return "image/png"
  if (filePath.endsWith(".webp")) return "image/webp"
  return "image/jpeg"
}

function isPrivatePath(filePath: string): boolean {
  return filePath.replace(/\\/g, "/").split("/").some((part) => part.toLowerCase() === "private" || part.startsWith(".."))
}

export function seedRecords(): LibraryRecord[] {
  return loadSeedAnalyses().map((analysis) => ({
    id: analysis.id,
    source: "seed" as const,
    analysis,
    images: [],
    vertical: analysis.vertical,
    grade: analysis.grade,
    needsAnalysis: false,
  }))
}

export function designLibraryStore(options?: {
  dataDir?: string
  store?: DocumentStore
}): DocumentStore {
  if (options?.store) return options.store
  if (options?.dataDir) return createFileDocumentStore(options.dataDir)
  return createAppDocumentStore("design_library")
}

/**
 * Seed analyses win on id until a synced record brings an image or a newer
 * analysis. A synced record without an analysis keeps the seed reading.
 */
export async function loadLibrary(options?: {
  dataDir?: string
  store?: DocumentStore
}): Promise<LibraryRecord[]> {
  const merged = new Map<string, LibraryRecord>()
  for (const record of seedRecords()) merged.set(record.id, record)

  let store: DocumentStore
  try {
    store = designLibraryStore(options)
  } catch {
    return [...merged.values()]
  }

  const index = await store.get("index")
  const ids = indexIds(index)
  for (const id of ids) {
    if (!SAFE_ID.test(id) || id === "index") continue
    const raw = await store.get(id)
    const synced = parseStoredRecord(raw)
    if (!synced) continue
    const existing = merged.get(synced.id)
    merged.set(synced.id, mergeRecord(existing, synced))
  }
  for (const [id, images] of discoverLocalImages()) {
    const existing = merged.get(id)
    if (!existing) {
      merged.set(id, {
        id,
        source: id.startsWith("PM-") ? "c3po" : "mando",
        images,
        needsAnalysis: true,
      })
      continue
    }
    if (existing.images.length === 0) merged.set(id, { ...existing, images })
  }
  return [...merged.values()]
}

export function mergeRecord(existing: LibraryRecord | undefined, synced: LibraryRecord): LibraryRecord {
  if (!existing) return synced
  return {
    ...existing,
    ...synced,
    analysis: synced.analysis ?? existing.analysis,
    images: synced.images.length > 0 ? synced.images : existing.images,
    vertical: synced.vertical ?? existing.vertical ?? existing.analysis?.vertical,
    grade: synced.grade ?? existing.grade ?? existing.analysis?.grade,
    needsAnalysis: synced.analysis || existing.analysis ? false : synced.needsAnalysis,
    source: synced.source,
  }
}

export function parseStoredRecord(raw: unknown): LibraryRecord | null {
  if (!raw || typeof raw !== "object") return null
  const record = raw as Partial<LibraryRecord>
  if (!record.id || !SAFE_ID.test(record.id)) return null
  if (record.source !== "mando" && record.source !== "c3po" && record.source !== "analyzed" && record.source !== "seed") {
    return null
  }
  return {
    id: record.id,
    source: record.source,
    analysis: record.analysis && typeof record.analysis === "object" ? record.analysis : undefined,
    images: Array.isArray(record.images) ? record.images.filter(isImage) : [],
    vertical: typeof record.vertical === "string" ? record.vertical : undefined,
    grade: typeof record.grade === "string" ? record.grade : undefined,
    needsAnalysis: Boolean(record.needsAnalysis),
    syncedAt: typeof record.syncedAt === "string" ? record.syncedAt : undefined,
  }
}

function isImage(value: unknown): value is LibraryImage {
  if (!value || typeof value !== "object") return false
  const image = value as LibraryImage
  return (
    (image.role === "front" || image.role === "back" || image.role === "detail") &&
    typeof image.path === "string" &&
    image.path.length > 0 &&
    !image.path.split("/").includes("private")
  )
}

function indexIds(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return []
  const ids = (raw as { ids?: unknown }).ids
  if (!Array.isArray(ids)) return []
  return ids.filter((id): id is string => typeof id === "string")
}

export function gradeRank(grade: string | undefined): number {
  const order = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"]
  const index = order.indexOf(grade ?? "")
  return index < 0 ? order.length : index
}

export function isAntiExample(record: Pick<LibraryRecord, "id" | "analysis">): boolean {
  if (record.analysis?.use_class === "anti_example") return true
  return record.id === "MMR-513" || record.id === "MMR-047" || record.id === "MMR-047-2" || record.id === "PM-011"
}

export { DEFAULT_OWNER_FAVORITE_IDS as BENCHMARK_ANCHOR_IDS } from "./owner-favorites"
