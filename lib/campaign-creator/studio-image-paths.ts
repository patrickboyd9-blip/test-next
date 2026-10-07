import path from "path"

const SAFE_ID = /^[a-zA-Z0-9_-]{1,80}$/
const SAFE_FILE = /^[a-zA-Z0-9_-]{1,160}\.png$/

export function defaultStudioImageCacheRoot(): string {
  return path.join(process.cwd(), ".data", "studio-images")
}

export function isSafeStudioId(value: string): boolean {
  return SAFE_ID.test(value)
}

/**
 * Absolute PNG path inside the cache root, or null when the request escapes it.
 */
export function resolveStudioImageFile(
  campaignId: string,
  fileName: string,
  cacheRoot: string = defaultStudioImageCacheRoot()
): string | null {
  if (!SAFE_ID.test(campaignId) || !SAFE_FILE.test(fileName)) return null
  const root = path.resolve(cacheRoot)
  const filePath = path.resolve(root, campaignId, fileName)
  if (filePath !== path.join(root, campaignId, fileName)) return null
  return filePath
}

export function studioImagePublicPath(campaignId: string, fileName: string): string {
  return `/api/studio-image/${campaignId}/${fileName}`
}
