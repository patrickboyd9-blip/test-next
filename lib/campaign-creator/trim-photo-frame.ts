import sharp from "sharp"

/**
 * Some generators (Imagen 4 especially) return the photo as a framed print on a
 * flat gray or white mat. Remove that mat so photo slots fill edge to edge.
 * Only trims when all four edges are one flat, low-saturation color, so a real
 * sky or lawn at the edge is never cut.
 */
export async function trimPhotoFrame(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels: c } = info
  const px = (x: number, y: number) => { const i = (y * w + x) * c; return [data[i]!, data[i + 1]!, data[i + 2]!] as const }
  const edge: (readonly [number, number, number])[] = []
  for (let x = 0; x < w; x += 8) edge.push(px(x, 2), px(x, h - 3))
  for (let y = 0; y < h; y += 8) edge.push(px(2, y), px(w - 3, y))
  const ref = edge[0]!
  const flat = edge.every((p) => Math.abs(p[0] - ref[0]) + Math.abs(p[1] - ref[1]) + Math.abs(p[2] - ref[2]) < 30)
  const gray = Math.max(...ref) - Math.min(...ref) < 24 && Math.min(...ref) > 150
  if (!flat || !gray) return input
  const trimmed = await sharp(input).trim({ background: { r: ref[0], g: ref[1], b: ref[2] }, threshold: 30 }).toBuffer({ resolveWithObject: true })
  // A mat can be slightly uneven; trim a second time from the new edge.
  const again = await sharp(trimmed.data).trim({ threshold: 30 }).toBuffer({ resolveWithObject: true }).catch(() => trimmed)
  if (again.info.width >= w * 0.5 && again.info.height >= h * 0.5) { trimmed.data = again.data; trimmed.info = again.info }
  const tw = trimmed.info.width, th = trimmed.info.height
  if (tw < w * 0.5 || th < h * 0.5) return input
  // Shave 3.5% more to drop any print shadow or mat edge.
  const dx = Math.round(tw * 0.035), dy = Math.round(th * 0.035)
  return sharp(trimmed.data).extract({ left: dx, top: dy, width: tw - 2 * dx, height: th - 2 * dy }).png().toBuffer()
}
