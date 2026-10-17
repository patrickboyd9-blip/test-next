import { readFile } from "node:fs/promises"
import path from "node:path"

import { saveLibraryImage } from "@/lib/design-intelligence/images"
import {
  designLibraryStore,
  discoverLocalImages,
  loadSeedAnalyses,
  localReferenceRoot,
} from "@/lib/design-intelligence/library"
import type { LibraryRecord } from "@/lib/design-intelligence/library"

/**
 * Registers the local reference library.
 *
 * The scans stay out of git. By default they live in .data/reference-library.
 * When BLOB_READ_WRITE_TOKEN is set, each image is also copied into the private
 * Blob store and the database record points at that object.
 *
 * Extract the attached archives first:
 *   .data/reference-library/mando   <- modern-mail-research images/
 *   .data/reference-library/c3po    <- assets/physical and reports/
 */

async function main(): Promise<void> {
  const root = localReferenceRoot()
  const images = discoverLocalImages(root)
  if (images.size === 0) {
    throw new Error(
      `No reference images under ${root}. Extract the libraries there before seeding. Do not commit the images.`
    )
  }
  const analyses = new Map(loadSeedAnalyses().map((analysis) => [analysis.id, analysis]))
  const store = designLibraryStore()
  const ids: string[] = []
  let uploaded = 0
  for (const [id, files] of images) {
    const analysis = analyses.get(id)
    let stored = files
    if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
      stored = []
      for (const file of files) {
        const absolute = path.resolve(root, file.path)
        const bytes = await readFile(absolute)
        const saved = await saveLibraryImage({
          id,
          fileName: path.basename(file.path),
          bytes,
          contentType: file.contentType,
        })
        stored.push({ ...saved, role: file.role })
        uploaded += 1
      }
    }
    const record: LibraryRecord = {
      id,
      source: id.startsWith("PM-") ? "c3po" : "mando",
      analysis,
      images: stored,
      vertical: analysis?.vertical,
      grade: analysis?.grade,
      needsAnalysis: !analysis,
      syncedAt: new Date().toISOString(),
    }
    await store.put(id, record)
    ids.push(id)
  }
  await store.put("index", { ids })
  const missing = ["PM-047", "PM-054", "PM-022", "MMR-513", "MMR-047"].filter((id) => !images.has(id))
  console.log(
    JSON.stringify(
      {
        root,
        records: ids.length,
        blobUploads: uploaded,
        needsAnalysis: ids.filter((id) => !analyses.has(id)),
        missingExpected: missing,
      },
      null,
      2
    )
  )
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
