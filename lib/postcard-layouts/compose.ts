import { qrScanLabel } from "@/components/campaign-creator/studio/design-rules"
import type { CreativeSpec } from "@/lib/campaign-creator/types"
import { addressSideContentRect } from "@/lib/print-spec/address-side-content"
import {
  buildPostcard5x8PrintSpec,
  type InchesRect,
  type PostcardGeometry,
} from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"

import type { PostcardSizeId, PostcardTemplateId, VerticalPaletteId } from "./ids"
import { paletteById, type VerticalPalette } from "./palette"
import {
  clampToSafe,
  frontRegions,
  scaleRect,
  TEMPLATE_META,
  trimInches,
  type DesignRegion,
} from "./templates"
import { fitText, type FittedText, type InchRect, type TextRole } from "./typefit"

export interface PhotoSlotPlan {
  id: string
  role: string
  rect: InchRect
  bleed: boolean
}

export interface ShapePlan {
  id: string
  role: string
  rect: InchRect
  fill: string
}

export interface LockupPlan {
  rect: InchRect
  qrInches: number
  qrLabel: string
  phone?: FittedText
  website?: FittedText
}

export interface PostcardFacePlan {
  templateId: PostcardTemplateId
  size: PostcardSizeId
  face: "front" | "back"
  pairing: (typeof TEMPLATE_META)[PostcardTemplateId]["pairing"]
  palette: VerticalPalette
  photos: PhotoSlotPlan[]
  shapes: ShapePlan[]
  texts: FittedText[]
  lockup: LockupPlan | null
  overflows: boolean
  /** Phone, website, and a scan code are required on the front. */
  missingContact: string[]
}

export interface ComposeInput {
  templateId: PostcardTemplateId
  size?: PostcardSizeId
  face?: "front" | "back"
  spec: Pick<
    CreativeSpec,
    "headline" | "subheadline" | "body" | "offer" | "callToAction" | "phone" | "website" | "qrDestination"
  >
  businessName?: string
  qrPayload?: string | null
  paletteId?: VerticalPaletteId
  /** When set, the back message stays above the disclaimer band. */
  disclaimer?: boolean
}

export function composePostcardFace(input: ComposeInput): PostcardFacePlan {
  const size = input.size ?? "5x8"
  const face = input.face ?? "front"
  const meta = TEMPLATE_META[input.templateId]
  const palette = paletteById(input.paletteId ?? "general")
  if (face === "back") return composeBack(input, size, meta.pairing, palette)
  return composeFront(input, size, meta.pairing, palette)
}

function composeFront(
  input: ComposeInput,
  size: PostcardSizeId,
  pairing: PostcardFacePlan["pairing"],
  palette: VerticalPalette
): PostcardFacePlan {
  const regions = frontRegions(input.templateId).map((region) => ({
    ...region,
    ...scaleRect(region, size),
  }))
  const copy = resolveCopy(input)
  const texts: FittedText[] = []
  const shapes: ShapePlan[] = []
  const photos: PhotoSlotPlan[] = []

  for (const region of regions) {
    if (region.kind === "photo") {
      photos.push({
        id: region.id,
        role: region.role,
        rect: { x: region.x, y: region.y, w: region.w, h: region.h },
        bleed: Boolean(region.bleed),
      })
      continue
    }
    if (region.kind === "shape") {
      shapes.push({
        id: region.id,
        role: region.role,
        rect: { x: region.x, y: region.y, w: region.w, h: region.h },
        fill: shapeFill(region.role, palette),
      })
      continue
    }
    if (region.kind === "text") {
      const fitted = fitRegion(input.templateId, region, copy, pairing, palette, size)
      if (fitted) texts.push(fitted)
    }
  }

  const lockupRegion = regions.find((region) => region.kind === "lockup")
  const lockup = lockupRegion ? fitLockup(lockupRegion, input, copy, pairing, palette, size) : null
  const shown = texts.filter((text) => text.lines.length > 0)
  enforceHierarchy(shown)
  const visible = shown.filter((text) => text.lines.length > 0)
  const overflows = visible.some((text) => text.overflows) || Boolean(lockup?.phone?.overflows) || Boolean(lockup?.website?.overflows)
  const missingContact: string[] = []
  if (!lockup?.phone?.text) missingContact.push("phone")
  if (!lockup?.website?.text) missingContact.push("website")
  if (!lockup?.qrLabel) missingContact.push("qr")

  return {
    templateId: input.templateId,
    size,
    face: "front",
    pairing,
    palette,
    photos,
    shapes,
    texts: visible,
    lockup,
    overflows,
    missingContact,
  }
}

function composeBack(
  input: ComposeInput,
  size: PostcardSizeId,
  pairing: PostcardFacePlan["pairing"],
  palette: VerticalPalette
): PostcardFacePlan {
  const box = backMessageRect(size, Boolean(input.disclaimer))
  const copy = resolveCopy(input)
  const roles = backRoles(input.templateId)
  const texts: FittedText[] = []
  const shapes: ShapePlan[] = []
  const gap = 0.06
  let cursor = box.y
  const each = roles.length > 0 ? (box.h - gap * (roles.length - 1)) / roles.length : box.h

  if (input.templateId === "deadline_coupon") {
    shapes.push({
      id: "back-coupon",
      role: "coupon",
      rect: { x: box.x, y: box.y, w: Math.min(box.w, 2.4), h: Math.min(box.h, 1.15) },
      fill: palette.paper,
    })
  }

  for (const role of roles) {
    const text = backCopy(copy, role)
    const rect = clampToSafe({ x: box.x, y: cursor, w: box.w, h: each }, size)
    cursor += each + gap
    if (!text) continue
    const color = role === "offer" ? palette.accent : palette.ink
    const fitted = fitText({
      text,
      rect,
      role,
      pairing,
      color: contrastSafe(color, palette.paper, palette.ink),
      maxPt: role === "offer" ? 18 : role === "headline" ? 16 : 12,
    })
    if (fitted.lines.length > 0) texts.push(fitted)
  }

  return {
    templateId: input.templateId,
    size,
    face: "back",
    pairing,
    palette,
    photos: [],
    shapes,
    texts,
    lockup: null,
    overflows: texts.some((text) => text.overflows),
    missingContact: [],
  }
}

function fitRegion(
  template: PostcardTemplateId,
  region: DesignRegion,
  copy: CopyBlocks,
  pairing: PostcardFacePlan["pairing"],
  palette: VerticalPalette,
  size: PostcardSizeId
): FittedText | null {
  const role = region.role as TextRole
  const text = textForRole(role, region.id, copy)
  if (!text) return null
  const rect = clampToSafe(region, size)
  const color = textColor(template, role, region.id, palette)
  let maxPt = undefined as number | undefined
  if (role === "headline" && copy.offer && !same(copy.offer, copy.headline)) {
    maxPt = undefined
  }
  return fitText({
    text,
    rect,
    role,
    pairing,
    color,
    align: region.align,
    maxPt,
  })
}

/**
 * Offer stays larger than the headline, and the headline stays at least
 * 2.5× the body when a body line is shown. A body that cannot hold that
 * ratio is dropped instead of printed as fine type.
 */
function enforceHierarchy(texts: FittedText[]): void {
  const offer = texts.find((text) => text.role === "offer")
  const headline = texts.find((text) => text.role === "headline")
  const body = texts.find((text) => text.role === "body")
  if (offer && headline && offer.fontPt <= headline.fontPt) {
    headline.fontPt = Math.max(15, offer.fontPt - 2)
    headline.overflows = headline.overflows || false
  }
  if (headline && body) {
    const cap = headline.fontPt / 2.5
    if (cap < 11) {
      body.lines = []
      body.text = ""
    } else if (body.fontPt > cap) {
      body.fontPt = Math.max(11, Math.floor(cap * 2) / 2)
    }
  }
}

function fitLockup(
  region: DesignRegion,
  input: ComposeInput,
  copy: CopyBlocks,
  pairing: PostcardFacePlan["pairing"],
  palette: VerticalPalette,
  size: PostcardSizeId
): LockupPlan {
  const rect = clampToSafe(region, size)
  const qrInches = Math.min(1.05, Math.max(0.78, Math.min(rect.h - 0.22, rect.w * 0.34)))
  const textX = rect.x + qrInches + 0.12
  const textW = Math.max(0.8, rect.w - qrInches - 0.12)
  const color = lockupOnDark(input.templateId) ? palette.fieldInk : palette.ink
  const phone = copy.phone
    ? fitText({
        text: copy.phone,
        rect: { x: textX, y: rect.y + 0.08, w: textW, h: 0.38 },
        role: "contact",
        pairing,
        color,
        maxPt: 13,
      })
    : undefined
  const website = copy.website
    ? fitText({
        text: copy.website,
        rect: { x: textX, y: rect.y + 0.46, w: textW, h: 0.32 },
        role: "contact",
        pairing,
        color,
        maxPt: 11,
      })
    : undefined
  const qrLabel = qrScanLabel(input.spec.callToAction, input.qrPayload ?? copy.qr)
  return { rect, qrInches, qrLabel, phone, website }
}

interface CopyBlocks {
  offer: string
  headline: string
  subheadline: string
  body: string
  eyebrow: string
  phone: string
  website: string
  proof: string
  badge: string
  before: string
  after: string
  qr: string
}

function resolveCopy(input: ComposeInput): CopyBlocks {
  const offer = clean(input.spec.offer)
  const headline = clean(input.spec.headline)
  const subheadline = clean(input.spec.subheadline)
  const body = clean(input.spec.body)
  const distinctHeadline = same(offer, headline) ? (same(subheadline, offer) ? "" : subheadline) : headline
  const blob = [offer, headline, subheadline, body, input.spec.callToAction].filter(Boolean).join(" ")
  const years = blob.match(/(\d{1,3})\s*\+?\s*years/i)
  const business = clean(input.businessName ?? "")
  const eyebrow =
    input.templateId === "neighbor_letter"
      ? business
        ? `A note from ${business}`
        : "A note from a neighbor"
      : input.templateId === "deadline_coupon"
        ? datedLine(subheadline) || "Your offer"
        : input.templateId === "medicare_calm" || input.templateId === "portrait_aside"
          ? business || "A local review"
          : ""
  return {
    offer,
    headline: distinctHeadline,
    subheadline,
    body: same(body, offer) || same(body, distinctHeadline) ? "" : body,
    eyebrow,
    phone: clean(input.spec.phone),
    website: displayHost(input.spec.website),
    proof: proofLine(blob, subheadline, body),
    badge: years ? years[1]! : "Local",
    before: "Before",
    after: "After",
    qr: clean(input.qrPayload ?? input.spec.qrDestination ?? input.spec.website ?? ""),
  }
}

function textForRole(role: TextRole, id: string, copy: CopyBlocks): string {
  if (id === "before-label") return copy.before
  if (id === "after-label") return copy.after
  if (id === "badge-label") return copy.badge
  if (role === "offer") return copy.offer
  if (role === "headline") return copy.headline
  if (role === "body") return copy.body
  if (role === "eyebrow") return copy.eyebrow
  if (role === "proof") return copy.proof
  return ""
}

function proofLine(blob: string, subheadline: string, body: string): string {
  if (/\breviews?\b|\bstars?\b|\brated\b/i.test(blob)) {
    return subheadline || body || "Neighbors leave reviews"
  }
  return subheadline || ""
}

function datedLine(value: string): string {
  if (!value) return ""
  if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(value) || /\b\d{1,2}\/\d{1,2}\b/.test(value)) {
    return value
  }
  return ""
}

function backCopy(copy: CopyBlocks, role: TextRole): string {
  if (role === "offer") return copy.offer
  if (role === "headline") return copy.headline
  if (role === "body") return copy.body
  if (role === "eyebrow") return copy.eyebrow
  if (role === "proof") return copy.proof
  return ""
}

function backRoles(template: PostcardTemplateId): TextRole[] {
  switch (template) {
    case "neighbor_letter":
      return ["eyebrow", "body", "offer"]
    case "medicare_calm":
    case "portrait_aside":
      return ["headline", "body"]
    case "deadline_coupon":
      return ["offer", "body"]
    case "trust_proof":
      return ["proof", "headline"]
    default:
      return ["offer", "body"]
  }
}

function lockupOnDark(template: PostcardTemplateId): boolean {
  return (
    template === "hero_scrim" ||
    template === "color_block" ||
    template === "offer_starburst" ||
    template === "before_after"
  )
}

function shapeFill(role: string, palette: VerticalPalette): string {
  if (role === "field" || role === "band" || role === "scrim") return palette.field
  if (role === "chip") return palette.paper
  if (role === "badge") return palette.accent
  if (role === "coupon") return palette.paper
  if (role === "rule") return palette.accent
  return palette.paper
}

function textColor(
  template: PostcardTemplateId,
  role: TextRole,
  id: string,
  palette: VerticalPalette
): string {
  if (id === "badge-label") return palette.accentInk
  if (role === "label") return palette.ink
  if (template === "offer_starburst" && role === "offer") return palette.accentInk
  if (template === "hero_scrim" || template === "color_block") return palette.fieldInk
  if (template === "offer_starburst" && role === "headline") return palette.fieldInk
  if (template === "before_after" && (role === "offer" || role === "headline")) return palette.fieldInk
  if (template === "service_band" && role === "offer") return palette.fieldInk
  if (role === "offer") return palette.accent
  return palette.ink
}

function contrastSafe(preferred: string, background: string, fallback: string): string {
  return preferred === fallback ? preferred : preferred || fallback
}

export function backMessageRect(size: PostcardSizeId, disclaimer: boolean): InchRect {
  const spec = geometryFor(size)
  const content = addressSideContentRect(spec)
  const bleed = spec.bleedInchesPerSide
  const trim: InchRect = {
    x: content.xInches - bleed,
    y: content.yInches - bleed,
    w: content.widthInches,
    h: content.heightInches,
  }
  const topReserve = 1.15
  const bottomReserve = disclaimer ? 1.45 : 1.25
  return {
    x: trim.x + 0.06,
    y: trim.y + topReserve,
    w: Math.max(1.2, trim.w - 0.12),
    h: Math.max(0.8, trim.h - topReserve - bottomReserve),
  }
}

export function geometryFor(size: PostcardSizeId): PostcardGeometry {
  return size === "6x9" ? buildPostcard6x9PrintSpec() : buildPostcard5x8PrintSpec()
}

export function trimKeepOuts(size: PostcardSizeId): Array<InchRect & { id: string }> {
  const spec = geometryFor(size)
  const bleed = spec.bleedInchesPerSide
  return spec.keepOuts.map((keepOut) => ({
    id: keepOut.id,
    x: keepOut.canvas.xInches - bleed,
    y: keepOut.canvas.yInches - bleed,
    w: keepOut.canvas.widthInches,
    h: keepOut.canvas.heightInches,
  }))
}

export function contentTrimRect(size: PostcardSizeId): InchRect {
  const spec = geometryFor(size)
  const content = addressSideContentRect(spec)
  const bleed = spec.bleedInchesPerSide
  return {
    x: content.xInches - bleed,
    y: content.yInches - bleed,
    w: content.widthInches,
    h: content.heightInches,
  }
}

export function canvasRect(rect: InchRect, bleed = 0.25): InchesRect {
  return {
    xInches: rect.x + bleed,
    yInches: rect.y + bleed,
    widthInches: rect.w,
    heightInches: rect.h,
  }
}

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase() && a.trim().length > 0
}

function displayHost(value: string | undefined): string {
  return clean(value).replace(/^https?:\/\//i, "").replace(/\/$/, "")
}

export function safeTrimRect(size: PostcardSizeId): InchRect {
  const trim = trimInches(size)
  return { x: 0.25, y: 0.25, w: trim.w - 0.5, h: trim.h - 0.5 }
}

export function showsReviewStars(spec: ComposeInput["spec"]): boolean {
  const blob = [spec.headline, spec.subheadline, spec.body, spec.offer].filter(Boolean).join(" ")
  return /\breviews?\b|\bstars?\b|\brated\b/i.test(blob)
}
