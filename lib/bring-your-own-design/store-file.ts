import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import type { UploadedDesignStore } from "./store"

const SAFE_CAMPAIGN_ID = /^[A-Za-z0-9_-]{1,80}$/
const SAFE_KEY = /^(front|back|print)\.(pdf|png|jpe?g)$/

/** Test helper. Production reads and writes go through store.ts and a fixed directory. */
export function createFileUploadedDesignStore(directory: string): UploadedDesignStore {
  return {
    async put(campaignId, key, bytes) {
      if (!SAFE_CAMPAIGN_ID.test(campaignId) || !SAFE_KEY.test(key)) {
        throw new Error("Invalid uploaded design path")
      }
      const filePath = path.join(directory, campaignId, key)
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, bytes)
    },
    async get(campaignId, key) {
      if (!SAFE_CAMPAIGN_ID.test(campaignId) || !SAFE_KEY.test(key)) return null
      try {
        return { bytes: await readFile(path.join(directory, campaignId, key)) }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
        throw error
      }
    },
  }
}
