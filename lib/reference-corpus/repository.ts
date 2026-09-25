import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import {
  REFERENCE_SOURCE_CLASSES,
  hasEvidenceLocator,
  type ReferenceCorpusItem,
  type ReferenceSourceClass,
} from "./types"

/**
 * File-backed store for raw reference evidence.
 * Lives at .data/reference-corpus, not .data/campaigns.
 * Swap later for a real database; callers depend on this interface only.
 */
export interface ReferenceCorpusRepository {
  save(item: ReferenceCorpusItem): Promise<ReferenceCorpusItem>
  get(id: string): Promise<ReferenceCorpusItem | null>
}

const DEFAULT_DATA_DIR = path.join(process.cwd(), ".data", "reference-corpus")

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

class FileReferenceCorpusRepository implements ReferenceCorpusRepository {
  constructor(private readonly dataDir: string) {}

  private filePath(id: string) {
    return path.join(this.dataDir, `${id}.json`)
  }

  async save(item: ReferenceCorpusItem): Promise<ReferenceCorpusItem> {
    assertItem(item)
    await mkdir(this.dataDir, { recursive: true })
    await writeFile(this.filePath(item.id), JSON.stringify(item, null, 2), "utf-8")
    return item
  }

  async get(id: string): Promise<ReferenceCorpusItem | null> {
    try {
      const raw = await readFile(this.filePath(id), "utf-8")
      const item = JSON.parse(raw) as ReferenceCorpusItem
      assertItem(item)
      return item
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
      throw error
    }
  }
}

export function createReferenceCorpusRepository(options?: {
  dataDir?: string
}): ReferenceCorpusRepository {
  return new FileReferenceCorpusRepository(options?.dataDir ?? DEFAULT_DATA_DIR)
}

export function defaultReferenceCorpusDataDir(): string {
  return DEFAULT_DATA_DIR
}
