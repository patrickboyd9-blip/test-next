import sharp from "sharp"

/** Long side of a 6×9 postcard at 300 dpi. Do not enlarge a smaller photo. */
export const PRINT_LONG_SIDE = 2775
/** Same quality the gallery files use. */
export const PRINT_JPEG_QUALITY = 85

export async function toPrintJpeg(bytes: Buffer): Promise<Buffer> {
  const image = sharp(bytes, { failOn: "none" }).rotate()
  const meta = await image.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const long = Math.max(width, height)
  const fitted =
    long > PRINT_LONG_SIDE
      ? image.resize({
          width: width >= height ? PRINT_LONG_SIDE : undefined,
          height: height > width ? PRINT_LONG_SIDE : undefined,
          fit: "inside",
          withoutEnlargement: true,
        })
      : image
  return fitted.jpeg({ quality: PRINT_JPEG_QUALITY, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer()
}
