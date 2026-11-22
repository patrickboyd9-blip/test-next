import sharp from "sharp"

import type { LockedHeroSize } from "@/lib/mail-templates/locked-hero"
import { addressSideContentRect } from "@/lib/print-spec/address-side-content"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"

const PREVIEW_DPI = 80

export interface AddressBackCopy {
  size: LockedHeroSize
  businessName: string
  offer: string
  callToAction: string
  phone: string
  website: string
}

/**
 * The address side, assembled the way a proof already keeps the message out of
 * the address panel. No model is called.
 */
export async function assembleAddressBack(copy: AddressBackCopy): Promise<Buffer> {
  const spec = copy.size === "6x9" ? buildPostcard6x9PrintSpec() : buildPostcard5x8PrintSpec()
  const width = Math.max(1, Math.round(spec.artworkCanvasInches.widthInches * PREVIEW_DPI))
  const height = Math.max(1, Math.round(spec.artworkCanvasInches.heightInches * PREVIEW_DPI))
  const content = addressSideContentRect(spec)
  const svg = addressBackSvg(copy, {
    width,
    height,
    x: content.xInches * PREVIEW_DPI,
    y: content.yInches * PREVIEW_DPI,
    w: content.widthInches * PREVIEW_DPI,
    h: content.heightInches * PREVIEW_DPI,
  })
  return sharp({
    create: { width, height, channels: 3, background: "#f4f1ea" },
  })
    .composite([{ input: Buffer.from(svg) }])
    .jpeg({ quality: 85, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer()
}

export function addressBackSvg(
  copy: AddressBackCopy,
  box: { width: number; height: number; x: number; y: number; w: number; h: number }
): string {
  const size = Math.max(12, Math.round(box.h / 9))
  const maxChars = Math.max(16, Math.floor(box.w / (size * 0.55)))
  const blocks = [
    copy.businessName,
    copy.offer,
    copy.callToAction,
    copy.phone,
    copy.website,
  ].filter((line) => line.trim().length > 0)
  const lines = blocks.flatMap((line) => wrap(line, maxChars)).slice(0, 12)
  const text = lines
    .map((line, index) => {
      const y = box.y + size + index * (size + 6)
      return `<text x="${round(box.x)}" y="${round(y)}" fill="#1c2430" font-size="${size}" font-family="DejaVu Sans, sans-serif">${xml(line)}</text>`
    })
    .join("")
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${box.width}" height="${box.height}" viewBox="0 0 ${box.width} ${box.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#f4f1ea"/>
  ${text}
</svg>`
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ")
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxChars && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}
