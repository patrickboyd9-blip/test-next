import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import { createVercelBlobObjectStore, blobReadWriteToken, type BlobObjectStore } from "@/lib/storage/blob-store"

import { sha256Hex } from "./hash"

export interface StoredProof {
  sha256: string
  location: string
}

/**
 * Keep the approved proof PDF next to the acceptance row.
 * Blob when BLOB_READ_WRITE_TOKEN is set. A private file under
 * .data/compliance-proofs/ otherwise. Writes are exclusive: a second
 * write of the same id does not replace the first file.
 */
export async function storeApprovedProofPdf(input: {
  campaignId: string
  eventId: string
  bytes: Uint8Array<ArrayBufferLike>
  rootDir?: string
  blob?: BlobObjectStore | null
}): Promise<StoredProof> {
  const sha256 = sha256Hex(input.bytes)
  const key = `compliance-proofs/${input.campaignId}/${input.eventId}.pdf`
  const blob = input.blob === undefined ? defaultBlob() : input.blob
  if (blob) {
    const created = await blob.putNew(key, Buffer.from(input.bytes), "application/pdf")
    if (created) return { sha256, location: created.url }
    const existing = await blob.get(key)
    if (!existing) {
      throw new Error("The approved proof could not be stored.")
    }
    return { sha256: sha256Hex(existing.body), location: existing.url }
  }

  const root = input.rootDir ?? path.join(process.cwd(), ".data", "compliance-proofs")
  const filePath = path.join(root, input.campaignId, `${input.eventId}.pdf`)
  await mkdir(path.dirname(filePath), { recursive: true })
  try {
    await writeFile(filePath, input.bytes, { flag: "wx" })
    return { sha256, location: filePath }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
  }
  const existing = await readFile(filePath)
  return { sha256: sha256Hex(existing), location: filePath }
}

function defaultBlob(): BlobObjectStore | null {
  const token = blobReadWriteToken()
  if (!token) return null
  return createVercelBlobObjectStore(token)
}
