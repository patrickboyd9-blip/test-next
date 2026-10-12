import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import type { DesignRequestUploadStore } from "./uploads"

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/
const SAFE_KEY = /^(logo|image-\d{1,2})\.(png|jpe?g|webp)$/

/** Test and local override. The directory is chosen by the caller, not the app route. */
export function createFileDesignRequestUploadStore(directory: string): DesignRequestUploadStore {
  return {
    async put(requestId, key, bytes) {
      const filePath = fileIn(directory, requestId, key)
      if (!filePath) throw new Error("Invalid design request image path")
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, bytes)
    },
    async get(requestId, key) {
      const filePath = fileIn(directory, requestId, key)
      if (!filePath) return null
      try {
        return { bytes: await readFile(filePath) }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
        throw error
      }
    },
  }
}

function fileIn(directory: string, requestId: string, key: string): string | null {
  if (!SAFE_ID.test(requestId) || !SAFE_KEY.test(key)) return null
  return path.join(/*turbopackIgnore: true*/ directory, requestId, key)
}
