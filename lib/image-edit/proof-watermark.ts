import sharp from "sharp"

/**
 * A light PROOF mark on an unpaid word-change.
 * The mark is part of the picture, so saving the file keeps it.
 */
export async function stampProof(jpeg: Buffer, ink = "#ffffff"): Promise<Buffer> {
  const meta = await sharp(jpeg, { failOn: "none" }).metadata()
  const width = Math.max(1, meta.width ?? 1)
  const height = Math.max(1, meta.height ?? 1)
  const fontSize = Math.max(28, Math.round(Math.min(width, height) * 0.16))
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    fill="${xmlColor(ink)}" fill-opacity="0.38" font-size="${fontSize}" font-family="DejaVu Sans, sans-serif"
    transform="rotate(-18 ${width / 2} ${height / 2})">PROOF</text>
</svg>`
  return sharp(jpeg, { failOn: "none" })
    .composite([{ input: Buffer.from(svg), gravity: "center" }])
    .jpeg({ quality: 85, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer()
}

function xmlColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff"
}
