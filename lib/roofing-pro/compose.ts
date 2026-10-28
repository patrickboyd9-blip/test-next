import { compliantLine } from "@/lib/research-library/compliance"
import { composeAddressSideFace } from "@/lib/campaign-creator/address-side-layout"
import { qrScanLabel } from "@/components/campaign-creator/studio/design-rules"
import type { CreativeSpec } from "@/lib/campaign-creator/types"
import type { LockupPlan, PhotoSlotPlan, PostcardFacePlan, ShapePlan, TrustChipPlan } from "@/lib/postcard-layouts/compose"
import type { PostcardSizeId } from "@/lib/postcard-layouts/ids"
import { contrastRatio, paletteById, type VerticalPalette } from "@/lib/postcard-layouts/palette"
import { scaleRect, trimInches } from "@/lib/postcard-layouts/templates"
import { fitText, type FittedText, type InchRect, type TextRole } from "@/lib/postcard-layouts/typefit"
import { addressSideContentRect } from "@/lib/print-spec/address-side-content"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"
import { personFocal, sceneFocal } from "@/lib/design-intelligence/subject-crop"
import { displayWebsite } from "@/lib/campaign-creator/studio-contact"

import { limitChars, ROOFING_COPY_LIMITS, statedExpiryLine, statedLicense } from "./copy"
import { ROOFING_PRO_META, type RoofingProTemplateId } from "./ids"
import { proFrontRegions, type ProRegion } from "./layouts"

export interface RoofingProCard {
  front: PostcardFacePlan
  back: PostcardFacePlan
  typePt: { offer: number; headline: number; support: number; phone: number }
  photoAreaPct: number
  calmFieldPct: number
  panel: InchRect
}

export interface RoofingProInput {
  templateId: RoofingProTemplateId
  size?: PostcardSizeId
  face?: "front" | "back"
  spec: Pick<
    CreativeSpec,
    "headline" | "subheadline" | "body" | "offer" | "callToAction" | "phone" | "website" | "qrDestination" | "addressSide"
  >
  businessName?: string
  qrPayload?: string | null
  license?: string | null
  disclaimerText?: string | null
  complianceMark?: string | null
  /** Return lines for the message column. The mailing panel stays blank. */
  returnAddress?: string | null
}

const DARK_TYPE = new Set<RoofingProTemplateId>(["roof_full_bleed", "roof_storm", "roof_seasonal"])

export function composeRoofingProCard(input: RoofingProInput): RoofingProCard {
  const front = composeRoofingProFace({ ...input, face: "front" })
  const back = composeRoofingProFace({ ...input, face: "back" })
  const trim = trimInches(front.size)
  const area = trim.w * trim.h
  const photoArea = front.photos.reduce((sum, slot) => sum + slot.rect.w * slot.rect.h, 0)
  const flat = front.shapes
    .filter((shape) => shape.role === "paper" || shape.role === "field" || shape.role === "solid-scrim")
    .reduce((sum, shape) => sum + shape.rect.w * shape.rect.h, 0)
  const offer = front.texts.find((text) => text.role === "offer")
  const headline = front.texts.find((text) => text.role === "headline")
  const body = front.texts.find((text) => text.role === "body")
  return {
    front,
    back,
    typePt: {
      offer: offer?.fontPt ?? 0,
      headline: headline?.fontPt ?? 0,
      support: body?.fontPt ?? 0,
      phone: front.lockup?.phone?.fontPt ?? 0,
    },
    photoAreaPct: Math.round((photoArea / area) * 1000) / 10,
    calmFieldPct: Math.round((Math.min(flat, area) / area) * 1000) / 10,
    panel: headline?.rect ?? offer?.rect ?? { x: 0.32, y: 0.32, w: 2, h: 0.5 },
  }
}

export function composeRoofingProFace(input: RoofingProInput): PostcardFacePlan {
  const size = input.size ?? "5x8"
  const face = input.face ?? "front"
  const meta = ROOFING_PRO_META[input.templateId]
  const palette = paletteFor(input.templateId)
  if (face === "back") return composeBack(input, size, meta.pairing, palette)
  return composeFront(input, size, meta.pairing, palette, meta.offerLed)
}

function composeFront(
  input: RoofingProInput,
  size: PostcardSizeId,
  pairing: PostcardFacePlan["pairing"],
  palette: VerticalPalette,
  offerLed: boolean
): PostcardFacePlan {
  const trim = trimInches(size)
  const regions = proFrontRegions(input.templateId).map((region) => ({
    ...region,
    ...scaleRect(region, size),
  }))
  const copy = resolveCopy(input, offerLed)
  const onDark = DARK_TYPE.has(input.templateId)
  const texts: FittedText[] = []
  const shapes: ShapePlan[] = [
    {
      id: "ground",
      role: "paper",
      rect: { x: 0, y: 0, w: trim.w, h: trim.h },
      fill: palette.paper,
    },
  ]
  const photos: PhotoSlotPlan[] = []

  for (const region of regions) {
    if (region.kind === "photo") {
      photos.push({
        id: region.id,
        role: region.role,
        rect: rectOf(region),
        bleed: Boolean(region.bleed),
        treatment: "cover",
        focal: region.subject === "person" ? personFocal() : sceneFocal(),
      })
      continue
    }
    if (region.kind === "shape") {
      if (region.role === "offer-tile" && !copy.offer) continue
      shapes.push({
        id: region.id,
        role: region.role,
        rect: rectOf(region),
        fill: fillFor(region.fill, palette),
      })
      continue
    }
    if (region.kind === "text") {
      const fitted = fitRegion(region, copy, pairing, palette, onDark, offerLed)
      if (fitted && fitted.lines.length > 0) texts.push(fitted)
    }
  }

  const lockupRegion = regions.find((region) => region.kind === "lockup")
  const lockup = lockupRegion
    ? placeLockup(input.templateId, lockupRegion, copy, pairing, palette, onDark, input, texts)
    : null
  if (lockup?.extras) texts.push(...lockup.extras)
  enforceHierarchy(texts, offerLed)
  const visible = texts.filter((text) => text.lines.length > 0 && text.text.trim().length > 0)
  const overflows = visible.some((text) => text.overflows) || Boolean(lockup?.plan.phone?.overflows) || Boolean(lockup?.plan.website?.overflows)
  const missingContact: string[] = []
  if (!lockup?.plan.phone?.text) missingContact.push("phone")
  if (!lockup?.plan.website?.text) missingContact.push("website")
  if (!lockup?.plan.qrLabel) missingContact.push("qr")

  return {
    templateId: input.templateId,
    size,
    face: "front",
    pairing,
    palette,
    photos,
    shapes,
    texts: visible,
    trust: [] as TrustChipPlan[],
    lockup: lockup?.plan ?? null,
    overflows,
    missingContact,
  }
}

function composeBackRaw(
  input: RoofingProInput,
  size: PostcardSizeId,
  pairing: PostcardFacePlan["pairing"],
  palette: VerticalPalette
): PostcardFacePlan {
  if (input.spec.addressSide) {
    return composeAddressSideFace({
      size,
      pairing,
      palette,
      spec: input.spec,
      businessName: input.businessName,
      phone: input.spec.phone,
      website: input.spec.website,
      license: input.license ?? undefined,
      returnAddress: input.returnAddress ?? undefined,
      qrDestination: input.qrPayload ?? input.spec.qrDestination,
      disclaimer: input.disclaimerText,
      complianceMark: input.complianceMark,
      templateId: input.templateId,
    })
  }
  const box = contentBox(size)
  const trim = trimInches(size)
  const copy = resolveCopy(input, ROOFING_PRO_META[input.templateId].offerLed)
  const pad = 0.08
  let inner: InchRect = {
    x: box.x + pad,
    y: box.y + pad,
    w: Math.max(1, box.w - pad * 2),
    h: Math.max(1, box.h - pad * 2),
  }
  const texts: FittedText[] = []
  const shapes: ShapePlan[] = [
    { id: "back-paper", role: "paper", rect: { x: 0, y: 0, w: trim.w, h: trim.h }, fill: palette.paper },
    { id: "back-rule", role: "rule", rect: { x: inner.x, y: inner.y, w: 0.06, h: inner.h }, fill: palette.ink },
  ]
  const mark = input.complianceMark?.trim()
  if (mark) {
    const fitted = fitBounded({
      text: mark,
      rect: { x: inner.x + 0.16, y: inner.y, w: inner.w - 0.16, h: 0.26 },
      role: "label",
      pairing,
      color: palette.ink,
      maxChars: 48,
      minPt: 8,
      maxPt: 9,
    })
    if (fitted.lines.length > 0) texts.push(fitted)
    inner = { ...inner, y: inner.y + 0.32, h: inner.h - 0.32 }
  }
  const disclaimer = input.disclaimerText?.trim()
  if (disclaimer) {
    const band = Math.min(0.85, inner.h * 0.22)
    const fitted = fitBounded({
      text: disclaimer,
      rect: { x: inner.x + 0.16, y: inner.y + inner.h - band, w: inner.w - 0.16, h: band },
      role: "label",
      pairing,
      color: palette.ink,
      maxChars: 220,
      minPt: 8,
      maxPt: 9,
    })
    if (fitted.lines.length > 0) texts.push(fitted)
    inner = { ...inner, h: inner.h - band - 0.06 }
  }

  const benefits =
    input.templateId === "roof_seasonal" ? clauses(copy.body) : []
  const rows: Array<{ role: TextRole; text: string; weight: number; maxPt: number; minPt: number; maxChars: number }> = [
    { role: "eyebrow", text: copy.business, weight: 0.7, maxPt: 12, minPt: 9, maxChars: ROOFING_COPY_LIMITS.business },
    { role: "headline", text: copy.headline, weight: 1.3, maxPt: 20, minPt: 13, maxChars: ROOFING_COPY_LIMITS.headline },
  ]
  if (benefits.length >= 2) {
    rows.push({ role: "body", text: "", weight: 1.6, maxPt: 11, minPt: 9, maxChars: 48 })
  } else if (copy.body) {
    rows.push({ role: "body", text: copy.body, weight: 1.5, maxPt: 12, minPt: 10, maxChars: ROOFING_COPY_LIMITS.body })
  }
  if (copy.offer) rows.push({ role: "offer", text: copy.offer, weight: 0.9, maxPt: 16, minPt: 12, maxChars: ROOFING_COPY_LIMITS.offer })
  if (copy.expiry) rows.push({ role: "label", text: copy.expiry, weight: 0.55, maxPt: 11, minPt: 8, maxChars: 48 })
  if (copy.license) rows.push({ role: "label", text: copy.license, weight: 0.5, maxPt: 10, minPt: 8, maxChars: ROOFING_COPY_LIMITS.license })
  if (copy.phone) rows.push({ role: "contact", text: copy.phone, weight: 0.7, maxPt: 14, minPt: 11, maxChars: 22 })

  const weight = rows.reduce((sum, row) => sum + row.weight, 0)
  const gap = 0.06
  const usable = inner.h - gap * Math.max(rows.length - 1, 0)
  let cursor = inner.y
  const textX = inner.x + 0.16
  const textW = Math.max(0.8, inner.w - 0.16)
  for (const row of rows) {
    const h = Math.max(0.22, (usable * row.weight) / weight)
    const rect = { x: textX, y: cursor, w: textW, h }
    cursor += h + gap
    if (row.role === "body" && benefits.length >= 2) {
      texts.push(...placeBenefits(benefits, rect, pairing, palette))
      continue
    }
    if (!row.text) continue
    const fitted = fitBounded({
      text: row.text,
      rect,
      role: row.role,
      pairing,
      color: row.role === "offer" ? palette.accent : palette.ink,
      maxChars: row.maxChars,
      minPt: row.minPt,
      maxPt: row.maxPt,
    })
    if (fitted.lines.length > 0) texts.push(fitted)
  }
  const offer = texts.find((text) => text.role === "offer")
  if (offer && contrastRatio(palette.accent, palette.paper) < 4.5) offer.color = palette.ink

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

function placeBenefits(
  lines: string[],
  rect: InchRect,
  pairing: PostcardFacePlan["pairing"],
  palette: VerticalPalette
): FittedText[] {
  const cols = 2
  const rows = Math.ceil(lines.length / cols)
  const gap = 0.06
  const cellW = (rect.w - gap) / cols
  const cellH = (rect.h - gap * (rows - 1)) / rows
  return lines.flatMap((line, index) => {
    const fitted = fitBounded({
      text: line,
      rect: {
        x: rect.x + (index % cols) * (cellW + gap),
        y: rect.y + Math.floor(index / cols) * (cellH + gap),
        w: cellW,
        h: cellH,
      },
      role: "body",
      pairing,
      color: palette.ink,
      maxChars: 48,
      minPt: 9,
      maxPt: 12,
    })
    return fitted.lines.length > 0 ? [fitted] : []
  })
}

function clauses(body: string): string[] {
  return body
    .split(/[.;]/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length >= 8 && part.length <= 48)
    .slice(0, 4)
}

function fitRegion(
  region: ProRegion & InchRect,
  copy: Copy,
  pairing: PostcardFacePlan["pairing"],
  palette: VerticalPalette,
  onDark: boolean,
  offerLed: boolean
): FittedText | null {
  const role = region.role as TextRole
  const text =
    region.id === "before-label" ? "Before" : region.id === "after-label" ? "After" : textFor(role, copy)
  if (!text) return null
  const chip = region.id === "before-label" || region.id === "after-label"
  const color = chip ? palette.fieldInk : role === "offer" ? palette.offerInk : onDark ? palette.fieldInk : palette.ink
  const limits = role === "headline"
    ? { max: offerLed ? 18 : 36, min: offerLed ? 12 : 18, chars: ROOFING_COPY_LIMITS.headline }
    : role === "offer"
      ? {
          max: offerLed ? 42 : 18,
          min: offerLed ? 20 : 13,
          chars: offerLed ? ROOFING_COPY_LIMITS.offerLed : ROOFING_COPY_LIMITS.offer,
        }
      : role === "body"
        ? { max: 13, min: 10, chars: ROOFING_COPY_LIMITS.body }
        : { max: 11, min: 9, chars: 16 }
  return fitBounded({
    text,
    rect: { x: region.x, y: region.y, w: region.w, h: region.h },
    role,
    pairing,
    color,
    align: region.align,
    maxChars: limits.chars,
    minPt: limits.min,
    maxPt: limits.max,
  })
}

function placeLockup(
  template: RoofingProTemplateId,
  region: ProRegion & InchRect,
  copy: Copy,
  pairing: PostcardFacePlan["pairing"],
  palette: VerticalPalette,
  onDark: boolean,
  input: RoofingProInput,
  texts: FittedText[]
): { plan: LockupPlan; extras: FittedText[] } {
  const ink = onDark ? palette.fieldInk : palette.ink
  const qrLabel = qrScanLabel(input.spec.callToAction, copy.qr)
  if (template === "roof_coupon") return placeCouponLockup(region, copy, pairing, ink, qrLabel, texts)
  const qrIn = Math.min(0.86, Math.max(0.78, Math.min(region.h - 0.18, region.w * 0.38)))
  const labelH = 0.16
  const qrRect = {
    x: region.x,
    y: region.y + Math.max(0, (region.h - (qrIn + labelH)) / 2),
    w: qrIn,
    h: qrIn + labelH,
  }
  const textX = region.x + qrIn + 0.1
  const textW = Math.max(0.6, region.w - qrIn - 0.1)
  const lines: Array<{ role: TextRole; text: string; h: number; min: number; max: number; chars: number }> = []
  if (copy.business) lines.push({ role: "eyebrow", text: copy.business, h: 0.2, min: 9, max: 12, chars: ROOFING_COPY_LIMITS.business })
  if (copy.phone) lines.push({ role: "contact", text: copy.phone, h: 0.3, min: 13, max: 18, chars: 22 })
  if (copy.website) lines.push({ role: "contact", text: copy.website, h: 0.22, min: 10, max: 13, chars: ROOFING_COPY_LIMITS.url })
  if (copy.license) lines.push({ role: "label", text: copy.license, h: 0.18, min: 8, max: 10, chars: ROOFING_COPY_LIMITS.license })
  const extras: FittedText[] = []
  let phone: FittedText | undefined
  let website: FittedText | undefined
  const total = lines.reduce((sum, line) => sum + line.h, 0)
  let y = region.y + Math.max(0, (region.h - total) / 2)
  for (const line of lines) {
    const fitted = fitBounded({
      text: line.text,
      rect: { x: textX, y, w: textW, h: line.h },
      role: line.role,
      pairing,
      color: ink,
      maxChars: line.chars,
      minPt: line.min,
      maxPt: line.max,
    })
    y += line.h
    if (fitted.lines.length === 0) continue
    if (line.role === "contact" && line.text === copy.phone) phone = fitted
    else if (line.role === "contact") website = fitted
    else extras.push(fitted)
  }
  return {
    extras,
    plan: {
      rect: rectOf(region),
      qrRect,
      qrInches: qrIn,
      qrLabel,
      qrLabelPt: 9,
      phone,
      website,
    },
  }
}

function placeCouponLockup(
  region: ProRegion & InchRect,
  copy: Copy,
  pairing: PostcardFacePlan["pairing"],
  ink: string,
  qrLabel: string,
  texts: FittedText[]
): { plan: LockupPlan; extras: FittedText[] } {
  const qrIn = 0.8
  const qrRect = {
    x: region.x + region.w - qrIn,
    y: region.y,
    w: qrIn,
    h: qrIn + 0.16,
  }
  const headline = texts.find((text) => text.role === "headline")
  const offer = texts.find((text) => text.role === "offer")
  const floor = Math.max(headline ? headline.rect.y + headline.rect.h + 0.06 : region.y, offer ? offer.rect.y + offer.rect.h + 0.08 : region.y)
  const top = Math.min(floor, region.y + region.h - 0.46)
  const rowH = Math.min(0.28, region.y + region.h - top)
  const half = (region.w - 0.12) / 2
  const extras: FittedText[] = []
  const business = copy.business
    ? fitBounded({
        text: copy.business,
        rect: { x: region.x, y: top, w: half, h: rowH },
        role: "eyebrow",
        pairing,
        color: ink,
        maxChars: ROOFING_COPY_LIMITS.business,
        minPt: 9,
        maxPt: 12,
      })
    : undefined
  const phone = copy.phone
    ? fitBounded({
        text: copy.phone,
        rect: { x: region.x + half + 0.12, y: top, w: half, h: rowH },
        role: "contact",
        pairing,
        color: ink,
        maxChars: 22,
        minPt: 12,
        maxPt: 16,
      })
    : undefined
  const website = copy.website
    ? fitBounded({
        text: copy.website,
        rect: { x: region.x, y: top + rowH, w: half, h: Math.max(0.18, region.y + region.h - (top + rowH)) },
        role: "contact",
        pairing,
        color: ink,
        maxChars: ROOFING_COPY_LIMITS.url,
        minPt: 10,
        maxPt: 12,
      })
    : undefined
  const license = copy.license
    ? fitBounded({
        text: copy.license,
        rect: {
          x: region.x + half + 0.12,
          y: top + rowH,
          w: half,
          h: Math.max(0.18, region.y + region.h - (top + rowH)),
        },
        role: "label",
        pairing,
        color: ink,
        maxChars: ROOFING_COPY_LIMITS.license,
        minPt: 8,
        maxPt: 10,
      })
    : undefined
  if (business && business.lines.length > 0) extras.push(business)
  if (license && license.lines.length > 0) extras.push(license)
  return {
    extras,
    plan: {
      rect: rectOf(region),
      qrRect,
      qrInches: qrIn,
      qrLabel,
      qrLabelPt: 9,
      phone: phone && phone.lines.length > 0 ? phone : undefined,
      website: website && website.lines.length > 0 ? website : undefined,
    },
  }
}

function enforceHierarchy(texts: FittedText[], offerLed: boolean): void {
  const offer = texts.find((text) => text.role === "offer")
  const headline = texts.find((text) => text.role === "headline")
  const body = texts.find((text) => text.role === "body")
  if (offer && headline) {
    if (offerLed && offer.fontPt <= headline.fontPt) headline.fontPt = Math.max(11, offer.fontPt - 4)
    if (!offerLed && headline.fontPt <= offer.fontPt) offer.fontPt = Math.max(12, headline.fontPt - 2)
  }
  if (headline && body && body.lines.length > 0 && body.fontPt * 2.5 > headline.fontPt + 0.01) {
    const cap = headline.fontPt / 2.5
    if (cap < 9) {
      body.lines = []
      body.text = ""
    } else {
      body.fontPt = Math.floor(cap * 2) / 2
    }
  }
}

interface Copy {
  offer: string
  headline: string
  body: string
  business: string
  phone: string
  website: string
  license: string
  expiry: string
  qr: string
}

function resolveCopy(input: RoofingProInput, offerLed: boolean): Copy {
  const offer = clean(input.spec.offer)
  const headline = clean(input.spec.headline)
  const sub = clean(input.spec.subheadline)
  const body = clean(input.spec.body)
  const blob = [offer, headline, sub, body, input.businessName, input.license].filter(Boolean).join(" ")
  let nextHeadline = headline
  if (offer && same(offer, headline)) nextHeadline = sub && !same(sub, offer) ? sub : offerLed ? "" : headline
  let nextOffer = offer
  if (!offerLed && nextHeadline && same(nextHeadline, offer)) nextOffer = ""
  const expiry = statedExpiryLine([offer, sub, body].filter(Boolean).join(" "))
  return {
    offer: nextOffer.replace(/\s+/g, " ").trim(),
    headline: limitChars(nextHeadline, ROOFING_COPY_LIMITS.headline),
    body: same(body, nextHeadline) || same(body, nextOffer) ? "" : limitChars(body, ROOFING_COPY_LIMITS.body),
    business: limitChars(clean(input.businessName), ROOFING_COPY_LIMITS.business),
    phone: clean(input.spec.phone),
    website: limitChars(displayWebsite(input.spec.website ?? ""), ROOFING_COPY_LIMITS.url),
    license: statedLicense(input.license ?? undefined, blob),
    expiry: expiry ?? "",
    qr: clean(input.qrPayload ?? input.spec.qrDestination ?? input.spec.website ?? ""),
  }
}

function textFor(role: TextRole, copy: Copy): string {
  if (role === "offer") return copy.offer
  if (role === "headline") return copy.headline
  if (role === "body") return copy.body
  return ""
}

function fitBounded(input: {
  text: string
  rect: InchRect
  role: TextRole
  pairing: PostcardFacePlan["pairing"]
  color: string
  align?: "left" | "center"
  maxChars: number
  minPt?: number
  maxPt?: number
}): FittedText {
  const text = limitChars(input.text, input.maxChars)
  const minPt = input.minPt
  const empty = fitText({
    text: "",
    rect: input.rect,
    role: input.role,
    pairing: input.pairing,
    color: input.color,
    align: input.align,
    minPt,
    maxPt: input.maxPt,
  })
  if (!text) return empty
  // Never drop words. Step the floor down until the whole text fits.
  // If it still overflows at the smallest size, the painter shrinks it to fit.
  const floors = [minPt, 10, 9, 8, 7].filter((value, index, all): value is number =>
    typeof value === "number" && all.indexOf(value) === index && (minPt === undefined || value <= minPt))
  let last: FittedText = empty
  for (const floor of floors.length > 0 ? floors : [8, 7]) {
    const fitted = fitText({
      text,
      rect: input.rect,
      role: input.role,
      pairing: input.pairing,
      color: input.color,
      align: input.align,
      minPt: floor,
      maxPt: input.maxPt,
    })
    last = fitted
    if (!fitted.overflows && fitted.lines.length > 0) return fitted
  }
  return last
}

function paletteFor(id: RoofingProTemplateId): VerticalPalette {
  const base = paletteById("roofing")
  if (id === "roof_seasonal") {
    return {
      ...base,
      field: "#143028",
      fieldInk: "#f4f7f2",
      accent: "#d6e34a",
      accentInk: "#14200a",
      offerTile: "#d6e34a",
      offerInk: "#14200a",
      scrim: "#10241c",
    }
  }
  if (id === "roof_premium") {
    // Navy, white and one warm accent. The old cream-and-black read as a bank letter.
    return {
      ...base,
      paper: "#ffffff",
      ink: "#14213d",
      field: "#14213d",
      fieldInk: "#ffffff",
      accent: "#f2b632",
      accentInk: "#14213d",
      offerTile: "#f2b632",
      offerInk: "#14213d",
      scrim: "#14213d",
    }
  }
  if (id === "roof_storm") {
    return { ...base, field: "#0e1c33", scrim: "#0e1c33" }
  }
  return base
}

function fillFor(token: ProRegion["fill"], palette: VerticalPalette): string {
  if (token === "field" || token === "scrim") return token === "scrim" ? palette.scrim : palette.field
  if (token === "offer") return palette.offerTile
  if (token === "rule") return contrastRatio(palette.accent, palette.paper) >= 3 ? palette.accent : palette.ink
  return palette.paper
}

function contentBox(size: PostcardSizeId): InchRect {
  const spec = size === "6x9" ? buildPostcard6x9PrintSpec() : buildPostcard5x8PrintSpec()
  const content = addressSideContentRect(spec)
  const bleed = spec.bleedInchesPerSide
  return {
    x: content.xInches - bleed,
    y: content.yInches - bleed,
    w: content.widthInches,
    h: content.heightInches,
  }
}

function rectOf(region: { x: number; y: number; w: number; h: number }): InchRect {
  return { x: region.x, y: region.y, w: region.w, h: region.h }
}

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function same(a: string, b: string): boolean {
  return a.length > 0 && a.trim().toLowerCase() === b.trim().toLowerCase()
}


/** The back runs through the same compliance rules as the front (financing, free, warranty wording). */
function composeBack(...args: Parameters<typeof composeBackRaw>): ReturnType<typeof composeBackRaw> {
  const face = composeBackRaw(...args)
  return { ...face, texts: face.texts.map((text) => ({ ...text, text: compliantLine(text.text) })) }
}
