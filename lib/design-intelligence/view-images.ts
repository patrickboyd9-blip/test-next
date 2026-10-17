import { readRecordImage } from "./images"
import type { LibraryRecord } from "./library"
import type { ReferenceSelection } from "./select"

/**
 * Opens the reference images the art director is allowed to study.
 * The bytes are measured here. A vision model receives the same files when
 * ANTHROPIC_API_KEY is set. Nothing in the measurement is copied onto the card.
 */

export interface ImageView {
  id: string
  bytes: number
  width: number
  height: number
  mediaType: string
}

export async function viewSelection(
  records: readonly LibraryRecord[],
  selection: ReferenceSelection,
  env: NodeJS.ProcessEnv = process.env
): Promise<ImageView[]> {
  const byId = new Map(records.map((record) => [record.id, record]))
  const views: ImageView[] = []
  for (const id of selection.imageIds) {
    const record = byId.get(id)
    if (!record) continue
    const image = await readRecordImage(record, env)
    if (!image) continue
    const size = imageSize(image.bytes, image.mediaType)
    views.push({
      id,
      bytes: image.bytes.length,
      width: size.width,
      height: size.height,
      mediaType: image.mediaType,
    })
  }
  return views
}

function imageSize(bytes: Buffer, mediaType: string): { width: number; height: number } {
  if (mediaType === "image/png") return pngSize(bytes)
  if (mediaType === "image/jpeg") return jpegSize(bytes)
  return { width: 0, height: 0 }
}

function pngSize(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 24 || bytes[0] !== 0x89) return { width: 0, height: 0 }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

/** SOF marker. Reads the file. Does not decode the photograph into the layout. */
function jpegSize(bytes: Buffer): { width: number; height: number } {
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) break
    const marker = bytes[offset + 1] ?? 0
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) }
    }
    const length = bytes.readUInt16BE(offset + 2)
    if (length < 2) break
    offset += 2 + length
  }
  return { width: 0, height: 0 }
}
