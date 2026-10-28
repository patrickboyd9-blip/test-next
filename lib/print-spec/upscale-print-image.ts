import { decodeRaster } from "@/lib/bring-your-own-design/decode-raster"
import { encodePng } from "@/lib/design-intelligence/cutout"

export interface SizedPrintImage {
  bytes: Uint8Array
  width: number
  height: number
}

/**
 * Preview photographs are 1024 px. Print needs 300 DPI on the full canvas.
 * When the file is smaller, repeat its pixels up to that canvas so the
 * print path can use the approved picture. A file that is already large
 * enough is returned unchanged. A file that cannot be read is returned
 * unchanged, and the 300 DPI check still refuses it.
 */
export function upscaleToPrintCanvas(
  image: SizedPrintImage,
  page: { widthInches: number; heightInches: number },
  dpi = 300
): SizedPrintImage {
  const targetWidth = Math.ceil(page.widthInches * dpi)
  const targetHeight = Math.ceil(page.heightInches * dpi)
  if (image.width >= targetWidth && image.height >= targetHeight) return image
  const kind = image.bytes[0] === 0xff && image.bytes[1] === 0xd8 ? "jpeg" : "png"
  const decoded = decodeRaster(image.bytes, kind)
  if (!decoded || decoded.width < 1 || decoded.height < 1) return image
  const rgba = scaleNearest(decoded.rgba, decoded.width, decoded.height, targetWidth, targetHeight)
  return {
    bytes: encodePng(targetWidth, targetHeight, rgba),
    width: targetWidth,
    height: targetHeight,
  }
}

function scaleNearest(
  source: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): Buffer {
  const out = Buffer.alloc(targetWidth * targetHeight * 4)
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / targetHeight))
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / targetWidth))
      const from = (sourceY * sourceWidth + sourceX) * 4
      const to = (y * targetWidth + x) * 4
      out[to] = source[from] ?? 0
      out[to + 1] = source[from + 1] ?? 0
      out[to + 2] = source[from + 2] ?? 0
      out[to + 3] = source[from + 3] ?? 255
    }
  }
  return out
}
