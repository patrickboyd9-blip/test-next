import { createHash } from "node:crypto"

import { decodeRaster, sniffDesignMedia } from "@/lib/bring-your-own-design/decode-raster"
import type { JobKeepBox, JobPhotoRecord } from "@/lib/campaign-creator/types"
import { encodePng } from "@/lib/design-intelligence/cutout"

import { detailFor, FRONT_PHOTO_SLOT, windowForKeep } from "./crop"

const MAX_BYTES = 8 * 1024 * 1024

export type PreparedJobPhoto =
  | { ok: true; png: Buffer; record: Omit<JobPhotoRecord, "createdAt"> & { createdAt?: string } }
  | { ok: false; error: string }

export function prepareJobPhoto(bytes: Uint8Array, declaredType: string): PreparedJobPhoto {
  if (bytes.byteLength === 0) return { ok: false, error: "That file is empty." }
  if (bytes.byteLength > MAX_BYTES) return { ok: false, error: "Use a photo under 8 MB." }
  const head = Buffer.from(bytes.subarray(0, 80)).toString("utf8").trimStart().toLowerCase()
  if (head.startsWith("<svg") || declaredType.includes("svg")) {
    return { ok: false, error: "An SVG is a logo file. Add the logo on its own upload." }
  }
  const media = sniffDesignMedia(bytes, declaredType)
  if (media === "application/pdf") {
    return { ok: false, error: "That file is a finished design. Use the design upload, not a job photo." }
  }
  if (media !== "image/png" && media !== "image/jpeg") {
    return { ok: false, error: "Use a PNG or JPEG from the job. Logos and finished postcards stay on their own uploads." }
  }
  const decoded = decodeRaster(bytes, media === "image/png" ? "png" : "jpeg")
  if (!decoded) return { ok: false, error: "That photo could not be read." }
  const keep: JobKeepBox = { x: 0.2, y: 0.12, w: 0.6, h: 0.62 }
  const fit = windowForKeep(decoded, keep, FRONT_PHOTO_SLOT)
  const detail = fit.fits ? detailFor(decoded, fit.window, FRONT_PHOTO_SLOT) : "low"
  const id = createHash("sha256").update(bytes).digest("hex").slice(0, 8)
  return {
    ok: true,
    png: encodePng(decoded.width, decoded.height, Buffer.from(decoded.rgba)),
    record: {
      id,
      role: "job-photo",
      fileName: `job-${id}.png`,
      width: decoded.width,
      height: decoded.height,
      keep,
      protect: "unspecified",
      detail,
    },
  }
}
