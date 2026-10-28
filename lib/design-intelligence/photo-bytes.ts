import { decodeImageRaster } from "./cutout"
import { analyzePhotoField, type PhotoReading } from "./photo-field"

export interface PhotoRaster {
  rgba: Buffer
  width: number
  height: number
}

/** A provider data URL, decoded. Null when it is not a photograph. */
export function rasterFromDataUrl(src: string): PhotoRaster | null {
  const comma = src.indexOf(",")
  if (!src.startsWith("data:image/") || comma < 0) return null
  const bytes = Buffer.from(src.slice(comma + 1), "base64")
  const raster = decodeImageRaster(bytes)
  if (!raster) return null
  return raster
}

/** A provider data URL, decoded and read for a calm patch. Null when it is not a photograph. */
export function readingFromDataUrl(src: string): PhotoReading | null {
  const raster = rasterFromDataUrl(src)
  if (!raster) return null
  return analyzePhotoField(raster.rgba, raster.width, raster.height)
}
