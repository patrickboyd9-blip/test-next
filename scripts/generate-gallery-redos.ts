import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { generateImagen4Jpeg, IMAGEN4_ESTIMATED_USD, IMAGEN4_IMAGE_MODEL } from "@/lib/campaign-creator/replicate-image-generation"
import { GALLERY_REDOS, galleryRedoPromptFailures, type GalleryRedoCopy } from "@/lib/mail-templates/gallery-curation"
import { composeGalleryRedo } from "@/lib/mail-templates/gallery-redo-compose"

/**
 * Regenerates the nine reviewed gallery mailers with google/nano-banana-2.1 (Imagen 4's live replacement).
 * Reads REPLICATE_API_TOKEN from the environment. Does not print it.
 *
 *   npx tsx scripts/generate-gallery-redos.ts --dry-run
 *   npx tsx scripts/generate-gallery-redos.ts
 *   npx tsx scripts/generate-gallery-redos.ts --only restaurant-grand-opening
 *
 * Hard cap: 27 image requests (3 per mailer). About $0.05 each at 2K.
 */

const MAX_GENERATIONS = 27
const PHOTO_DIR = path.join(process.cwd(), "public", "gallery")
const COUNT_PATH = path.join(process.cwd(), ".data", "gallery-redo-generations.json")

interface CountLog {
  count: number
  ids: string[]
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run")
  const onlyFlag = process.argv.indexOf("--only")
  const only = onlyFlag === -1 ? null : process.argv[onlyFlag + 1]
  const jobs = GALLERY_REDOS.filter((redo) => (only ? redo.id === only : true))
  if (jobs.length === 0) {
    console.error(only ? `Unknown redo ${only}.` : "No redos.")
    process.exitCode = 1
    return
  }
  for (const redo of jobs) {
    const failures = galleryRedoPromptFailures(redo)
    if (failures.length > 0) {
      console.error(`${redo.id} prompt is not ready: ${failures.join(", ")}`)
      process.exitCode = 1
      return
    }
  }
  console.log(`Redos: ${jobs.length}. Model ${IMAGEN4_IMAGE_MODEL}. About $${IMAGEN4_ESTIMATED_USD.toFixed(2)} each.`)
  console.log(process.env.REPLICATE_API_TOKEN?.trim() ? "REPLICATE_API_TOKEN is set." : "REPLICATE_API_TOKEN is not set.")
  if (dryRun) {
    for (const redo of jobs) console.log(`${redo.id}  ${redo.layout}  ${redo.aspectRatio}`)
    console.log("Dry run. No request was sent and no file was written.")
    return
  }
  const token = process.env.REPLICATE_API_TOKEN?.trim()
  if (!token) {
    console.error("Set REPLICATE_API_TOKEN. No photo was requested.")
    process.exitCode = 1
    return
  }
  await mkdir(PHOTO_DIR, { recursive: true })
  const log = await readCount()
  for (const redo of jobs) {
    if (log.count >= MAX_GENERATIONS) {
      console.error(`Stopped at ${log.count} generations. ${redo.id} was not requested.`)
      process.exitCode = 1
      return
    }
    await generateOne(redo, token, log)
  }
  console.log(`Generations used this project: ${log.count} of ${MAX_GENERATIONS}.`)
}

async function generateOne(redo: GalleryRedoCopy, token: string, log: CountLog): Promise<void> {
  log.count += 1
  log.ids.push(redo.id)
  await writeCount(log)
  const photo = await generateImagen4Jpeg(redo.prompt, { token, aspectRatio: redo.aspectRatio })
  const card = await composeGalleryRedo(photo, redo)
  await writeFile(path.join(PHOTO_DIR, `${redo.id}.jpg`), card)
  console.log(`${redo.id} saved. Generations ${log.count}.`)
}

async function readCount(): Promise<CountLog> {
  try {
    const parsed = JSON.parse(await readFile(COUNT_PATH, "utf8")) as CountLog
    if (!Number.isInteger(parsed.count) || !Array.isArray(parsed.ids)) return { count: 0, ids: [] }
    return parsed
  } catch {
    return { count: 0, ids: [] }
  }
}

async function writeCount(log: CountLog): Promise<void> {
  await mkdir(path.dirname(COUNT_PATH), { recursive: true })
  await writeFile(COUNT_PATH, `${JSON.stringify(log, null, 2)}\n`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The gallery redo run failed.")
  process.exitCode = 1
})
