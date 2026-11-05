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
  /**
   * "soft-fade" matches a fade front: the campaign photo fills the message
   * column and the copy sits in white on a navy fade over it. The mailing
   * panel, postage, and barcode zone stay unpainted either way.
   */
  style?: "plain" | "soft-fade"
}

/** Photo slot id for the soft-fade back. Renderers fill it with the front photo. */
export const SOFT_FADE_BACK_PHOTO_ID = "back-fade-photo"
/** Share of the message column kept as photo above the copy. */
const FADE_PHOTO_SHARE = 0.34
/** Bigger type on the fade so it reads like the front. */
const FADE_BOOST: Partial<Record<FittedText["role"], number>> = { offer: 6, contact: 4, body: 1, proof: 1 }

export function isSoftFadeBack(plan: { photos: Array<{ id: string }> } | null | undefined): boolean {
  return Boolean(plan?.photos.some((slot) => slot.id === SOFT_FADE_BACK_PHOTO_ID))
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
  // A soft-fade back shows the photo, the offer, and the license unless the customer turned them off.
  const fadeDefaults = input.style === "soft-fade" ? { photo: true, offer: true, license: true } : {}
  const edit = input.spec.addressSide
  const resolved = resolveAddressSide(
    input.style === "soft-fade" ? { ...input.spec, addressSide: { ...edit, sections: { ...fadeDefaults, ...edit?.sections } } } : input.spec,
    fallbacks
  )
  const trim = input.size === "6x9" ? { w: 9, h: 6 } : { w: 8, h: 5 }
  const fade = input.style === "soft-fade" && resolved.photo !== "none"
  const ink = fade ? input.palette.fieldInk : input.ink ?? input.palette.ink
  const offerInk = fade ? input.palette.offerTile : ink
  const lineInput = { ...input, ink }
  const texts: FittedText[] = []
  const contentBottom = content.y + content.h
  const textTop = fade ? round2(content.y + content.h * FADE_PHOTO_SHARE) : content.y
  let floor = contentBottom

  const disclaimer = (input.disclaimer ?? "").replace(/\s+/g, " ").trim()
  if (disclaimer && content.h > 2.2) {
    const height = Math.min(0.62, content.h * 0.16)
    const rect = { x: content.x, y: round2(contentBottom - height), w: content.w, h: height }
    texts.push(fitLine(disclaimer, rect, "label", lineInput, 7, 8))
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

  // On the soft-fade back the photo is the whole column, not a thumbnail.
  const wantPhoto = resolved.photo !== "none" && !fade
  const wantQr = Boolean(resolved.sections.qr && resolved.qrDestination)
  const textNeed = lines.length * 0.24
  const bandRoom = floor - textTop - textNeed
  const band = wantPhoto || wantQr ? Math.max(0.72, Math.min(1.15, bandRoom - 0.08)) : 0
  const bandFits = band >= 0.72 && floor - band - textTop >= textNeed * 0.85
  if (bandFits) floor = round2(floor - band - 0.06)

  const messageStart = texts.length
  const roomEach = lines.length > 0 ? Math.max(0.2, (floor - textTop - 0.04 * lines.length) / lines.length) : 0
  let cursor = textTop
  for (const line of lines) {
    if (cursor >= floor - 0.16) break
    const rect = { x: content.x, y: cursor, w: content.w, h: Math.min(roomEach, floor - cursor) }
    const boost = fade ? FADE_BOOST[line.role] ?? 0 : 0
    const fitted = fitLine(line.text, rect, line.role, { ...lineInput, ink: line.role === "offer" ? offerInk : ink }, line.min, line.max + boost)
    const inkH = Math.max(0.18, Math.min(rect.h, fitted.lines.length * (fitted.fontPt / 72) * 1.15))
    texts.push({ ...fitted, rect: { ...fitted.rect, h: round2(inkH) } })
    cursor = round2(cursor + inkH + (fade ? 0.07 : 0.04))
  }
  // On the fade the copy sits low on the dark field, like the front, leaving the photo above.
  if (fade && texts.length > 0) {
    const messageTexts = texts.slice(messageStart)
    const drop = round2(Math.max(0, floor - cursor))
    for (const text of messageTexts) text.rect = { ...text.rect, y: round2(text.rect.y + drop) }
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
  if (fade) {
    // Bleeds off the left, top, and bottom edges. Stops at the content edge,
    // so the address, postage, and barcode zone keep plain paper.
    const right = round2(content.x + content.w)
    photos.unshift({
      id: SOFT_FADE_BACK_PHOTO_ID,
      role: "photo",
      rect: { x: 0, y: 0, w: right, h: trim.h },
      bleed: true,
      treatment: "cover",
      focal: { x: 0.5, y: 0.35 },
    })
    const copyTop = texts[messageStart]?.rect.y ?? textTop
    const fadeTop = round2(Math.max(0, copyTop - content.h * 0.3))
    shapes.push({ id: "back-fade", role: "solid-scrim", rect: { x: 0, y: fadeTop, w: right, h: round2(trim.h - fadeTop) }, fill: input.palette.scrim })
  }
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
