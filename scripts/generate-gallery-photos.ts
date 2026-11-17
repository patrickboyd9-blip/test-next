import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { POSTCARD_SLOT_ASPECT } from "@/lib/campaign-creator/image-generation"
import { createImagenImageGenerationAdapter } from "@/lib/campaign-creator/replicate-image-generation"
import {
  centsFromUsd,
  emptyGallerySpendLog,
  gallerySpendAfter,
  gallerySpendDecision,
  GALLERY_PHOTO_ESTIMATE_CENTS,
  planGalleryPhotos,
  usdFromCents,
  type GallerySpendLog,
} from "@/lib/mail-templates/gallery-photos"

/**
 * One google/nano-banana-pro photo per gallery template. About $0.15 each.
 * Reads REPLICATE_API_TOKEN from the environment. Does not read or print the value.
 *
 *   npx tsx scripts/generate-gallery-photos.ts --dry-run
 *   npx tsx scripts/generate-gallery-photos.ts
 *
 * Photos land in public/gallery so the template list can serve them.
 * The spend log stays in .data and is not committed.
 * The run stops at $6.50 and will not start a photo that would pass $7.
 */

const PHOTO_DIR = path.join(process.cwd(), "public", "gallery")
const SPEND_PATH = path.join(process.cwd(), ".data", "gallery-photo-spend.json")
const MANIFEST_PATH = path.join(process.cwd(), "lib", "mail-templates", "gallery-photo-manifest.json")

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run")
  const unknown = process.argv.slice(2).filter((arg) => arg !== "--dry-run")
  if (unknown.length > 0) {
    console.error(`Unknown argument: ${unknown.join(" ")}. Use --dry-run, or no arguments.`)
    process.exitCode = 1
    return
  }

  const jobs = planGalleryPhotos()
  const spend = await readSpend()
  let spent = spend.entries.reduce((sum, entry) => sum + centsFromUsd(entry.usd), 0)
  const tokenSet = Boolean(process.env.REPLICATE_API_TOKEN?.trim())

  console.log(`Gallery photos: ${jobs.length}`)
  console.log(`Spent so far: ${usdFromCents(spent)}`)
  console.log(`Each new photo is counted at ${usdFromCents(GALLERY_PHOTO_ESTIMATE_CENTS)} before the request.`)
  console.log(`Stop at ${spend.stopAtUsd}. Hard ceiling ${spend.hardCapUsd}.`)
  console.log(tokenSet ? "REPLICATE_API_TOKEN is set." : "REPLICATE_API_TOKEN is not set.")

  if (dryRun) {
    for (const job of jobs) console.log(`${job.templateId}  ${job.publicPath}`)
    console.log("Dry run. No request was sent and no file was written.")
    return
  }

  if (!tokenSet) {
    console.error("Set REPLICATE_API_TOKEN. No photo was requested.")
    process.exitCode = 1
    return
  }

  const adapter = createImagenImageGenerationAdapter()
  await mkdir(PHOTO_DIR, { recursive: true })

  for (const job of jobs) {
    const existing = await readFile(path.join(PHOTO_DIR, job.fileName)).then(() => true).catch(() => false)
    const saved = spend.entries.some((entry) => entry.templateId === job.templateId && entry.status === "saved")
    if (existing && saved) {
      console.log(`${job.templateId} already saved.`)
      continue
    }
    const decision = gallerySpendDecision(spent, GALLERY_PHOTO_ESTIMATE_CENTS)
    if (decision !== "ok") {
      console.log(`Stopped (${decision}) at ${usdFromCents(spent)}. ${job.templateId} was not requested.`)
      break
    }
    const counted = gallerySpendAfter(spent, GALLERY_PHOTO_ESTIMATE_CENTS)
    spent = counted.spentCents
    spend.totalUsd = usdFromCents(spent)
    spend.entries.push({
      templateId: job.templateId,
      usd: usdFromCents(GALLERY_PHOTO_ESTIMATE_CENTS),
      at: new Date().toISOString(),
      status: "failed",
    })
    await writeSpend(spend)
    try {
      const asset = await adapter.generate(job.brief, { slotAspect: POSTCARD_SLOT_ASPECT })
      const png = pngFromDataUrl(asset.src)
      await writeFile(path.join(PHOTO_DIR, job.fileName), png)
      const entry = spend.entries.at(-1)
      if (entry) entry.status = "saved"
      await writeSpend(spend)
      await upsertManifest(job.templateId, job.publicPath)
      console.log(`${job.templateId} saved. Total ${spend.totalUsd}.`)
    } catch (error) {
      await writeSpend(spend)
      console.error(`${job.templateId} failed after it was counted. Total ${spend.totalUsd}.`)
      console.error(error instanceof Error ? error.message : "The photo request failed.")
      process.exitCode = 1
      return
    }
    if (counted.decision !== "ok") {
      console.log(`Stopped (${counted.decision}) at ${usdFromCents(spent)}.`)
      break
    }
  }
}

function pngFromDataUrl(src: string): Buffer {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(src)
  if (!match?.[1]) throw new Error("The photo was not a PNG.")
  return Buffer.from(match[1], "base64")
}

async function readSpend(): Promise<GallerySpendLog> {
  try {
    const parsed = JSON.parse(await readFile(SPEND_PATH, "utf8")) as GallerySpendLog
    if (!Array.isArray(parsed.entries)) return emptyGallerySpendLog()
    return { ...emptyGallerySpendLog(), ...parsed, entries: parsed.entries }
  } catch {
    return emptyGallerySpendLog()
  }
}

async function writeSpend(spend: GallerySpendLog): Promise<void> {
  await mkdir(path.dirname(SPEND_PATH), { recursive: true })
  await writeFile(SPEND_PATH, `${JSON.stringify(spend, null, 2)}\n`)
}

async function upsertManifest(id: string, src: string): Promise<void> {
  const current = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as { photos: { id: string; src: string }[] }
  const photos = (current.photos ?? []).filter((photo) => photo.id !== id)
  photos.push({ id, src })
  photos.sort((a, b) => a.id.localeCompare(b.id))
  await writeFile(MANIFEST_PATH, `${JSON.stringify({ photos }, null, 2)}\n`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The gallery photo run failed.")
  process.exitCode = 1
})
