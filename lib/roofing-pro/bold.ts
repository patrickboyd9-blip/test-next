/**
 * Bold column. A dark type field, a real job photo, a two-color headline,
 * and an offer bar whose figure is larger than the rest of the sentence.
 * The business name is type. No icon is drawn. A QR is drawn only when the
 * caller passes a real destination.
 */
import { qrScanLabel } from "@/components/campaign-creator/studio/design-rules"
import { displayWebsite } from "@/lib/campaign-creator/studio-contact"
import { inferPhotoSubject } from "@/lib/campaign-creator/photo-subject"
import { heroLockup } from "@/lib/design-intelligence/offer-copy"
import { focalKeepingHead, sceneFocal } from "@/lib/design-intelligence/subject-crop"
import type { LockupPlan, PhotoSlotPlan, PostcardFacePlan, ShapePlan } from "@/lib/postcard-layouts/compose"
import type { FontPairingId, PostcardSizeId } from "@/lib/postcard-layouts/ids"
import type { VerticalPalette } from "@/lib/postcard-layouts/palette"
import { scaleRect, trimInches } from "@/lib/postcard-layouts/templates"
import { fitText, type FittedText, type InchRect, type TextRole } from "@/lib/postcard-layouts/typefit"
import { addressSideContentRect } from "@/lib/print-spec/address-side-content"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"

import type { RoofingProInput } from "./compose"
import { statedLicense } from "./copy"

export function composeBoldFace(
  input: RoofingProInput,
  size: PostcardSizeId,
  face: "front" | "back",
  pairing: FontPairingId,
  palette: VerticalPalette
): PostcardFacePlan {
  return face === "back"
    ? composeBoldBack(input, size, pairing, palette)
    : composeBoldFront(input, size, pairing, palette)
}

function composeBoldFront(
  input: RoofingProInput,
  size: PostcardSizeId,
  pairing: FontPairingId,
  palette: VerticalPalette
): PostcardFacePlan {
  const trim = trimInches(size)
  const headline = clean(input.spec.headline)
  const offer = clean(input.spec.offer)
  const business = clean(input.businessName)
  const phone = clean(input.spec.phone)
  const website = displayWebsite(input.spec.website ?? "")
  const license = statedLicense(input.license ?? undefined, `${headline} ${offer} ${clean(input.spec.body)}`)
  const qrPayload = clean(input.qrPayload ?? input.spec.qrDestination ?? "")
  const [lead, rest] = splitHeadline(headline)
  const hero = offer ? heroLockup(offer) : { numeral: "", rest: "" }

  const field: ShapePlan = {
    id: "bold-field",
    role: "field",
    rect: { x: 0, y: 0, w: trim.w, h: trim.h },
    fill: palette.field,
  }
  const photoRect = at(size, { x: 3.38, y: 0, w: 4.62, h: 4.16 })
  const tile = at(size, { x: 0.22, y: 3.14, w: 7.56, h: 1.02 })
  const footer = at(size, { x: 0, y: 4.16, w: 8, h: 0.84 })
  const shapes: ShapePlan[] = [
    { id: "bold-paper", role: "paper", rect: { x: 0, y: 0, w: trim.w, h: trim.h }, fill: palette.field },
    field,
    { id: "bold-offer", role: "offer-tile", rect: tile, fill: palette.offerTile },
    { id: "bold-footer", role: "band", rect: footer, fill: palette.field },
  ]

  const texts: FittedText[] = []
  const name = fitBox({
    text: business,
    rect: at(size, { x: 0.34, y: 0.28, w: 2.96, h: 0.54 }),
    role: "eyebrow",
    pairing,
    color: palette.fieldInk,
    minPt: 11,
    maxPt: 16,
  })
  if (name.lines.length > 0) texts.push(name)
  shapes.push({
    id: "bold-name-rule",
    role: "rule",
    rect: at(size, { x: 0.34, y: 0.86, w: 0.9, h: 0.02 }),
    fill: palette.offerTile,
  })

  const leadRect = rest
    ? at(size, { x: 0.32, y: 0.94, w: 2.98, h: 1.04 })
    : at(size, { x: 0.32, y: 0.94, w: 2.98, h: 2.08 })
  const leadText = fitBox({
    text: lead,
    rect: leadRect,
    role: "headline",
    pairing,
    color: palette.fieldInk,
    minPt: 16,
    maxPt: 54,
  })
  if (leadText.lines.length > 0) texts.push(leadText)
  if (rest) {
    const restText = fitBox({
      text: rest,
      rect: at(size, { x: 0.32, y: 2.02, w: 2.98, h: 1.02 }),
      role: "headline",
      pairing,
      color: palette.offerTile,
      minPt: 14,
      maxPt: Math.max(16, leadText.fontPt - 1),
    })
    if (restText.lines.length > 0) texts.push(restText)
  }

  const figureMax = Math.max(13, leadText.fontPt - 0.5)
  const figureRect = {
    x: tile.x + 0.14,
    y: tile.y + 0.1,
    w: tile.w * 0.3,
    h: tile.h - 0.2,
  }
  const figure = fitBox({
    text: hero.numeral,
    rect: figureRect,
    role: "offer",
    pairing,
    color: palette.offerInk,
    minPt: 13,
    maxPt: figureMax,
  })
  if (figure.lines.length > 0) texts.push(figure)
  if (hero.rest) {
    const restMax = Math.max(11, Math.min(16, figure.fontPt * 0.46))
    const offerRest = fitBox({
      text: hero.rest,
      rect: {
        x: figureRect.x + figureRect.w + 0.08,
        y: tile.y + 0.18,
        w: tile.x + tile.w - (figureRect.x + figureRect.w) - 0.22,
        h: tile.h - 0.36,
      },
      role: "offer",
      pairing,
      color: palette.offerInk,
      minPt: 11,
      maxPt: restMax,
    })
    if (offerRest.lines.length > 0) texts.push(offerRest)
  }

  const foot = at(size, { x: 0.34, y: 4.28, w: 7.32, h: 0.44 })
  const columns = footerColumns(foot, license ? 3 : website ? 2 : 1)
  const phoneText = fitBox({
    text: phone,
    rect: columns[0]!,
    role: "contact",
    pairing,
    color: palette.fieldInk,
    minPt: 13,
    maxPt: 20,
  })
  const websiteText = website
    ? fitBox({
        text: website,
        rect: columns[1] ?? columns[0]!,
        role: "contact",
        pairing,
        color: palette.fieldInk,
        minPt: 10,
        maxPt: 14,
      })
    : null
  if (license) {
    const licenseText = fitBox({
      text: license,
      rect: columns[2] ?? columns[columns.length - 1]!,
      role: "label",
      pairing,
      color: palette.fieldInk,
      minPt: 9,
      maxPt: 13,
    })
    if (licenseText.lines.length > 0) texts.push(licenseText)
  }
  for (let index = 0; index < columns.length - 1; index += 1) {
    const left = columns[index]!
    shapes.push({
      id: `bold-div-${index}`,
      role: "rule",
      rect: {
        x: left.x + left.w + 0.02,
        y: foot.y + 0.06,
        w: 0.015,
        h: Math.max(0.16, foot.h - 0.12),
      },
      fill: palette.fieldInk,
    })
  }

  // Low on the photo, beside the type. These job photos keep the person toward
  // the top, and a top-right code was covering heads.
  const qrRect = at(size, { x: 3.52, y: 1.84, w: 1.0, h: 1.22 })
  const qrLabel = qrPayload ? qrScanLabel(input.spec.callToAction, qrPayload) : ""
  if (qrPayload) {
    shapes.push({ id: "bold-qr-frame", role: "frame", rect: qrRect, fill: "#ffffff" })
  }
  const lockup: LockupPlan = {
    rect: foot,
    qrRect: qrPayload ? qrRect : { x: qrRect.x, y: qrRect.y, w: 0, h: 0 },
    qrInches: qrPayload ? 0.86 : 0,
    qrLabel,
    qrLabelPt: 8,
    phone: phoneText.lines.length > 0 ? phoneText : undefined,
    website: websiteText && websiteText.lines.length > 0 ? websiteText : undefined,
  }

  const mode = input.photoSubject ?? inferPhotoSubject({ trade: input.trade, headline, offer })
  const photo: PhotoSlotPlan = {
    id: "photo",
    role: "photo",
    rect: photoRect,
    bleed: true,
    treatment: "cover",
    focal: mode === "person" ? focalKeepingHead(photoRect) : sceneFocal(),
  }
  const visible = texts.filter((text) => text.lines.length > 0 && text.text.trim().length > 0)
  const missingContact: string[] = []
  if (!lockup.phone?.text) missingContact.push("phone")
  if (qrPayload && !qrLabel) missingContact.push("qr")

  return {
    templateId: "roof_bold",
    size,
    face: "front",
    pairing,
    palette,
    photos: [photo],
    shapes,
    texts: visible,
    trust: [],
    lockup,
    overflows:
      visible.some((text) => text.overflows) ||
      Boolean(lockup.phone?.overflows) ||
      Boolean(lockup.website?.overflows),
    missingContact,
  }
}

function composeBoldBack(
  input: RoofingProInput,
  size: PostcardSizeId,
  pairing: FontPairingId,
  palette: VerticalPalette
): PostcardFacePlan {
  const trim = trimInches(size)
  const box = contentBox(size)
  const inner = inset(box, 0.12)
  const headline = clean(input.spec.headline)
  const offer = clean(input.spec.offer)
  const business = clean(input.businessName)
  const phone = clean(input.spec.phone)
  const website = displayWebsite(input.spec.website ?? "")
  const license = statedLicense(input.license ?? undefined, `${headline} ${offer} ${clean(input.spec.body)}`)
  const hero = offer ? heroLockup(offer) : { numeral: "", rest: "" }
  const gap = 0.06
  const nameH = Math.min(0.62, inner.h * 0.14)
  const phoneH = Math.min(0.42, inner.h * 0.1)
  const metaH = license || website ? Math.min(0.55, inner.h * 0.12) : 0
  const offerH = Math.min(1.05, inner.h * 0.22)
  const headH = Math.max(0.7, inner.h - nameH - phoneH - metaH - offerH - gap * 4)

  const shapes: ShapePlan[] = [
    { id: "back-paper", role: "paper", rect: { x: 0, y: 0, w: trim.w, h: trim.h }, fill: palette.paper },
    { id: "back-field", role: "field", rect: box, fill: palette.field },
  ]
  const texts: FittedText[] = []
  let y = inner.y
  const name = fitBox({
    text: business,
    rect: { x: inner.x, y, w: inner.w, h: nameH },
    role: "eyebrow",
    pairing,
    color: palette.fieldInk,
    minPt: 10,
    maxPt: 16,
  })
  if (name.lines.length > 0) texts.push(name)
  y += nameH + gap
  const head = fitBox({
    text: headline,
    rect: { x: inner.x, y, w: inner.w, h: headH },
    role: "headline",
    pairing,
    color: palette.fieldInk,
    minPt: 16,
    maxPt: 40,
  })
  if (head.lines.length > 0) texts.push(head)
  y += headH + gap
  const tile: InchRect = { x: inner.x, y, w: inner.w, h: offerH }
  shapes.push({ id: "back-offer", role: "offer-tile", rect: tile, fill: palette.offerTile })
  const figureRect = { x: tile.x + 0.1, y: tile.y + 0.08, w: tile.w * 0.34, h: tile.h - 0.16 }
  const figure = fitBox({
    text: hero.numeral,
    rect: figureRect,
    role: "offer",
    pairing,
    color: palette.offerInk,
    minPt: 14,
    maxPt: 36,
  })
  if (figure.lines.length > 0) texts.push(figure)
  if (hero.rest) {
    const offerRest = fitBox({
      text: hero.rest,
      rect: {
        x: figureRect.x + figureRect.w + 0.06,
        y: tile.y + 0.12,
        w: tile.x + tile.w - figureRect.x - figureRect.w - 0.18,
        h: tile.h - 0.24,
      },
      role: "offer",
      pairing,
      color: palette.offerInk,
      minPt: 11,
      maxPt: Math.max(11, Math.min(15, figure.fontPt * 0.5)),
    })
    if (offerRest.lines.length > 0) texts.push(offerRest)
  }
  y += offerH + gap
  const phoneText = fitBox({
    text: phone,
    rect: { x: inner.x, y, w: inner.w, h: phoneH },
    role: "contact",
    pairing,
    color: palette.fieldInk,
    minPt: 12,
    maxPt: 20,
  })
  if (phoneText.lines.length > 0) texts.push(phoneText)
  y += phoneH + gap
  const meta = [website, license].filter(Boolean).join("   ·   ")
  if (meta) {
    const metaText = fitBox({
      text: meta,
      rect: { x: inner.x, y, w: inner.w, h: Math.max(0.28, inner.y + inner.h - y) },
      role: "label",
      pairing,
      color: palette.fieldInk,
      minPt: 9,
      maxPt: 12,
    })
    if (metaText.lines.length > 0) texts.push(metaText)
  }

  const visible = texts.filter((text) => text.lines.length > 0 && text.text.trim().length > 0)
  return {
    templateId: "roof_bold",
    size,
    face: "back",
    pairing,
    palette,
    photos: [],
    shapes,
    texts: visible,
    trust: [],
    lockup: null,
    overflows: visible.some((text) => text.overflows),
    missingContact: [],
  }
}

function footerColumns(foot: InchRect, count: number): InchRect[] {
  const gap = Math.min(0.1, foot.w * 0.02)
  const width = (foot.w - gap * (count - 1)) / count
  return Array.from({ length: count }, (_, index) => ({
    x: foot.x + index * (width + gap),
    y: foot.y,
    w: width,
    h: foot.h,
  }))
}

function at(size: PostcardSizeId, rect: InchRect): InchRect {
  return scaleRect(rect, size)
}

function fitBox(input: {
  text: string
  rect: InchRect
  role: TextRole
  pairing: FontPairingId
  color: string
  minPt: number
  maxPt: number
}): FittedText {
  const floors = [input.minPt, 12, 11, 10, 9, 8, 7].filter(
    (value, index, all) => all.indexOf(value) === index && value <= input.minPt
  )
  let last = fitText({ ...input, minPt: floors[0] ?? input.minPt, maxPt: Math.max(input.maxPt, floors[0] ?? input.minPt) })
  for (const floor of floors) {
    const fitted = fitText({ ...input, minPt: floor, maxPt: Math.max(input.maxPt, floor) })
    last = fitted
    if (!fitted.overflows && fitted.lines.length > 0) return fitted
  }
  return last
}

function splitHeadline(headline: string): [string, string] {
  const marked = headline.match(/^(.*?[?])\s+(\S.*)$/)
  if (marked?.[1] && marked[2]) return [marked[1].trim(), marked[2].trim()]
  const sentence = headline.match(/^(.*?[.!])\s+(\S.*)$/)
  if (sentence?.[1] && sentence[2]) return [sentence[1].trim(), sentence[2].trim()]
  const words = headline.split(/\s+/).filter(Boolean)
  if (words.length < 4) return [headline, ""]
  const cut = Math.ceil(words.length / 2)
  return [words.slice(0, cut).join(" "), words.slice(cut).join(" ")]
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

function inset(rect: InchRect, pad: number): InchRect {
  return { x: rect.x + pad, y: rect.y + pad, w: Math.max(0.4, rect.w - pad * 2), h: Math.max(0.4, rect.h - pad * 2) }
}

function clean(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}
