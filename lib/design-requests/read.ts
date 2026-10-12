import { getDesignRequestStore } from "./store"
import type { DesignRequestStore } from "./store"
import { openDesignRequestUpload } from "./uploads"
import type { DesignRequestUploadStore } from "./uploads"

/**
 * Bytes for one upload on a saved request.
 * A key that is not on the record is refused, even if a file exists.
 */
export async function readDesignRequestImage(
  requestId: string,
  key: string,
  options?: { requests?: DesignRequestStore; uploads?: DesignRequestUploadStore }
): Promise<{ bytes: Buffer; mediaType: string } | null> {
  const requests = options?.requests ?? getDesignRequestStore()
  const request = await requests.get(requestId)
  const upload = request?.uploads.find((item) => item.key === key)
  if (!upload) return null

  if (options?.uploads) {
    const opened = await options.uploads.get(requestId, key)
    if (!opened) return null
    return { bytes: opened.bytes, mediaType: upload.mediaType }
  }

  const opened = await openDesignRequestUpload(requestId, key)
  if (!opened) return null
  return { bytes: opened.bytes, mediaType: upload.mediaType }
}
