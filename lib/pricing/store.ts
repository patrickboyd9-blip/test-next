import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import {
  createNeonExecutor,
  postgresUrl,
  type SqlExecutor,
} from "@/lib/storage/document-store"

import { DEFAULT_PRICING_CONFIG } from "./defaults"
import { normalizePricingConfig } from "./quote"
import type { PricingConfig } from "./types"

const SETTINGS_ID = "settings"

const DDL = `CREATE TABLE IF NOT EXISTS pricing_settings (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)`

export function defaultPricingDirectory(): string {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "pricing")
}

export interface PricingStore {
  get(): Promise<PricingConfig>
  put(config: PricingConfig): Promise<void>
}

export function createFilePricingStore(directory: string): PricingStore {
  const file = path.join(directory, `${SETTINGS_ID}.json`)
  return {
    async get() {
      try {
        const raw = await readFile(file, "utf-8")
        return normalizePricingConfig(JSON.parse(raw) as unknown)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return DEFAULT_PRICING_CONFIG
        throw error
      }
    },
    async put(config) {
      await mkdir(directory, { recursive: true })
      await writeFile(file, JSON.stringify(normalizePricingConfig(config), null, 2), "utf-8")
    },
  }
}

export function createPostgresPricingStore(executor: SqlExecutor): PricingStore {
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
    async get() {
      await ensure()
      const rows = await executor.query<{ data: unknown }>(
        `SELECT data FROM pricing_settings WHERE id = $1`,
        [SETTINGS_ID]
      )
      const row = rows[0]
      if (!row) return DEFAULT_PRICING_CONFIG
      const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data
      return normalizePricingConfig(data)
    },
    async put(config) {
      await ensure()
      const saved = normalizePricingConfig(config)
      await executor.query(
        `INSERT INTO pricing_settings (id, data)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [SETTINGS_ID, JSON.stringify(saved)]
      )
    },
  }
}

export function createPricingStore(options?: {
  directory?: string
  executor?: SqlExecutor
}): PricingStore {
  if (options?.executor) return createPostgresPricingStore(options.executor)
  if (options?.directory) return createFilePricingStore(options.directory)
  const url = postgresUrl()
  if (url) return createPostgresPricingStore(createNeonExecutor(url))
  return createFilePricingStore(defaultPricingDirectory())
}

let store: PricingStore | null = null

export function getPricingStore(): PricingStore {
  if (!store) store = createPricingStore()
  return store
}

export async function getPricingConfig(): Promise<PricingConfig> {
  return getPricingStore().get()
}
