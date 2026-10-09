import {
  createAppDocumentStore,
  createFileDocumentStore,
  defaultDocumentDirectory,
  type DocumentStore,
} from "@/lib/storage/document-store"

import {
  REFERENCE_SOURCE_CLASSES,
  hasEvidenceLocator,
  type ReferenceCorpusItem,
  type ReferenceSourceClass,
} from "./types"

/**
 * Store for raw reference evidence.
 * Separate from campaigns. JSON files under .data/reference-corpus unless
 * DATABASE_URL or POSTGRES_URL selects Postgres.
 */
export interface ReferenceCorpusRepository {
  save(item: ReferenceCorpusItem): Promise<ReferenceCorpusItem>
  get(id: string): Promise<ReferenceCorpusItem | null>
}

function isSourceClass(value: string): value is ReferenceSourceClass {
  return (REFERENCE_SOURCE_CLASSES as readonly string[]).includes(value)
}

function assertItem(item: ReferenceCorpusItem): void {
  if (!item.id?.trim()) throw new Error("Reference Corpus item requires an id.")
  if (!isSourceClass(item.sourceClass)) {
    throw new Error(
      `Reference Corpus item ${item.id} has an invalid sourceClass.`
    )
  }
  if (!item.label?.trim()) {
    throw new Error(`Reference Corpus item ${item.id} requires a label.`)
  }
  if (!item.addedAt?.trim()) {
    throw new Error(`Reference Corpus item ${item.id} requires addedAt.`)
  }
  if (!item.media) {
    throw new Error(`Reference Corpus item ${item.id} requires a media object.`)
  }
  if (!hasEvidenceLocator(item)) {
    throw new Error(
      `Reference Corpus item ${item.id} requires evidence: media or a research pointer.`
    )
  }
}

class DocumentReferenceCorpusRepository implements ReferenceCorpusRepository {
  constructor(private readonly store: DocumentStore) {}

  async save(item: ReferenceCorpusItem): Promise<ReferenceCorpusItem> {
    assertItem(item)
    await this.store.put(item.id, item)
    return item
  }

  async get(id: string): Promise<ReferenceCorpusItem | null> {
    const raw = await this.store.get(id)
    if (!raw || typeof raw !== "object") return null
    const item = raw as ReferenceCorpusItem
    assertItem(item)
    return item
  }
}

export function createReferenceCorpusRepository(options?: {
  dataDir?: string
  store?: DocumentStore
}): ReferenceCorpusRepository {
  if (options?.store) {
    return new DocumentReferenceCorpusRepository(options.store)
  }
  if (options?.dataDir) {
    return new DocumentReferenceCorpusRepository(
      createFileDocumentStore(options.dataDir)
    )
  }
  return new DocumentReferenceCorpusRepository(
    createAppDocumentStore("reference_corpus")
  )
}

export function defaultReferenceCorpusDataDir(): string {
  return defaultDocumentDirectory("reference_corpus")
}
