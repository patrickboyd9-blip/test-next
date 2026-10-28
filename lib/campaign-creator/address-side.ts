import { addressSideContentRect, rectsOverlap } from "@/lib/print-spec/address-side-content"
import {
  buildPostcard5x8PrintSpec,
  type InchesRect,
  type PostcardGeometry,
} from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"
import { readRasterSize } from "@/lib/print-spec/raster"
import type { PostcardPrintImage } from "@/lib/print-spec/render-campaign-postcard-pdf"

import { getActiveRevision } from "./creative-state"
import type { AddressSideEdit, AddressSideSections, Campaign, CreativeSpec } from "./types"

export const ADDRESS_SIDE_PHOTO_NONE = "none"
const MAX_PHOTO_CHARS = 600_000

export const DEFAULT_ADDRESS_SIDE_SECTIONS: AddressSideSections = {
  offer: false,
  benefits: false,
  proof: true,
  license: false,
  contact: true,
  returnAddress: false,
  qr: false,
  photo: false,
}

const LIMITS: Record<string, number> = {
  businessName: 80,
  offer: 160,
  benefits: 400,
  proof: 180,
  license: 80,
  phone: 40,
  website: 120,
  returnAddress: 180,
  qrDestination: 200,
}

export interface AddressSideFallbacks {
  businessName?: string
  /** Shown in the offer field. Printing still uses the spec offer until the customer types one. */
  offer?: string
  proof?: string
  phone?: string
  website?: string
  license?: string
  returnAddress?: string
  qrDestination?: string
}

export interface ResolvedAddressSide {
  sections: AddressSideSections
  businessName: string
  offer: string
  benefits: string[]
  proof: string
  license: string
  phone: string
  website: string
  returnAddress: string
  qrDestination: string
  /** "campaign" uses the postcard photograph. "none" hides it. A data URL replaces it. */
  photo: "campaign" | "none" | string
}

export interface AddressLock {
  id: "postage" | "address" | "barcode"
  label: string
  /** Trim inches, origin at the top left. */
  x: number
  y: number
  w: number
  h: number
}

export function resolveAddressSideSections(edit: AddressSideEdit | undefined): AddressSideSections {
  return { ...DEFAULT_ADDRESS_SIDE_SECTIONS, ...edit?.sections }
}

/** Proof line the generated back already prints when the customer has not typed one. */
export function fallbackBackProof(trustLine: string | undefined, offer: string): string {
  const text = (trustLine ?? "").replace(/\s+/g, " ").trim()
  if (!text || /^one proof line$/i.test(text) || /^proof stays on this side$/i.test(text)) {
    return offer || "The offer is on the front."
  }
  return text
}

export function resolveAddressSide(spec: CreativeSpec, fallbacks: AddressSideFallbacks = {}): ResolvedAddressSide {
  const edit = spec.addressSide
  const sections = resolveAddressSideSections(edit)
  const benefits = (typeof edit?.benefits === "string" ? edit.benefits : "")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 4)
  const photoSrc = edit?.photoSrc
  let photo: ResolvedAddressSide["photo"] = "none"
  if (sections.photo) {
    if (photoSrc === ADDRESS_SIDE_PHOTO_NONE) photo = "none"
    else if (typeof photoSrc === "string" && isPhotoDataUrl(photoSrc)) photo = photoSrc
    else photo = "campaign"
  }
  return {
    sections,
    businessName: field(edit?.businessName, fallbacks.businessName),
    offer: field(edit?.offer, spec.offer),
    benefits,
    proof: field(edit?.proof, fallbacks.proof),
    license: field(edit?.license, fallbacks.license),
    phone: field(edit?.phone, fallbacks.phone ?? spec.phone),
    website: field(edit?.website, fallbacks.website ?? spec.website),
    returnAddress: field(edit?.returnAddress, fallbacks.returnAddress),
    qrDestination: field(edit?.qrDestination, fallbacks.qrDestination ?? spec.qrDestination),
    photo,
  }
}

export function mergeAddressSide(current: AddressSideEdit | undefined, patch: AddressSideEdit): AddressSideEdit {
  const next: AddressSideEdit = {
    ...current,
    ...patch,
    sections: {
      ...DEFAULT_ADDRESS_SIDE_SECTIONS,
      ...current?.sections,
      ...patch.sections,
    },
  }
  if (patch.photoSrc === null) delete next.photoSrc
  return sanitizeAddressSide(next)
}

export function sanitizeAddressSide(edit: AddressSideEdit): AddressSideEdit {
  const next: AddressSideEdit = {
    sections: resolveAddressSideSections(edit),
  }
  for (const key of Object.keys(LIMITS) as Array<keyof typeof LIMITS>) {
    const raw = edit[key as keyof AddressSideEdit]
    if (typeof raw !== "string") continue
    const trimmed = key === "benefits" || key === "returnAddress"
      ? raw.replace(/\r/g, "").trim()
      : raw.replace(/\s+/g, " ").trim()
    if (!trimmed) {
      next[key as "offer"] = ""
      continue
    }
    next[key as "offer"] = trimmed.slice(0, LIMITS[key])
  }
  if (edit.photoSrc === ADDRESS_SIDE_PHOTO_NONE) next.photoSrc = ADDRESS_SIDE_PHOTO_NONE
  else if (typeof edit.photoSrc === "string" && isPhotoDataUrl(edit.photoSrc)) {
    if (edit.photoSrc.length > MAX_PHOTO_CHARS) {
      throw new Error("That photo is too large. Use an image under 400 KB.")
    }
    next.photoSrc = edit.photoSrc
  }
  return next
}

/** Preview image for the address side. Null hides the photograph. */
export function addressSidePreviewSrc(resolved: ResolvedAddressSide, campaignSrc: string | null): string | null {
  if (resolved.photo === "none") return null
  if (resolved.photo === "campaign") return campaignSrc
  return resolved.photo
}

export function addressSideQrPayload(
  spec: Pick<CreativeSpec, "addressSide" | "qrDestination">,
  fallback?: string | null
): string | undefined {
  const resolved = resolveAddressSide(spec, { qrDestination: fallback ?? undefined })
  if (!resolved.sections.qr) return undefined
  return resolved.qrDestination || undefined
}

export function postcardImageFromDataUrl(dataUrl: string): PostcardPrintImage | null {
  if (!isPhotoDataUrl(dataUrl)) return null
  const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1)
  const bytes = Uint8Array.from(Buffer.from(encoded, "base64"))
  if (bytes.length < 24) return null
  try {
    const size = readRasterSize(bytes)
    if (!size.width || !size.height) return null
    return { bytes, width: size.width, height: size.height }
  } catch {
    return null
  }
}

/**
 * Postage, the delivery-address panel, and the barcode. Trim inches.
 * These are the only regions the customer cannot cover.
 */
export function addressSideLocks(size: "5x8" | "6x9" = "5x8"): AddressLock[] {
  const geometry = size === "6x9" ? buildPostcard6x9PrintSpec() : buildPostcard5x8PrintSpec()
  const panel = trimKeepOut(geometry, "mailing_panel")
  const barcode = trimKeepOut(geometry, "barcode_strip")
  const trimW = geometry.finishedTrimInches.widthInches
  const postageX = Math.max(panel.x + 0.4, trimW - 2.65)
  const postage = {
    x: round2(postageX),
    y: 0.28,
    w: round2(Math.min(2.4, trimW - 0.2 - postageX)),
    h: round2(Math.min(0.95, Math.max(0.6, panel.y - 0.4))),
  }
  return [
    { id: "postage", label: "Postage", ...postage },
    { id: "address", label: "Address", ...panel },
    { id: "barcode", label: "Barcode", ...barcode },
  ]
}

/** Trim-inch art converted to canvas inches. Used to prove it misses the keep-outs. */
export function trimRectToCanvas(rect: { x: number; y: number; w: number; h: number }, bleed: number): InchesRect {
  return {
    xInches: rect.x + bleed,
    yInches: rect.y + bleed,
    widthInches: rect.w,
    heightInches: rect.h,
  }
}

export function artMissesKeepOuts(
  rects: Array<{ x: number; y: number; w: number; h: number }>,
  size: "5x8" | "6x9" = "5x8"
): boolean {
  const geometry = size === "6x9" ? buildPostcard6x9PrintSpec() : buildPostcard5x8PrintSpec()
  const content = addressSideContentRect(geometry)
  return rects.every((rect) => {
    const canvas = trimRectToCanvas(rect, geometry.bleedInchesPerSide)
    if (!inside(canvas, content)) return false
    return geometry.keepOuts.every((keepOut) => !rectsOverlap(canvas, keepOut.canvas))
  })
}

/** Write the edit onto the direction, the active revision, and the approved piece. */
export function writeAddressSide(campaign: Campaign, directionId: string, edit: AddressSideEdit): void {
  const clean = sanitizeAddressSide(edit)
  const direction = campaign.creative.directions.find((item) => item.id === directionId)
  if (!direction) throw new Error("That direction is no longer on this campaign.")
  stamp(direction.spec, clean)
  const revision = getActiveRevision(campaign.creative, directionId)
  if (revision && revision.spec !== direction.spec) stamp(revision.spec, clean)
  if (campaign.creative.selectedDirectionId === directionId && campaign.creative.activeSpec) {
    if (campaign.creative.activeSpec !== direction.spec) stamp(campaign.creative.activeSpec, clean)
  }
  if (campaign.creative.approvedSpec && campaign.mailPiece?.directionId === directionId) {
    if (campaign.creative.approvedSpec !== direction.spec) stamp(campaign.creative.approvedSpec, clean)
  }
  if (campaign.mailPiece && campaign.mailPiece.directionId === directionId && campaign.mailPiece.spec !== direction.spec) {
    stamp(campaign.mailPiece.spec, clean)
  }
  campaign.updatedAt = new Date().toISOString()
}

function stamp(spec: CreativeSpec, edit: AddressSideEdit) {
  spec.addressSide = edit
}

function field(value: string | undefined, fallback: string | undefined): string {
  if (typeof value === "string") return value.replace(/[ \t]+/g, " ").trim()
  return (fallback ?? "").replace(/\s+/g, " ").trim()
}

function isPhotoDataUrl(value: string): boolean {
  return /^data:image\/(png|jpeg|jpg);base64,/i.test(value)
}

function trimKeepOut(geometry: PostcardGeometry, id: string): { x: number; y: number; w: number; h: number } {
  const item = geometry.keepOuts.find((keepOut) => keepOut.id === id)
  if (!item) throw new Error(`Postcard is missing the ${id} keep-out.`)
  const bleed = geometry.bleedInchesPerSide
  return {
    x: round2(item.canvas.xInches - bleed),
    y: round2(item.canvas.yInches - bleed),
    w: round2(item.canvas.widthInches),
    h: round2(item.canvas.heightInches),
  }
}

function inside(inner: InchesRect, outer: InchesRect): boolean {
  return (
    inner.xInches >= outer.xInches - 0.02 &&
    inner.yInches >= outer.yInches - 0.02 &&
    inner.xInches + inner.widthInches <= outer.xInches + outer.widthInches + 0.02 &&
    inner.yInches + inner.heightInches <= outer.yInches + outer.heightInches + 0.02
  )
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
