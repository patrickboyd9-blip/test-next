import type { CreativeSpec } from "@/lib/campaign-creator/types"
import type { LockupPlan, PhotoSlotPlan, PostcardFacePlan, ShapePlan } from "@/lib/postcard-layouts/compose"
import type { FontPairingId, PostcardSizeId, PostcardTemplateId } from "@/lib/postcard-layouts/ids"
import type { VerticalPalette } from "@/lib/postcard-layouts/palette"
import { fitText, type FittedText, type InchRect } from "@/lib/postcard-layouts/typefit"
import { addressSideContentRect } from "@/lib/print-spec/address-side-content"
import type { InchesRect } from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"

import { resolveAddressSide, type AddressSideFallbacks } from "./address-side"

const SCAN_LABEL = "Scan to book"

export interface AddressSideLayoutInput {
  size: PostcardSizeId
  pairing: FontPairingId
  palette: VerticalPalette
  /** Ink for the message. Defaults to the palette ink. */
  ink?: string
  spec: CreativeSpec
  businessName?: string
  phone?: string
  website?: string
  proof?: string
  license?: string
  returnAddress?: string
  qrDestination?: string
  disclaimer?: string | null
  complianceMark?: string | null
  templateId?: PostcardTemplateId
}

/**
 * Address-side message. Every line, photograph, and QR stays inside the
 * content column. The mailing panel, postage, and barcode are not painted.
 */
export function composeAddressSideFace(input: AddressSideLayoutInput): PostcardFacePlan {
  const geometry = input.size === "6x9" ? buildPostcard6x9PrintSpec() : buildPostcard5x8PrintSpec()
  const content = canvasToTrim(addressSideContentRect(geometry), geometry.bleedInchesPerSide)
  const fallbacks: AddressSideFallbacks = {
    businessName: input.businessName,
    proof: input.proof,
    phone: input.phone,
    website: input.website,
    license: input.license,
    returnAddress: input.returnAddress,
    qrDestination: input.qrDestination,
  }
  const resolved = resolveAddressSide(input.spec, fallbacks)
  const trim = input.size === "6x9" ? { w: 9, h: 6 } : { w: 8, h: 5 }
  const texts: FittedText[] = []
  const contentBottom = content.y + content.h
  let floor = contentBottom

  const disclaimer = (input.disclaimer ?? "").replace(/\s+/g, " ").trim()
  if (disclaimer && content.h > 2.2) {
    const height = Math.min(0.62, content.h * 0.16)
    const rect = { x: content.x, y: round2(contentBottom - height), w: content.w, h: height }
    texts.push(fitLine(disclaimer, rect, "label", input, 7, 8))
    floor = rect.y - 0.05
  }

  const lines: Array<{ text: string; role: FittedText["role"]; min: number; max: number }> = []
  const mark = (input.complianceMark ?? "").replace(/\s+/g, " ").trim()
  if (mark) lines.push({ text: mark, role: "label", min: 7, max: 8 })
  if (resolved.businessName) lines.push({ text: resolved.businessName, role: "proof", min: 8, max: 13 })
  if (resolved.sections.offer && resolved.offer) lines.push({ text: resolved.offer, role: "offer", min: 11, max: 15 })
  if (resolved.sections.benefits) {
    for (const benefit of resolved.benefits) {
      lines.push({ text: `• ${benefit}`, role: "body", min: 9, max: 12 })
    }
  }
  if (resolved.sections.proof && resolved.proof) lines.push({ text: resolved.proof, role: "body", min: 9, max: 12 })
  if (resolved.sections.license && resolved.license) lines.push({ text: resolved.license, role: "label", min: 8, max: 11 })
  if (resolved.sections.contact && resolved.phone) lines.push({ text: resolved.phone, role: "contact", min: 10, max: 14 })
  if (resolved.sections.contact && resolved.website) lines.push({ text: resolved.website, role: "label", min: 9, max: 11 })
  if (resolved.sections.returnAddress && resolved.returnAddress) {
    for (const line of resolved.returnAddress.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 3)) {
      lines.push({ text: line, role: "label", min: 8, max: 10 })
    }
  }

  const wantPhoto = resolved.photo !== "none"
  const wantQr = Boolean(resolved.sections.qr && resolved.qrDestination)
  const textNeed = lines.length * 0.24
  const bandRoom = floor - content.y - textNeed
  const band = wantPhoto || wantQr ? Math.max(0.72, Math.min(1.15, bandRoom - 0.08)) : 0
  const bandFits = band >= 0.72 && floor - band - content.y >= textNeed * 0.85
  if (bandFits) floor = round2(floor - band - 0.06)

  const roomEach = lines.length > 0 ? Math.max(0.2, (floor - content.y - 0.04 * lines.length) / lines.length) : 0
  let cursor = content.y
  for (const line of lines) {
    if (cursor >= floor - 0.16) break
    const rect = { x: content.x, y: cursor, w: content.w, h: Math.min(roomEach, floor - cursor) }
    const fitted = fitLine(line.text, rect, line.role, input, line.min, line.max)
    const inkH = Math.max(0.18, Math.min(rect.h, fitted.lines.length * (fitted.fontPt / 72) * 1.15))
    texts.push({ ...fitted, rect: { ...fitted.rect, h: round2(inkH) } })
    cursor = round2(cursor + inkH + 0.04)
  }

  const photos: PhotoSlotPlan[] = []
  let lockup: LockupPlan | null = null
  if (bandFits) {
    const bandTop = round2(floor + 0.06)
    const bandHeight = round2(Math.min(band, contentBottom - bandTop - (disclaimer ? 0.67 : 0)))
    let x = content.x
    if (wantPhoto && bandHeight >= 0.7) {
      const width = Math.min(wantQr ? 1.35 : 1.7, content.w * (wantQr ? 0.42 : 0.5), bandHeight)
      photos.push({
        id: "address-photo",
        role: "photo",
        rect: { x, y: bandTop, w: round2(width), h: round2(Math.min(bandHeight, width)) },
        bleed: false,
        treatment: "cover",
      })
      x = round2(x + width + 0.1)
    }
    if (wantQr && content.x + content.w - x >= 0.68 && bandHeight >= 0.68) {
      const size = round2(Math.min(0.78, bandHeight, content.x + content.w - x))
      const qrRect = { x, y: bandTop, w: size, h: size }
      lockup = { rect: qrRect, qrRect, qrInches: size, qrLabel: SCAN_LABEL, qrLabelPt: 8 }
    }
  }

  const shapes: ShapePlan[] = [
    { id: "paper", role: "paper", rect: { x: 0, y: 0, w: trim.w, h: trim.h }, fill: input.palette.paper },
  ]
  return {
    templateId: input.templateId ?? "medicare_calm",
    size: input.size,
    face: "back",
    pairing: input.pairing,
    palette: input.palette,
    photos,
    shapes,
    texts,
    trust: [],
    lockup,
    overflows: false,
    missingContact: [],
  }
}

export function addressSideArtRects(plan: PostcardFacePlan): InchRect[] {
  const rects = [
    ...plan.texts.map((text) => text.rect),
    ...plan.photos.map((slot) => slot.rect),
  ]
  if (plan.lockup) rects.push(plan.lockup.qrRect)
  return rects
}

function fitLine(
  text: string,
  rect: InchRect,
  role: FittedText["role"],
  input: AddressSideLayoutInput,
  minPt: number,
  maxPt: number
): FittedText {
  return fitText({
    text,
    rect,
    role,
    pairing: input.pairing,
    color: input.ink ?? input.palette.ink,
    minPt,
    maxPt,
  })
}

function canvasToTrim(rect: InchesRect, bleed: number): InchRect {
  return {
    x: round2(rect.xInches - bleed),
    y: round2(rect.yInches - bleed),
    w: round2(rect.widthInches),
    h: round2(rect.heightInches),
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
