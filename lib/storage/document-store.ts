import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import { neon } from "@neondatabase/serverless"

/**
 * JSON documents keyed by id.
 * File mode is the local default. Postgres mode is selected when a database
 * URL is present. Callers do not choose; see createAppDocumentStore.
 */
export interface DocumentStore {
  get(id: string): Promise<unknown | null>
  put(id: string, document: unknown): Promise<void>
}

export interface SqlExecutor {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[]
  ): Promise<T[]>
}

export type DocumentCollection = "campaigns" | "reference_corpus"

const SAFE_FILE_ID = /^[A-Za-z0-9_-]{1,200}$/

interface CollectionSql {
  table: "campaigns" | "reference_corpus"
  ddl: string
}

const COLLECTIONS: Record<DocumentCollection, CollectionSql> = {
  campaigns: {
    table: "campaigns",
    ddl: `CREATE TABLE IF NOT EXISTS campaigns (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
  },
  reference_corpus: {
    table: "reference_corpus",
    ddl: `CREATE TABLE IF NOT EXISTS reference_corpus (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
  },
}

export function postgresUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const databaseUrl = env.DATABASE_URL?.trim()
  if (databaseUrl) return databaseUrl
  const postgres = env.POSTGRES_URL?.trim()
  if (postgres) return postgres
  return null
}

export function storageMode(env: NodeJS.ProcessEnv = process.env): "postgres" | "file" {
  return postgresUrl(env) ? "postgres" : "file"
}

export function defaultDocumentDirectory(collection: DocumentCollection): string {
  if (collection === "campaigns") {
    return path.join(process.cwd(), ".data", "campaigns")
  }
  return path.join(process.cwd(), ".data", "reference-corpus")
}

export function createFileDocumentStore(directory: string): DocumentStore {
  return {
    async get(id) {
      if (!SAFE_FILE_ID.test(id)) return null
      try {
        const raw = await readFile(path.join(directory, `${id}.json`), "utf-8")
        return JSON.parse(raw) as unknown
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
        throw error
      }
    },

    async put(id, document) {
      if (!SAFE_FILE_ID.test(id)) {
        throw new Error("Document id cannot be stored as a file name.")
      }
      await mkdir(directory, { recursive: true })
      await writeFile(
        path.join(directory, `${id}.json`),
        JSON.stringify(document, null, 2),
        "utf-8"
      )
    },
  }
}

export function createNeonExecutor(connectionString: string): SqlExecutor {
  const sql = neon(connectionString)
  return {
    async query<T extends Record<string, unknown>>(
      text: string,
      params: readonly unknown[] = []
    ) {
      const rows = await sql.query(text, [...params])
      return rows as T[]
    },
  }
}

function parseDocument(value: unknown): unknown {
  if (typeof value === "string") return JSON.parse(value) as unknown
  return value
}

function isBenignCreateRace(error: unknown): boolean {
  const code = (error as { code?: string }).code
  const message = error instanceof Error ? error.message : String(error)
  return (
    code === "42P07" ||
    code === "23505" ||
    /already exists/i.test(message) ||
    /pg_type_typname_nsp_index/i.test(message)
  )
}

export function createPostgresDocumentStore(
  collection: DocumentCollection,
  executor: SqlExecutor
): DocumentStore {
  const spec = COLLECTIONS[collection]
  let ensuring: Promise<void> | null = null

  const ensure = (): Promise<void> => {
    if (!ensuring) {
      ensuring = executor
        .query(spec.ddl)
        .then(() => undefined)
        .catch((error: unknown) => {
          if (isBenignCreateRace(error)) return
          ensuring = null
          throw error
        })
    }
    return ensuring
  }

  return {
    async get(id) {
      await ensure()
      const rows = await executor.query<{ data: unknown }>(
        `SELECT data FROM ${spec.table} WHERE id = $1`,
        [id]
      )
      const row = rows[0]
      if (!row) return null
      return parseDocument(row.data)
    },

    async put(id, document) {
      await ensure()
      await executor.query(
        `INSERT INTO ${spec.table} (id, data)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           data = EXCLUDED.data,
           updated_at = now()`,
        [id, JSON.stringify(document)]
      )
    },
  }
}

const neonExecutors = new Map<string, SqlExecutor>()

function sharedNeonExecutor(connectionString: string): SqlExecutor {
  let executor = neonExecutors.get(connectionString)
  if (!executor) {
    executor = createNeonExecutor(connectionString)
    neonExecutors.set(connectionString, executor)
  }
  return executor
}

/**
 * Postgres when DATABASE_URL or POSTGRES_URL is set. Otherwise JSON files
 * under .data/, which is the zero-setup local default.
 * Pass dataDir or executor to pin a mode (tests). An explicit executor wins.
 */
export function createAppDocumentStore(
  collection: DocumentCollection,
  options?: { dataDir?: string; executor?: SqlExecutor }
): DocumentStore {
  if (options?.executor) {
    return createPostgresDocumentStore(collection, options.executor)
  }
  if (options?.dataDir) {
    return createFileDocumentStore(options.dataDir)
  }
  const url = postgresUrl()
  if (url) {
    return createPostgresDocumentStore(collection, sharedNeonExecutor(url))
  }
  return createFileDocumentStore(defaultDocumentDirectory(collection))
}
