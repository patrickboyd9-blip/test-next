import { qrScanLabel } from "@/components/campaign-creator/studio/design-rules"
import { headlineRestatesOffer } from "@/components/campaign-creator/studio/studio-copy-hierarchy"
import type { CreativeSpec } from "@/lib/campaign-creator/types"
import { addressSideContentRect } from "@/lib/print-spec/address-side-content"
import {
  buildPostcard5x8PrintSpec,
  type InchesRect,
  type PostcardGeometry,
} from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"
import { buildEddmPrintSpec } from "@/lib/print-spec/postcard-eddm-print-spec"
import {
  EDDM_INDICIA_LINES,
  EDDM_POSTAL_CUSTOMER,
  eddmMessageRect,
  eddmTrim,
  isEddmSize,
} from "@/lib/eddm/geometry"
import { toNeighborhoodCopy } from "@/lib/eddm/copy"

import type { LayoutSizeId, PostcardSizeId, PostcardTemplateId, VerticalPaletteId } from "./ids"
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
  /** cover fills a frame. cutout sits on the canvas. thumbnail is one cell in the bottom row. */
  treatment?: "cover" | "cutout" | "thumbnail"
}

export interface ShapePlan {
  id: string
  role: string
  rect: InchRect
  fill: string
}

export interface LockupPlan {
  rect: InchRect
  qrRect: InchRect
  qrInches: number
  qrLabel: string
  /** Print size of the scan label, in points. */
  qrLabelPt: number
  phone?: FittedText
  website?: FittedText
  phoneBox?: { rect: InchRect; fill: string }
}

export interface TrustChipPlan {
  id: string
  label: string
  rect: InchRect
  fill: string
  color: string
  /** Print size of the chip label, in points. */
  fontPt: number
}

export interface PostcardFacePlan<S extends LayoutSizeId = PostcardSizeId> {
  templateId: PostcardTemplateId
  size: S
  face: "front" | "back"
  pairing: (typeof TEMPLATE_META)[PostcardTemplateId]["pairing"]
  palette: VerticalPalette
  photos: PhotoSlotPlan[]
  shapes: ShapePlan[]
  texts: FittedText[]
  trust: TrustChipPlan[]
  lockup: LockupPlan | null
  overflows: boolean
  /** Phone, website, and a scan code are required on the front. */
  missingContact: string[]
}

export interface ComposeInput {
  templateId: PostcardTemplateId
  size?: LayoutSizeId
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
  /** A required legal label, such as Advertisement on an attorney card. */
  complianceMark?: string | null
}

export function composePostcardFace(input: ComposeInput & { size?: PostcardSizeId }): PostcardFacePlan
export function composePostcardFace(input: ComposeInput): PostcardFacePlan<LayoutSizeId>
export function composePostcardFace(input: ComposeInput): PostcardFacePlan<LayoutSizeId> {
  const size = input.size ?? "5x8"
  const face = input.face ?? "front"
  const meta = TEMPLATE_META[input.templateId]
  const palette = paletteById(input.paletteId ?? "general")
  if (face === "back") {
    if (isEddmSize(size)) return composeEddmBack(input, size, meta.pairing, palette)
    return composeBack(input, size, meta.pairing, palette)
  }
  return composeFront(input, size, meta.pairing, palette)
}

function composeFront(
  input: ComposeInput,
  size: LayoutSizeId,
  pairing: PostcardFacePlan["pairing"],
  palette: VerticalPalette
): PostcardFacePlan<LayoutSizeId> {
  const regions = frontRegions(input.templateId).map((region) => ({
    ...region,
    ...scaleRect(region, size),
  }))
  const copy = resolveCopy(input)
  const texts: FittedText[] = []
  const shapes: ShapePlan[] = []
  const photos: PhotoSlotPlan[] = []
  const chips = trustChipsForCopy(copy.blob)

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
    if (region.kind === "trust") continue
    if (region.kind === "shape") {
      if ((region.role === "offer-tile" || region.role === "coupon") && !copy.offer) continue
      shapes.push({
        id: region.id,
        role: region.role,
        rect: { x: region.x, y: region.y, w: region.w, h: region.h },
        fill: shapeFill(region.role, palette, input.templateId),
      })
      continue
    }
    if (region.kind === "text") {
      const fitted = fitRegion(input.templateId, region, copy, pairing, palette, size)
      if (fitted) texts.push(fitted)
    }
  }
  const trustRegion = regions.find((region) => region.kind === "trust")
  const trust = trustRegion ? placeTrustChips(trustRegion, chips, input.templateId, palette) : []

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
    trust,
    lockup,
    overflows,
    missingContact,
  }
}

function composeEddmBack(
  input: ComposeInput,
  size: LayoutSizeId,
  pairing: PostcardFacePlan["pairing"],
  palette: VerticalPalette
): PostcardFacePlan<LayoutSizeId> {
  if (!isEddmSize(size)) {
    throw new Error("EDDM back requires a 6.5×9 or 6.25×11 card.")
  }
  const trim = eddmTrim(size)
  const keepOuts = trimKeepOuts(size)
  const indicia = keepOuts.find((item) => item.id === "eddm_indicia")
  const address = keepOuts.find((item) => item.id === "postal_customer")
  const message = eddmMessageRect(trim)
  const copy = resolveCopy({
    ...input,
    spec: {
      ...input.spec,
      headline: toNeighborhoodCopy(input.spec.headline ?? ""),
      subheadline: toNeighborhoodCopy(input.spec.subheadline ?? ""),
      body: toNeighborhoodCopy(input.spec.body ?? ""),
      offer: toNeighborhoodCopy(input.spec.offer ?? ""),
      callToAction: toNeighborhoodCopy(input.spec.callToAction ?? ""),
    },
  })
  const texts: FittedText[] = []
  const shapes: ShapePlan[] = []
  if (indicia) {
    shapes.push({
      id: "eddm-indicia",
      role: "panel",
      rect: { x: indicia.x, y: indicia.y, w: indicia.w, h: indicia.h },
      fill: "#f4f1ea",
    })
    const lineH = (indicia.h - 0.28) / EDDM_INDICIA_LINES.length
    EDDM_INDICIA_LINES.forEach((line, index) => {
      const fitted = fitText({
        text: line,
        rect: {
          x: indicia.x + 0.12,
          y: indicia.y + 0.12 + index * lineH,
          w: indicia.w - 0.24,
          h: lineH,
        },
        role: "label",
        pairing,
        color: palette.ink,
        align: "center",
        minPt: 8,
        maxPt: 11,
      })
      if (fitted.lines.length > 0) texts.push(fitted)
    })
  }
  if (address) {
    const fitted = fitText({
      text: EDDM_POSTAL_CUSTOMER,
      rect: { x: address.x, y: address.y, w: address.w, h: address.h },
      role: "label",
      pairing,
      color: palette.ink,
      align: "left",
      minPt: 8,
      maxPt: 12,
    })
    if (fitted.lines.length > 0) texts.push(fitted)
  }
  const returnName = clean(input.businessName)
  if (returnName && address) {
    const fitted = fitText({
      text: returnName,
      rect: { x: 0.25, y: 0.28, w: Math.max(1.2, address.x - 0.4), h: 0.7 },
      role: "label",
      pairing,
      color: palette.ink,
      minPt: 8,
      maxPt: 11,
    })
    if (fitted.lines.length > 0) texts.push(fitted)
  }
  const roles = backRoles(input.templateId)
  const gap = 0.08
  let cursor = message.yInches
  let height = message.heightInches
  if (input.disclaimer) {
    height = Math.max(0.8, height - 0.4)
  }
  const each = roles.length > 0 ? (height - gap * Math.max(roles.length - 1, 0)) / roles.length : height
  for (const role of roles) {
    const text = backCopy(copy, role)
    const rect = { x: message.xInches, y: cursor, w: message.widthInches, h: Math.max(0.35, each) }
    cursor += each + gap
    if (!text) continue
    const fitted = fitText({
      text,
      rect,
      role,
      pairing,
      color: role === "offer" ? palette.accent : palette.ink,
      maxPt: role === "offer" ? 22 : role === "headline" ? 18 : 13,
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
    trust: [],
    lockup: null,
    overflows: texts.some((text) => text.overflows),
    missingContact: [],
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
  let height = box.h
  const mark = input.complianceMark?.trim()
  if (mark) {
    const labelH = 0.28
    const fitted = fitText({
      text: mark,
      rect: clampToSafe({ x: box.x, y: cursor, w: box.w, h: labelH }, size),
      role: "label",
      pairing,
      color: palette.ink,
      minPt: 8,
      maxPt: 9,
    })
    if (fitted.lines.length > 0) texts.push(fitted)
    cursor += labelH + gap
    height = Math.max(0.4, box.h - labelH - gap)
  }
  const each = roles.length > 0 ? (height - gap * Math.max(roles.length - 1, 0)) / roles.length : height

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
    trust: [],
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
  size: LayoutSizeId
): FittedText | null {
  const role = region.role as TextRole
  const text = textForRole(role, region.id, copy)
  if (!text) return null
  const rect = clampToSafe(region, size)
  const color = textColor(template, role, region.id, palette)
  const pill = region.id === "before-label" || region.id === "after-label"
  let maxPt = undefined as number | undefined
  if (pill) maxPt = 13
  else if (role === "headline" && copy.offer && !same(copy.offer, copy.headline)) maxPt = 24
  return fitText({
    text,
    rect,
    role,
    pairing,
    color,
    align: region.align,
    maxPt,
    minPt: pill ? 11 : undefined,
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
  size: LayoutSizeId
): LockupPlan {
  const rect = clampToSafe(region, size)
  const qrLabelPt = 9
  const labelH = 0.18
  const qrInches = Math.min(1.05, Math.max(0.78, Math.min(rect.h - labelH, rect.w * 0.42)))
  const qrRect = {
    x: rect.x,
    y: rect.y,
    w: qrInches,
    h: Math.min(rect.h, qrInches + labelH),
  }
  const textX = rect.x + qrInches + 0.1
  const textW = Math.max(0.7, rect.w - qrInches - 0.1)
  const onDark = lockupOnDark(input.templateId)
  const phoneFill = onDark ? palette.offerTile : palette.field
  const phoneInk = onDark ? palette.offerInk : palette.fieldInk
  const websiteColor = onDark ? palette.fieldInk : palette.ink
  const websiteBand = 0.26
  const boxH = Math.min(0.58, Math.max(0.48, rect.h - websiteBand - 0.05))
  const phoneBoxRect = { x: textX, y: qrRect.y, w: textW, h: boxH }
  const phone = copy.phone
    ? fitText({
        text: copy.phone,
        rect: {
          x: phoneBoxRect.x + 0.08,
          y: phoneBoxRect.y + 0.04,
          w: Math.max(0.4, phoneBoxRect.w - 0.16),
          h: Math.max(0.28, phoneBoxRect.h - 0.08),
        },
        role: "contact",
        pairing,
        color: phoneInk,
        minPt: 14,
        maxPt: 18,
      })
    : undefined
  const websiteTop = phoneBoxRect.y + phoneBoxRect.h + 0.05
  const website = copy.website
    ? fitText({
        text: copy.website,
        rect: {
          x: textX,
          y: websiteTop,
          w: textW,
          h: Math.max(0.22, rect.y + rect.h - websiteTop),
        },
        role: "contact",
        pairing,
        color: websiteColor,
        minPt: 11,
        maxPt: 13,
      })
    : undefined
  const qrLabel = qrScanLabel(input.spec.callToAction, input.qrPayload ?? copy.qr)
  return {
    rect,
    qrRect,
    qrInches,
    qrLabel,
    qrLabelPt,
    phone,
    website,
    phoneBox: copy.phone ? { rect: phoneBoxRect, fill: phoneFill } : undefined,
  }
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
  blob: string
}

function resolveCopy(input: ComposeInput): CopyBlocks {
  const offer = clean(input.spec.offer)
  const headline = clean(input.spec.headline)
  const subheadline = clean(input.spec.subheadline)
  const body = clean(input.spec.body)
  const distinctHeadline = headlineBesideOffer(offer, headline, subheadline, body)
  const blob = [offer, headline, subheadline, body, input.spec.callToAction].filter(Boolean).join(" ")
  const years = tenureYears(blob)
  const business = clean(input.businessName ?? "")
  const eyebrow =
    input.templateId === "neighbor_letter"
      ? business
        ? `A note from ${business}`
        : "A note from a neighbor"
      : input.templateId === "deadline_coupon"
        ? datedLine(subheadline)
        : input.templateId === "medicare_calm" || input.templateId === "portrait_aside"
          ? business
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
    badge: years ? `${years[1]} years` : "",
    before: "Before",
    after: "After",
    qr: clean(input.qrPayload ?? input.spec.qrDestination ?? input.spec.website ?? ""),
    blob,
  }
}

/**
 * Trust chips repeat a claim the copy already makes.
 * They never add a rating, a seal, or a badge the copy did not state.
 */
export function trustChipsForCopy(blob: string): Array<{ id: string; label: string }> {
  const chips: Array<{ id: string; label: string }> = []
  const years = tenureYears(blob)
  if (years) chips.push({ id: "years", label: `${years} years` })
  if (/\blicen[sc]ed\b/i.test(blob)) chips.push({ id: "licensed", label: "Licensed" })
  if (/\binsured\b/i.test(blob)) chips.push({ id: "insured", label: "Insured" })
  if (/\bwarranty\b/i.test(blob)) chips.push({ id: "warranty", label: "Warranty" })
  if (/\bbbb\b/i.test(blob)) chips.push({ id: "bbb", label: "BBB" })
  if (/\b(5|five)[\s-]*stars?\b/i.test(blob)) chips.push({ id: "stars", label: "5-star" })
  else if (/\breviews\b|\breviewed\b|\brated\b/i.test(blob)) chips.push({ id: "reviews", label: "Reviews" })
  return chips.slice(0, 3)
}

function placeTrustChips(
  region: DesignRegion,
  chips: Array<{ id: string; label: string }>,
  template: PostcardTemplateId,
  palette: VerticalPalette
): TrustChipPlan[] {
  if (chips.length === 0) return []
  const onDark = trustOnDark(template)
  const fill = onDark ? palette.paper : palette.field
  const color = onDark ? palette.ink : palette.fieldInk
  const placed: TrustChipPlan[] = []
  let x = region.x
  const fontPt = 11
  const height = Math.min(region.h, 0.42)
  const y = region.y + Math.max(0, (region.h - height) / 2)
  for (const chip of chips) {
    const w = Math.min(1.9, Math.max(1.05, chip.label.length * 0.09 + 0.42))
    if (x + w > region.x + region.w + 0.02) break
    placed.push({ id: chip.id, label: chip.label, rect: { x, y, w, h: height }, fill, color, fontPt })
    x += w + 0.08
  }
  return placed
}

/**
 * A years chip is a tenure claim the business made.
 * The age of a house ("homes over 20 years old") is not a badge.
 */
function tenureYears(blob: string): string | null {
  const pattern = /\b(\d{1,3})\s*\+?\s*years?\b/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(blob))) {
    const after = blob.slice(match.index + match[0].length, match.index + match[0].length + 12)
    if (/^\s+old\b/i.test(after)) continue
    const before = blob.slice(Math.max(0, match.index - 32), match.index)
    if (/\b(?:homes?|houses?|roofs?|properties|buildings?)\b[^.]{0,24}\bover\s*$/i.test(before)) continue
    return match[1] ?? null
  }
  return null
}

function headlineBesideOffer(offer: string, headline: string, subheadline: string, body: string): string {
  const swapped = same(offer, headline) ? (same(subheadline, offer) ? "" : subheadline) : headline
  if (!offer || !swapped || !headlineRestatesOffer(offer, swapped)) return swapped
  return shortBenefit(offer, subheadline) || shortBenefit(offer, body) || benefitForOffer(offer)
}

function shortBenefit(offer: string, line: string): string {
  const words = clean(line).split(/\s+/).filter(Boolean)
  if (words.length < 3 || words.length > 8) return ""
  if (same(offer, line) || headlineRestatesOffer(offer, line)) return ""
  return clean(line)
}

function benefitForOffer(offer: string): string {
  if (/\broof/i.test(offer)) return "Know what the roof needs"
  if (/\b(plumb|drain|leak)\b/i.test(offer)) return "See where the water goes"
  if (/\b(hvac|tune-?up|furnace)\b/i.test(offer)) return "Know the system is ready"
  return "See what needs attention"
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
    template === "storm_alert" ||
    template === "local_pride"
  )
}

function trustOnDark(template: PostcardTemplateId): boolean {
  return (
    template === "hero_scrim" ||
    template === "color_block" ||
    template === "offer_starburst" ||
    template === "storm_alert" ||
    template === "local_pride"
  )
}

function shapeFill(role: string, palette: VerticalPalette, template?: PostcardTemplateId): string {
  if (role === "field" || role === "band" || role === "scrim") return palette.field
  if (role === "offer-tile" || role === "coupon") return palette.offerTile
  if (role === "chip") return template === "before_after" ? palette.field : palette.paper
  if (role === "badge") return palette.accent
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
  if ((id === "before-label" || id === "after-label") && template === "before_after") return palette.fieldInk
  if (role === "label") return palette.ink
  if (role === "offer") return palette.offerInk
  if (role === "eyebrow" || role === "proof") return darkType(template) ? palette.fieldInk : palette.ink
  if (darkType(template) && (role === "headline" || role === "body")) return palette.fieldInk
  return palette.ink
}

function darkType(template: PostcardTemplateId): boolean {
  return (
    template === "hero_scrim" ||
    template === "color_block" ||
    template === "offer_starburst" ||
    template === "storm_alert" ||
    template === "local_pride"
  )
}

function contrastSafe(preferred: string, background: string, fallback: string): string {
  return preferred === fallback ? preferred : preferred || fallback
}

export function backMessageRect(size: LayoutSizeId, disclaimer: boolean): InchRect {
  if (isEddmSize(size)) {
    const message = eddmMessageRect(eddmTrim(size))
    const bottom = disclaimer ? 0.4 : 0
    return {
      x: message.xInches,
      y: message.yInches,
      w: message.widthInches,
      h: Math.max(0.8, message.heightInches - bottom),
    }
  }
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

export function geometryFor(size: LayoutSizeId): PostcardGeometry {
  if (size === "6x9") return buildPostcard6x9PrintSpec()
  if (isEddmSize(size)) return buildEddmPrintSpec(size)
  return buildPostcard5x8PrintSpec()
}

export function trimKeepOuts(size: LayoutSizeId): Array<InchRect & { id: string }> {
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

export function contentTrimRect(size: LayoutSizeId): InchRect {
  if (isEddmSize(size)) {
    const message = eddmMessageRect(eddmTrim(size))
    return { x: message.xInches, y: message.yInches, w: message.widthInches, h: message.heightInches }
  }
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

export function safeTrimRect(size: LayoutSizeId): InchRect {
  const trim = trimInches(size)
  return { x: 0.25, y: 0.25, w: trim.w - 0.5, h: trim.h - 0.5 }
}

export function showsReviewStars(spec: ComposeInput["spec"]): boolean {
  const blob = [spec.headline, spec.subheadline, spec.body, spec.offer].filter(Boolean).join(" ")
  return /\b(5|five)[\s-]*stars?\b/i.test(blob)
}
