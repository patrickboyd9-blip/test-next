import {
  createAppDocumentStore,
  createFileDocumentStore,
  type DocumentStore,
} from "@/lib/storage/document-store"

import { gradeRank } from "./library"
import type { TasteAnalysis } from "./taste"

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/

export function tasteStore(options?: { dataDir?: string; store?: DocumentStore }): DocumentStore {
  if (options?.store) return options.store
  if (options?.dataDir) return createFileDocumentStore(options.dataDir)
  return createAppDocumentStore("design_taste")
}

export async function readTaste(store: DocumentStore, id: string): Promise<TasteAnalysis | null> {
  if (!SAFE_ID.test(id)) return null
  const raw = await store.get(id)
  return isTaste(raw) ? raw : null
}

export async function writeTaste(store: DocumentStore, analysis: TasteAnalysis): Promise<void> {
  if (!SAFE_ID.test(analysis.id)) throw new Error("Taste id cannot be stored.")
  await store.put(analysis.id, analysis)
  const index = await store.get("index")
  const ids = indexIds(index)
  if (!ids.includes(analysis.id)) ids.push(analysis.id)
  await store.put("index", { ids })
}

export async function listTaste(store: DocumentStore): Promise<TasteAnalysis[]> {
  const ids = indexIds(await store.get("index"))
  const analyses: TasteAnalysis[] = []
  for (const id of ids) {
    const analysis = await readTaste(store, id)
    if (analysis) analyses.push(analysis)
  }
  return analyses.sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || a.id.localeCompare(b.id))
}

export function isTaste(value: unknown): value is TasteAnalysis {
  if (!value || typeof value !== "object") return false
  const row = value as Partial<TasteAnalysis>
  return row.version === "1" && typeof row.id === "string" && typeof row.grade === "string" && typeof row.whatMakesItWork === "string"
}

function indexIds(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return []
  const ids = (raw as { ids?: unknown }).ids
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string" && SAFE_ID.test(id)) : []
}
