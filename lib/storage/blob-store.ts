import { BlobNotFoundError, del, get, head, put } from "@vercel/blob"

/**
 * Object storage for generated Studio files.
 * Vercel Blob when BLOB_READ_WRITE_TOKEN is set. Callers keep the local
 * directory when it is not.
 *
 * The connected store is private (Vercel's default, and it cannot be switched
 * later). A private store rejects access: "public", and the URL it returns
 * is not something a browser can open. Every write and read here uses
 * access: "private". The app route streams the bytes to the card.
 */
export const STUDIO_BLOB_ACCESS = "private" as const

export type VercelBlobSdk = {
  put: typeof put
  get: typeof get
  head: typeof head
  del: typeof del
}
export interface BlobObjectStore {
  put(
    pathname: string,
    body: Buffer | string,
    contentType: string
  ): Promise<{ url: string }>
  /** Metadata only. Null when the object is absent. */
  stat(pathname: string): Promise<{ url: string } | null>
  /** Bytes plus the stored URL. Null when the object is absent. The URL is not public. */
  get(pathname: string): Promise<{ url: string; body: Buffer } | null>
  /** Creates the object only when it is absent. Null when it already exists. */
  putNew(
    pathname: string,
    body: Buffer | string,
    contentType: string
  ): Promise<{ url: string } | null>
  remove(pathname: string): Promise<void>
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

export function createVercelBlobObjectStore(
  token: string,
  sdk: VercelBlobSdk = { put, get, head, del }
): BlobObjectStore {
  return {
    async put(pathname, body, contentType) {
      const blob = await sdk.put(pathname, body, {
        access: STUDIO_BLOB_ACCESS,
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
        const meta = await sdk.head(pathname, { token })
        return { url: meta.url }
      } catch (error) {
        if (error instanceof BlobNotFoundError) return null
        const name = error instanceof Error ? error.name : ""
        if (name === "BlobNotFoundError") return null
        throw error
      }
    },

    async get(pathname) {
      const result = await sdk.get(pathname, { access: STUDIO_BLOB_ACCESS, token })
      if (!result || result.statusCode !== 200 || !result.stream) return null
      return {
        url: result.blob.url,
        body: await readBlobStream(result.stream),
      }
    },

    async putNew(pathname, body, contentType) {
      try {
        const blob = await sdk.put(pathname, body, {
          access: STUDIO_BLOB_ACCESS,
          token,
          contentType,
          addRandomSuffix: false,
          allowOverwrite: false,
        })
        return { url: blob.url }
      } catch (error) {
        if (blobAlreadyExists(error)) return null
        throw error
      }
    },

    async remove(pathname) {
      try {
        await sdk.del(pathname, { token })
      } catch (error) {
        if (error instanceof BlobNotFoundError) return
        const name = error instanceof Error ? error.name : ""
        if (name === "BlobNotFoundError") return
        throw error
      }
    },
  }
}

function blobAlreadyExists(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ""
  if (/already exists|conflict/i.test(message)) return true
  const status = (error as { status?: number }).status
  return status === 409 || status === 412
}
