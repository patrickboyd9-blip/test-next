import type { DocumentStore } from "@/lib/storage/document-store"
import { designLibraryStore } from "@/lib/design-intelligence/library"
import {
  DEFAULT_C3PO_REF,
  DEFAULT_MANDO_REF,
  DEFAULT_RESEARCH_REPO,
  githubReader,
  type GithubReader,
} from "@/lib/design-intelligence/sync"
import { isForbiddenResearchPath } from "@/lib/design-intelligence/images"

import type { CampaignBrief } from "@/lib/campaign-creator/types"

import { coverageStats } from "./coverage"
import { indexSourceFiles, type SourceFile } from "./parse"
import { queryFromBrief, retrieveResearch } from "./retrieve"
import type { PendingFile, ResearchIndex, RetrievalHit } from "./types"

const INDEX_ID = "research-text-index"
const VERSION = 1 as const

let memory: ResearchIndex | null = null

export function emptyResearchIndex(reason: string, now = new Date().toISOString()): ResearchIndex {
  const coverage = [{ path: "modern-mail-research", status: "skipped" as const, kind: "library" as const, reason }]
  return {
    version: VERSION,
    builtAt: now,
    entries: [],
    coverage,
    pending: [],
    stats: coverageStats([], coverage, 0),
  }
}

export async function loadResearchIndex(store: DocumentStore = designLibraryStore()): Promise<ResearchIndex> {
  if (memory) return memory
  try {
    const raw = await store.get(INDEX_ID)
    const parsed = parseStoredIndex(raw)
    if (parsed) {
      memory = parsed
      return parsed
    }
  } catch {
    return emptyResearchIndex("The research index could not be read. Generation continues without it.")
  }
  return emptyResearchIndex("The research index has not been built yet. The daily sync builds it when RESEARCH_GITHUB_TOKEN is set.")
}

export function rememberResearchIndex(index: ResearchIndex): void {
  memory = index
}

export function clearResearchIndexMemory(): void {
  memory = null
}

export async function refreshResearchIndex(input: {
  env?: NodeJS.ProcessEnv
  reader?: GithubReader
  store?: DocumentStore
  now?: string
  /** Files to fetch this call. The coverage script passes a high number. */
  batchSize?: number
  /** Keep fetching until the queue is empty or this many rounds finish. */
  rounds?: number
} = {}): Promise<ResearchIndex> {
  const env = input.env ?? process.env
  const store = input.store ?? designLibraryStore()
  const token = env.RESEARCH_GITHUB_TOKEN?.trim()
  if (!token && !input.reader) {
    const cached = await loadResearchIndex(store)
    if (cached.entries.length > 0) return cached
    const empty = emptyResearchIndex("RESEARCH_GITHUB_TOKEN is not set. The private library was not read. Generation keeps the written seed until the token is set on the server.")
    await store.put(INDEX_ID, empty)
    memory = empty
    return empty
  }
  const reader = input.reader ?? githubReader(token!, env)
  if (!reader.listTree || !reader.getText) {
    const failed = emptyResearchIndex("This GitHub reader cannot list the research tree.")
    memory = failed
    return failed
  }
  const mandoRef = env.RESEARCH_MANDO_REF?.trim() || DEFAULT_MANDO_REF
  const c3poRef = env.RESEARCH_C3PO_REF?.trim() || DEFAULT_C3PO_REF
  const batchSize = Math.max(1, Math.min(400, input.batchSize ?? batchFromEnv(env)))
  const rounds = Math.max(1, Math.min(12, input.rounds ?? 1))
  let current = parseStoredIndex(await store.get(INDEX_ID)) ?? emptyResearchIndex("Building the research index.")
  for (let round = 0; round < rounds; round += 1) {
    current = await refreshOnce({
      reader,
      mandoRef,
      c3poRef,
      previous: current,
      batchSize,
      now: input.now ?? new Date().toISOString(),
    })
    await store.put(INDEX_ID, current)
    memory = current
    if (current.pending.length === 0) break
  }
  return current
}

async function refreshOnce(input: {
  reader: GithubReader
  mandoRef: string
  c3poRef: string
  previous: ResearchIndex
  batchSize: number
  now: string
}): Promise<ResearchIndex> {
  const coverageNotes: ResearchIndex["coverage"] = []
  const candidates: Candidate[] = []
  for (const ref of ["mando", "c3po"] as const) {
    const branch = ref === "mando" ? input.mandoRef : input.c3poRef
    try {
      const tree = await input.reader.listTree!(branch)
      if (tree.truncated) {
        coverageNotes.push({
          path: `${ref}@${branch}`,
          status: "skipped",
          kind: "library",
          reason: "GitHub truncated the file tree. Run the coverage script again to continue.",
        })
      }
      candidates.push(...candidatesFromTree(tree.entries, ref))
    } catch (error) {
      coverageNotes.push({
        path: `${ref}@${branch}`,
        status: "skipped",
        kind: "library",
        reason: error instanceof Error ? error.message : "The research tree could not be listed.",
      })
    }
  }
  const privateCount = candidates.filter((item) => isPrivate(item.path)).length
  const wanted = candidates.filter((item) => !isPrivate(item.path))
  if (wanted.length === 0 && input.previous.entries.length > 0) {
    return {
      ...input.previous,
      builtAt: input.now,
      coverage: [...input.previous.coverage, ...coverageNotes],
      stats: coverageStats(input.previous.entries, [...input.previous.coverage, ...coverageNotes], input.previous.pending.length),
    }
  }
  const known = new Map(input.previous.entries.map((entry) => [entry.sourcePath, entry]))
  const decided = new Set(
    input.previous.coverage
      .filter((row) => row.kind === "mailer" || row.kind === "catalog" || row.kind === "other")
      .map((row) => row.path.split("#")[0] ?? row.path)
  )
  const pending = wanted.filter((item) => {
    const existing = known.get(item.path)
    if (item.sha && existing?.sha && item.sha !== existing.sha) return true
    if (existing) return false
    if (decided.has(item.path)) return false
    return true
  })
  const slice = pending.slice(0, input.batchSize)
  const files: SourceFile[] = []
  await mapPool(slice, 8, async (item) => {
    const branch = item.ref === "mando" ? input.mandoRef : input.c3poRef
    try {
      if (item.path.endsWith(".json")) {
        const json = await input.reader.getJson(item.path, branch)
        files.push({ path: item.path, ref: item.ref, sha: item.sha, json: json ?? undefined, error: json === null ? "GitHub 404" : undefined })
      } else if (item.path.endsWith("/")) {
        files.push({ path: item.path, ref: item.ref, sha: item.sha, json: item.json })
      } else {
        const text = await input.reader.getText!(item.path, branch)
        files.push({ path: item.path, ref: item.ref, sha: item.sha, text: text ?? undefined, error: text === null ? "GitHub 404" : undefined })
      }
    } catch (error) {
      files.push({
        path: item.path,
        ref: item.ref,
        sha: item.sha,
        error: error instanceof Error ? error.message : "Unreadable",
      })
    }
  })
  const parsed = indexSourceFiles(files)
  const parsedPaths = new Set(files.map((file) => file.path))
  const kept = input.previous.entries.filter((entry) => !parsedPaths.has(entry.sourcePath) && wanted.some((item) => item.path === entry.sourcePath))
  const entries = [...kept, ...parsed.entries].sort((a, b) => a.id.localeCompare(b.id))
  const previousRows = input.previous.coverage.filter((row) => row.kind !== "private" && row.kind !== "library" && !parsedPaths.has(row.path) && wanted.some((item) => item.path === row.path))
  const coverage = [...previousRows, ...parsed.coverage, ...coverageNotes]
  if (privateCount > 0) {
    coverage.push({
      path: "private/",
      status: "skipped",
      kind: "private",
      reason: `${privateCount} path(s) under a private folder were not read.`,
    })
  }
  const stillPending = pending.slice(input.batchSize)
  const index: ResearchIndex = {
    version: VERSION,
    builtAt: input.now,
    entries: dedupe(entries),
    coverage,
    pending: stillPending.map(({ ref, path, sha }) => ({ ref, path, sha })),
    stats: coverageStats(dedupe(entries), coverage, stillPending.length),
  }
  return index
}

interface Candidate extends PendingFile {
  json?: unknown
}

function candidatesFromTree(entries: { path: string; type: "blob" | "tree"; sha?: string }[], ref: "mando" | "c3po"): Candidate[] {
  const found: Candidate[] = []
  const pieces = new Map<string, string[]>()
  for (const entry of entries) {
    if (entry.type !== "blob") continue
    if (isPrivate(entry.path)) {
      found.push({ ref, path: entry.path, sha: entry.sha })
      continue
    }
    if (isRecordPath(entry.path, ref)) found.push({ ref, path: entry.path, sha: entry.sha })
    const piece = entry.path.match(/^assets\/physical\/(PM-\d+)\/.+\.(jpe?g|png|webp)$/i)
    if (piece && ref === "c3po") {
      const id = piece[1]!.toUpperCase()
      const images = pieces.get(id) ?? []
      images.push(entry.path)
      pieces.set(id, images)
    }
  }
  for (const [id, images] of pieces) {
    const path = `assets/physical/${id}/`
    if (found.some((item) => item.path.startsWith(`assets/physical/${id}/`) && item.path.endsWith(".md"))) continue
    found.push({
      ref,
      path,
      json: { id, images, industry: "unknown" },
    })
  }
  return found
}

function isRecordPath(filePath: string, ref: "mando" | "c3po"): boolean {
  if (isPrivate(filePath)) return false
  if (/(^|\/)images\/index\.json$/i.test(filePath)) return true
  if (/(^|\/)gold\/.+\.json$/i.test(filePath)) return true
  if (/(^|\/)indexes\/gold\/.+\.json$/i.test(filePath)) return true
  if (filePath.endsWith(".md")) return true
  if (ref === "c3po" && /physical-intake-manifest\.json$/i.test(filePath)) return true
  return false
}

function isPrivate(filePath: string): boolean {
  return isForbiddenResearchPath(filePath)
}

function dedupe(entries: ResearchIndex["entries"]): ResearchIndex["entries"] {
  const byId = new Map<string, ResearchIndex["entries"][number]>()
  for (const entry of entries) {
    const current = byId.get(entry.id)
    if (!current || (entry.gold && !current.gold) || (entry.evidence === "visual" && current.evidence !== "visual")) byId.set(entry.id, entry)
  }
  return [...byId.values()]
}

function parseStoredIndex(raw: unknown): ResearchIndex | null {
  if (!raw || typeof raw !== "object") return null
  const record = raw as Partial<ResearchIndex>
  if (record.version !== 1 || !Array.isArray(record.entries) || !Array.isArray(record.coverage)) return null
  const entries = record.entries
  const coverage = record.coverage
  const pending = Array.isArray(record.pending) ? record.pending : []
  return {
    version: 1,
    builtAt: typeof record.builtAt === "string" ? record.builtAt : new Date(0).toISOString(),
    entries,
    coverage,
    pending,
    stats: record.stats ?? coverageStats(entries, coverage, pending.length),
  }
}

function batchFromEnv(env: NodeJS.ProcessEnv): number {
  const parsed = Number(env.RESEARCH_INDEX_BATCH ?? 80)
  if (!Number.isFinite(parsed)) return 80
  return Math.max(1, Math.min(400, Math.round(parsed)))
}

async function mapPool<T>(items: readonly T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      await work(items[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()))
}

export async function researchHitsForBrief(
  brief: CampaignBrief,
  direction?: { name?: string; headline?: string; offer?: string; emotion?: string }
): Promise<RetrievalHit[]> {
  try {
    const index = await loadResearchIndex()
    if (index.entries.length === 0) return []
    return retrieveResearch(index.entries, queryFromBrief(brief, direction)).hits
  } catch {
    return []
  }
}

export const RESEARCH_REPO = DEFAULT_RESEARCH_REPO
