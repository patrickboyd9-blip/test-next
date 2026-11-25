import sharp from "sharp"

import type { GalleryRedoCopy } from "./gallery-curation"

/** Postcard proportion the gallery already crops to: 8 by 5. */
export const GALLERY_CARD_WIDTH = 2400
export const GALLERY_CARD_HEIGHT = 1500

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function text(value: string, x: number, y: number, size: number, fill: string, weight: number): string {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Inter, Liberation Sans, sans-serif" font-weight="${weight}" font-size="${size}">${escapeXml(value)}</text>`
}

function fadeSvg(redo: GalleryRedoCopy): string {
  const offer = redo.lines.find((line) => line.role === "offer")?.text ?? redo.offer
  const headline = redo.lines.find((line) => line.role === "headline")?.text ?? redo.headline
  const support = redo.lines.find((line) => line.role === "support")?.text ?? redo.subheadline
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${GALLERY_CARD_WIDTH}" height="${GALLERY_CARD_HEIGHT}" viewBox="0 0 ${GALLERY_CARD_WIDTH} ${GALLERY_CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${redo.paper}" stop-opacity="0.82"/>
      <stop offset="0.48" stop-color="${redo.paper}" stop-opacity="0.28"/>
      <stop offset="0.72" stop-color="${redo.paper}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${GALLERY_CARD_WIDTH}" height="${GALLERY_CARD_HEIGHT}" fill="url(#fade)"/>
  <rect x="96" y="430" width="168" height="18" fill="${redo.accent}"/>
  <circle cx="2140" cy="180" r="70" fill="${redo.accent}"/>
  ${text(offer, 96, 620, 168, redo.ink, 700)}
  ${text(headline, 96, 760, 72, redo.ink, 650)}
  ${text(support, 96, 860, 40, redo.ink, 500)}
</svg>`
}

function framedSvg(redo: GalleryRedoCopy): string {
  const offer = redo.lines.find((line) => line.role === "offer")?.text ?? redo.offer
  const headline = redo.lines.find((line) => line.role === "headline")?.text ?? redo.headline
  const support = redo.lines.find((line) => line.role === "support")?.text ?? redo.subheadline
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${GALLERY_CARD_WIDTH}" height="${GALLERY_CARD_HEIGHT}" viewBox="0 0 ${GALLERY_CARD_WIDTH} ${GALLERY_CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${GALLERY_CARD_WIDTH}" height="36" fill="${redo.accent}"/>
  <rect x="0" y="1464" width="${GALLERY_CARD_WIDTH}" height="36" fill="${redo.accent}"/>
  <rect x="0" y="0" width="36" height="${GALLERY_CARD_HEIGHT}" fill="${redo.accent}"/>
  <rect x="2364" y="0" width="36" height="${GALLERY_CARD_HEIGHT}" fill="${redo.accent}"/>
  <rect x="72" y="72" width="860" height="250" fill="${redo.paper}"/>
  <rect x="72" y="1120" width="1100" height="280" fill="${redo.accent}"/>
  ${text(headline, 108, 190, 64, redo.ink, 700)}
  ${text(support, 108, 270, 36, redo.ink, 500)}
  ${text(offer, 108, 1300, 120, "#fffaf3", 700)}
</svg>`
}

function splitSvg(redo: GalleryRedoCopy): string {
  const headline = redo.lines.find((line) => line.role === "headline")?.text ?? redo.headline
  const support = redo.lines.find((line) => line.role === "support")?.text ?? redo.subheadline
  const offer = redo.lines.find((line) => line.role === "offer")?.text ?? redo.offer
  // The postcard base is already paper-colored. Do not fill this overlay, or the photo disappears.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${GALLERY_CARD_WIDTH}" height="${GALLERY_CARD_HEIGHT}" viewBox="0 0 ${GALLERY_CARD_WIDTH} ${GALLERY_CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect x="18" y="18" width="${GALLERY_CARD_WIDTH - 36}" height="${GALLERY_CARD_HEIGHT - 36}" fill="none" stroke="${redo.accent}" stroke-width="28"/>
  <rect x="1320" y="46" width="1034" height="1408" fill="${redo.paper}"/>
  ${text("A local story", 1400, 280, 32, redo.accent, 650)}
  ${text(headline, 1400, 460, 64, redo.ink, 700)}
  ${text(support, 1400, 620, 36, redo.ink, 500)}
  ${text(offer, 1400, 860, 42, redo.ink, 700)}
  ${text("Not an appraisal.", 1400, 940, 28, redo.ink, 500)}
</svg>`
}

function overlay(redo: GalleryRedoCopy): string {
  if (redo.layout === "framed") return framedSvg(redo)
  if (redo.layout === "split") return splitSvg(redo)
  return fadeSvg(redo)
}

/** Paint the offer onto a photograph so the gallery thumbnail reads as a mailer. */
export async function composeGalleryRedo(photo: Buffer, redo: GalleryRedoCopy): Promise<Buffer> {
  const width = GALLERY_CARD_WIDTH
  const height = GALLERY_CARD_HEIGHT
  if (redo.layout === "split") {
    const photoWidth = 1240
    const photoHeight = 1340
    const plate = await sharp(photo)
      .resize(photoWidth, photoHeight, { fit: "cover", position: "attention" })
      .jpeg()
      .toBuffer()
    const base = sharp({
      create: { width, height, channels: 3, background: redo.paper },
    })
    return base
      .composite([
        { input: plate, left: 56, top: 80 },
        { input: Buffer.from(overlay(redo)), left: 0, top: 0 },
      ])
      .jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toBuffer()
  }
  const cover = await sharp(photo).resize(width, height, { fit: "cover", position: "attention" }).jpeg().toBuffer()
  return sharp(cover)
    .composite([{ input: Buffer.from(overlay(redo)), left: 0, top: 0 }])
    .jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer()
}
