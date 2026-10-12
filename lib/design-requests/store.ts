import { mkdir, readdir, readFile, writeFile } from "fs/promises"
import path from "path"

import {
  createNeonExecutor,
  postgresUrl,
  type SqlExecutor,
} from "@/lib/storage/document-store"

import type { DesignRequest } from "./types"

export interface DesignRequestStore {
  get(id: string): Promise<DesignRequest | null>
  put(request: DesignRequest): Promise<void>
  list(): Promise<DesignRequest[]>
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/

const DDL = `CREATE TABLE IF NOT EXISTS design_requests (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)`

export function defaultDesignRequestDirectory(): string {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "design-requests")
}

export function createFileDesignRequestStore(directory: string): DesignRequestStore {
  return {
    async get(id) {
      if (!SAFE_ID.test(id)) return null
      try {
        const raw = await readFile(requestFile(directory, id), "utf-8")
        return parseRequest(JSON.parse(raw) as unknown)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
        throw error
      }
    },

    async put(request) {
      if (!SAFE_ID.test(request.id)) {
        throw new Error("Design request id cannot be stored as a file name.")
      }
      await mkdir(directory, { recursive: true })
      await writeFile(requestFile(directory, request.id), JSON.stringify(request, null, 2), "utf-8")
    },

    async list() {
      let names: string[] = []
      try {
        names = await readdir(directory)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
        throw error
      }
      const requests: DesignRequest[] = []
      for (const name of names) {
        if (!name.endsWith(".json")) continue
        const id = name.slice(0, -".json".length)
        const request = await this.get(id)
        if (request) requests.push(request)
      }
      return sortNewest(requests)
    },
  }
}

export function createPostgresDesignRequestStore(executor: SqlExecutor): DesignRequestStore {
  let ensuring: Promise<void> | null = null

  const ensure = (): Promise<void> => {
    if (!ensuring) {
      ensuring = executor
        .query(DDL)
        .then(() => undefined)
        .catch((error: unknown) => {
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
        `SELECT data FROM design_requests WHERE id = $1`,
        [id]
      )
      const row = rows[0]
      if (!row) return null
      return parseRequest(parseDocument(row.data))
    },

    async put(request) {
      await ensure()
      await executor.query(
        `INSERT INTO design_requests (id, data, created_at)
         VALUES ($1, $2::jsonb, $3::timestamptz)
         ON CONFLICT (id) DO UPDATE SET
           data = EXCLUDED.data,
           updated_at = now()`,
        [request.id, JSON.stringify(request), request.createdAt]
      )
    },

    async list() {
      await ensure()
      const rows = await executor.query<{ data: unknown }>(
        `SELECT data FROM design_requests ORDER BY created_at DESC`
      )
      const requests = rows
        .map((row) => parseRequest(parseDocument(row.data)))
        .filter((request): request is DesignRequest => request !== null)
      return sortNewest(requests)
    },
  }
}

const neonExecutors = new Map<string, SqlExecutor>()

/**
 * Postgres when DATABASE_URL or POSTGRES_URL is set. Otherwise JSON files
 * under .data/design-requests. Pass directory or executor to pin a mode.
 */
export function createDesignRequestStore(options?: {
  directory?: string
  executor?: SqlExecutor
}): DesignRequestStore {
  if (options?.executor) return createPostgresDesignRequestStore(options.executor)
  if (options?.directory) return createFileDesignRequestStore(options.directory)
  const url = postgresUrl()
  if (url) {
    let executor = neonExecutors.get(url)
    if (!executor) {
      executor = createNeonExecutor(url)
      neonExecutors.set(url, executor)
    }
    return createPostgresDesignRequestStore(executor)
  }
  return createFileDesignRequestStore(defaultDesignRequestDirectory())
}

let store: DesignRequestStore | null = null

export function getDesignRequestStore(): DesignRequestStore {
  if (!store) store = createDesignRequestStore()
  return store
}

function requestFile(directory: string, id: string): string {
  if (directory === defaultDesignRequestDirectory()) {
    return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "design-requests", `${id}.json`)
  }
  return path.join(/*turbopackIgnore: true*/ directory, `${id}.json`)
}

function sortNewest(requests: DesignRequest[]): DesignRequest[] {
  return [...requests].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

function parseDocument(value: unknown): unknown {
  if (typeof value === "string") return JSON.parse(value) as unknown
  return value
}

function parseRequest(value: unknown): DesignRequest | null {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<DesignRequest>
  if (typeof record.id !== "string" || typeof record.companyName !== "string") return null
  return {
    id: record.id,
    companyName: record.companyName,
    address: record.address ?? "",
    vibe: record.vibe ?? "",
    offer: record.offer ?? "",
    responseMethods: record.responseMethods ?? [],
    qrUrl: record.qrUrl,
    phone: record.phone,
    websiteUrl: record.websiteUrl,
    otherResponse: record.otherResponse,
    notes: record.notes,
    size: record.size,
    uploads: record.uploads ?? [],
    createdAt: record.createdAt ?? new Date(0).toISOString(),
  }
}
