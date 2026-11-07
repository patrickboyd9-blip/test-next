import { createHash } from "node:crypto"

import { decodeRaster } from "@/lib/bring-your-own-design/decode-raster"
import { encodePng } from "@/lib/design-intelligence/cutout"
import type { BrandAsset, CampaignBrief } from "@/lib/campaign-creator/types"
import type { InchRect } from "@/lib/postcard-layouts/typefit"

/** Upper-left of the finished card, inside the 0.25 in safe inset. */
export const CUSTOMER_LOGO_BOX: InchRect = { x: 0.36, y: 0.32, w: 1.5, h: 0.82 }
/** Padding inside the box so the mark is not jammed against the type. */
export const CUSTOMER_LOGO_CLEAR_INCHES = 0.08
export const MAX_LOGO_BYTES = 4 * 1024 * 1024
export const MAX_LOGO_EDGE = 4000

export interface PreparedLogo {
  png: Buffer
  width: number
  height: number
  fileName: string
}

export function mentionsLogo(text: string | undefined | null): boolean {
  return /\blogos?\b/i.test(text ?? "")
}

export function uploadedLogo(brief: CampaignBrief | undefined | null): BrandAsset | null {
  const asset = brief?.brandAssets?.find((item) => item.type === "logo" && item.fileUrl?.startsWith("/api/studio-image/"))
  return asset ?? null
}

export function logoFileName(fileUrl: string, campaignId: string): string | null {
  const prefix = `/api/studio-image/${campaignId}/`
  if (!fileUrl.startsWith(prefix)) return null
  const name = fileUrl.slice(prefix.length).split("?")[0] ?? ""
  return /^logo-[a-f0-9]{8}\.png$/.test(name) ? name : null
}

/**
 * Keep a file-backed logo when a chat turn rewrites brand assets as descriptions.
 * A description of a logo is not a file.
 */
export function mergeBrandAssets(
  current: BrandAsset[] | undefined,
  incoming: BrandAsset[] | undefined
): BrandAsset[] | undefined {
  if (incoming === undefined) return undefined
  const kept = (current ?? []).filter((asset) => asset.type === "logo" && asset.fileUrl)
  const rest = incoming.filter((asset) => asset.type !== "logo" || Boolean(asset.fileUrl))
  const seen = new Set(kept.map((asset) => asset.fileUrl))
  return [...kept, ...rest.filter((asset) => !asset.fileUrl || !seen.has(asset.fileUrl))]
}

export function logoContainRect(
  box: InchRect,
  image: { width: number; height: number },
  clearInches = CUSTOMER_LOGO_CLEAR_INCHES
): InchRect {
  const inner = {
    x: box.x + clearInches,
    y: box.y + clearInches,
    w: Math.max(0.05, box.w - clearInches * 2),
    h: Math.max(0.05, box.h - clearInches * 2),
  }
  const scale = Math.min(inner.w / image.width, inner.h / image.height)
  const w = image.width * scale
  const h = image.height * scale
  return {
    x: inner.x + (inner.w - w) / 2,
    y: inner.y + (inner.h - h) / 2,
    w,
    h,
  }
}

/**
 * Accept a PNG or JPEG by its bytes. SVG is refused. The stored file is a PNG,
 * so transparency from a PNG survives and the print path has one format.
 */
export function prepareCustomerLogo(bytes: Uint8Array): { ok: true; logo: PreparedLogo } | { ok: false; error: string } {
  if (bytes.byteLength === 0) return { ok: false, error: "That file is empty. Choose a PNG or JPEG." }
  if (bytes.byteLength > MAX_LOGO_BYTES) return { ok: false, error: "The logo needs to be under 4 MB." }
  if (looksLikeSvg(bytes)) {
    return { ok: false, error: "SVG files are not accepted. Export a PNG, ideally with a transparent background." }
  }
  const kind = sniff(bytes)
  if (!kind) return { ok: false, error: "Use a PNG or JPEG. The file contents were not a picture." }
  const decoded = decodeRaster(bytes, kind)
  if (!decoded || decoded.width < 1 || decoded.height < 1) {
    return { ok: false, error: "That picture could not be read. Export it again as a PNG or JPEG." }
  }
  if (decoded.width > MAX_LOGO_EDGE || decoded.height > MAX_LOGO_EDGE) {
    return { ok: false, error: `The logo is too large. Use an image under ${MAX_LOGO_EDGE} pixels on a side.` }
  }
  const png = encodePng(decoded.width, decoded.height, Buffer.from(decoded.rgba))
  const fileName = `logo-${createHash("sha256").update(png).digest("hex").slice(0, 8)}.png`
  return { ok: true, logo: { png, width: decoded.width, height: decoded.height, fileName } }
}

export function replaceLogoAsset(current: BrandAsset[] | undefined, next: BrandAsset): BrandAsset[] {
  return [...(current ?? []).filter((asset) => asset.type !== "logo"), next]
}

export function removeLogoAsset(current: BrandAsset[] | undefined): BrandAsset[] {
  return (current ?? []).filter((asset) => !(asset.type === "logo" && asset.fileUrl))
}

function sniff(bytes: Uint8Array): "png" | "jpeg" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png"
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg"
  return null
}

function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 200))).toString("utf8").trim().toLowerCase()
  return head.startsWith("<svg") || head.startsWith("<?xml") && head.includes("<svg") || head.includes("<!doctype svg")
}
