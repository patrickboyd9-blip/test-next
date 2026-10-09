import { BlobNotFoundError, get, head, put } from "@vercel/blob"

/**
 * Object storage for generated Studio files.
 * Vercel Blob when BLOB_READ_WRITE_TOKEN is set. Callers keep the local
 * directory when it is not.
 */
export interface BlobObjectStore {
  put(
    pathname: string,
    body: Buffer | string,
    contentType: string
  ): Promise<{ url: string }>
  /** Metadata only. Null when the object is absent. */
  stat(pathname: string): Promise<{ url: string } | null>
  /** Bytes plus the public URL. Null when the object is absent. */
  get(pathname: string): Promise<{ url: string; body: Buffer } | null>
}

export function blobReadWriteToken(env: NodeJS.ProcessEnv = process.env): string | null {
  const token = env.BLOB_READ_WRITE_TOKEN?.trim()
  return token || null
}

export function studioImageBlobPath(campaignId: string, fileName: string): string {
  return `studio-images/${campaignId}/${fileName}`
}

async function readBlobStream(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const next = await reader.read()
    if (next.done) break
    if (next.value) chunks.push(next.value)
  }
  return Buffer.concat(chunks)
}

export function createVercelBlobObjectStore(token: string): BlobObjectStore {
  return {
    async put(pathname, body, contentType) {
      const blob = await put(pathname, body, {
        access: "public",
        token,
        contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      })
      return { url: blob.url }
    },

    async stat(pathname) {
      try {
        const meta = await head(pathname, { token })
        return { url: meta.url }
      } catch (error) {
        if (error instanceof BlobNotFoundError) return null
        const name = error instanceof Error ? error.name : ""
        if (name === "BlobNotFoundError") return null
        throw error
      }
    },

    async get(pathname) {
      const result = await get(pathname, { access: "public", token })
      if (!result || result.statusCode !== 200 || !result.stream) return null
      return {
        url: result.blob.url,
        body: await readBlobStream(result.stream),
      }
    },
  }
}
