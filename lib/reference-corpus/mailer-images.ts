import { readFile, stat } from "fs/promises"
import path from "path"

/**
 * Curated mailer scans, named by MMR id.
 * The research library (patrickboyd9-blip/modern-mail-research) stores
 * observation files and syntheses. Its records say specimen scans are not
 * kept there. This directory stays empty until scans are added, and
 * generation then uses the Reference Cards alone.
 *
 * Name a file MMR-001.jpg, MMR-001.png, or MMR-001.webp.
 */

const MEDIA: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
}

/** Stay under a vision-request budget. Larger scans are skipped, not resized here. */
export const REFERENCE_IMAGE_BYTE_CAP = 1_500_000
export const REFERENCE_IMAGE_LIMIT = 4

export interface ReferenceMailerImage {
  mmrId: string
  mediaType: "image/jpeg" | "image/png" | "image/webp"
  bytes: Buffer
}

export function referenceMailerDirectory(): string {
  return path.join(process.cwd(), "lib", "reference-corpus", "mailers")
}

export async function loadReferenceMailerImages(
  mmrIds: readonly string[],
  directory = referenceMailerDirectory()
): Promise<ReferenceMailerImage[]> {
  const images: ReferenceMailerImage[] = []
  const seen = new Set<string>()
  for (const mmrId of mmrIds) {
    if (images.length >= REFERENCE_IMAGE_LIMIT) break
    if (!/^MMR-\d+$/.test(mmrId) || seen.has(mmrId)) continue
    seen.add(mmrId)
    const image = await readMailerImage(directory, mmrId)
    if (image) images.push(image)
  }
  return images
}

async function readMailerImage(
  directory: string,
  mmrId: string
): Promise<ReferenceMailerImage | null> {
  for (const extension of Object.keys(MEDIA)) {
    const file = path.join(directory, `${mmrId}${extension}`)
    try {
      const info = await stat(file)
      if (!info.isFile() || info.size <= 0 || info.size > REFERENCE_IMAGE_BYTE_CAP) continue
      const bytes = await readFile(file)
      return { mmrId, mediaType: MEDIA[extension], bytes }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue
      return null
    }
  }
  return null
}
