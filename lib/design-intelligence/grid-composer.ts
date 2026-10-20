import type { CreativeSpec } from "@/lib/campaign-creator/types"
import type { PostcardFacePlan, PhotoSlotPlan, ShapePlan } from "@/lib/postcard-layouts/compose"
import type { FontPairingId, PostcardTemplateId, VerticalPaletteId } from "@/lib/postcard-layouts/ids"
import type { VerticalPalette } from "@/lib/postcard-layouts/palette"
import { fitText, PAIRING_MEASURE, type FittedText, type InchRect } from "@/lib/postcard-layouts/typefit"
import { addressSideContentRect } from "@/lib/print-spec/address-side-content"
import {
  buildPostcard5x8PrintSpec,
  type InchesRect,
  type PostcardGeometry,
} from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"

import type { CompositionMode } from "./art-director"
import { resolveFrontCopy } from "./offer-copy"
import { contrastRatio, inkForBackground, isLight, relativeLuminance } from "./contrast"
import type { DesignRationale, DesignVertical, TrimSize, TypeSeat } from "./rationale"

/**
 * Places the front (and the address-side proof) on a real grid from a
 * Design Rationale. Templates are not the layout. Safe type stays 0.25 in
 * inside the trim. The phone, the website, a QR, and the words "Scan to book"
 * are on every front.
 */

export const SCAN_LABEL = "Scan to book"
export const URL_MIN_PT = 10
const SAFE_IN = 0.25
const QR_IN = 0.8

export interface GridComposeInput {
  rationale: DesignRationale
  spec: Pick<CreativeSpec, "headline" | "subheadline" | "body" | "offer" | "callToAction" | "phone" | "website" | "qrDestination">
  businessName?: string
  disclaimer?: string | null
}

export interface GridCard {
  front: PostcardFacePlan
  back: PostcardFacePlan
  /** Points actually used, after fitting. The critic reads these. */
  typePt: { offer: number; headline: number; support: number; phone: number }
  photoAreaPct: number
  calmFieldPct: number
  panel: InchRect
}

export function composeGridCard(input: GridComposeInput): GridCard {
  const trim = trimInches(input.rationale.format.trim)
  const pairing: FontPairingId = input.rationale.font_pairing
    ?? (input.rationale.vertical === "medicare_insurance" ? "letter" : "trade")
  const palette = paletteFromRationale(input.rationale)
  const mode = compositionMode(input.rationale)
  if (mode === "integrated") return composeIntegrated(input, trim, pairing, palette)
  const seat = mode === "full-bleed" ? input.rationale.type_seat : undefined
  const regions = panelLayout(mode, trim, seat)
  const paper = isLight(palette.paper) ? palette.paper : "#F4F1EA"
  const darkField = mode === "dark-offer-field"
  const onPhotograph = mode === "full-bleed"
  const panelFill = darkField ? palette.field : paper
  const typeBackdrop = onPhotograph ? (seat?.ink === "dark" ? "#F4F1EA" : "#141414") : panelFill
  const ink = inkForBackground(typeBackdrop)
  const accent = input.rationale.palette.accent_hex
  const responseOnPhoto = mode === "type-led"
  const responseFill = "#1A1A1A"
  const content = clampRect(inset(regions.panel, responseOnPhoto ? 0.1 : 0.16), trim)
  const responseBand = responseOnPhoto ? photoResponseBand(regions.photo) : null
  const responseContent = responseBand ? clampRect(inset(responseBand, 0.06), trim) : content
  const responseInk = responseBand ? inkForBackground(responseFill) : ink
  const spoken = spokenCopy(input)
  const offerIsHero = leadsWithOffer(input.rationale.scale_ratios.hero, spoken.numeral)
  const headline = spoken.headline
  const offerParts = offerIsHero
    ? { numeral: spoken.numeral, rest: spoken.rest }
    : { numeral: [spoken.numeral, spoken.rest].filter(Boolean).join(" "), rest: "" }
  const trust = trustLine(input)
  const phone = clean(input.spec.phone) || ""
  const website = displayHost(input.spec.website || input.spec.qrDestination || "")
  const response = placeResponse({
    content: responseContent,
    phone,
    website,
    pairing,
    ink: responseInk,
    urlMin: onPhotograph ? 12 : URL_MIN_PT,
  })
  const stackRoom = responseBand ? content.h : response.stackRoom
  const sizes = typeSizes(input.rationale, stackRoom, offerIsHero ? "offer" : "headline")
  const offerContrastFloor = onPhotograph ? 7 : 4.5
  const offerColor = offerIsHero && contrastRatio(accent, typeBackdrop) >= offerContrastFloor ? accent : ink
  const bodyFloor = input.rationale.format.trim === "6x9" ? 12 : 11
  const smallFloor = onPhotograph ? 12 : bodyFloor
  const headlineFloor = bodyFloor * 2.5
  const offerFloor = offerIsHero ? headlineFloor * 1.6 : bodyFloor * 1.5
  const protectOffer = Boolean(input.rationale.refine?.minOfferPt)
  const blocks: StackBlock[] = []
  if (offerIsHero) {
    blocks.push({ text: offerParts.numeral, role: "offer", pt: sizes.offer, floor: offerFloor, color: offerColor, protect: protectOffer })
    if (offerParts.rest) blocks.push({ text: offerParts.rest, role: "body", pt: sizes.support, floor: smallFloor, color: ink })
    blocks.push({ text: headline, role: "headline", pt: sizes.headline, floor: headlineFloor, color: ink })
  } else {
    blocks.push({ text: headline, role: "headline", pt: sizes.headline, floor: headlineFloor, color: ink })
    blocks.push({ text: offerParts.numeral, role: "offer", pt: sizes.offer, floor: offerFloor, color: offerColor, protect: protectOffer })
  }
  if (trust) blocks.push({ text: trust, role: "proof", pt: Math.min(sizes.support, 13), floor: smallFloor, color: ink })
  const stacked = placeStack({
    blocks,
    cursor: content.y,
    bottom: responseBand ? content.y + content.h : response.stackBottom,
    content,
    pairing,
    align: input.rationale.grid.alignment,
  })
  const texts = stacked.texts
  const qrRect = response.qrRect
  const phoneText = response.phone
  const websiteText = response.website

  const photos: PhotoSlotPlan[] = input.rationale.photo_brief.placement === "none"
    ? []
    : [{ id: "photo", role: "photo", rect: regions.photo, bleed: true, treatment: "cover" }]

  const offerText = texts.find((text) => text.role === "offer")
  const shapes: ShapePlan[] = [
    { id: "paper", role: "paper", rect: { x: 0, y: 0, w: trim.w, h: trim.h }, fill: darkField ? palette.field : palette.paper },
  ]
  if (!onPhotograph) {
    shapes.push({ id: "panel", role: "type-panel", rect: regions.panel, fill: panelFill })
  }
  if (responseBand) {
    shapes.push({ id: "response-band", role: "band", rect: responseBand, fill: responseFill })
  }
  if (seat?.scrim) {
    shapes.push({
      id: "type-scrim",
      role: "local-scrim",
      rect: regions.panel,
      fill: seat.ink === "dark" ? "#F7F4EE" : "#14120F",
    })
  }

  const photoArea = (regions.photo.w * regions.photo.h) / (trim.w * trim.h)
  const panelArea = (regions.panel.w * regions.panel.h) / (trim.w * trim.h)
  const calm = Math.max(0, Math.min(100, Math.round((1 - panelArea * 0.55) * 100)))

  const front: PostcardFacePlan = {
    templateId: scaffoldFor(input.rationale.vertical),
    size: input.rationale.format.trim,
    face: "front",
    pairing,
    palette,
    photos,
    shapes,
    texts: texts.filter((text) => text.text),
    trust: [],
    lockup: {
      rect: lockupBounds(responseContent, response),
      qrRect,
      qrInches: QR_IN,
      qrLabel: SCAN_LABEL,
      qrLabelPt: 9,
      phone: phoneText.text ? phoneText : undefined,
      website: websiteText.text ? websiteText : undefined,
    },
    overflows: faceOverflows(texts, [phoneText, websiteText]),
    missingContact: [
      phoneText.text ? "" : "phone",
      websiteText.text ? "" : "website",
    ].filter((item) => item.length > 0),
  }

  const back = composeBack({
    trim: input.rationale.format.trim,
    geometry: input.rationale.format.trim === "6x9" ? buildPostcard6x9PrintSpec() : buildPostcard5x8PrintSpec(),
    palette,
    pairing,
    ink,
    businessName: clean(input.businessName),
    phone,
    website,
    proof: input.rationale.trust.back_only[0] ?? "Proof stays on this side",
    disclaimer: input.disclaimer ?? null,
  })

  const headlineText = texts.find((text) => text.role === "headline")
  return {
    front,
    back,
    typePt: {
      offer: offerText?.fontPt ?? sizes.offer,
      headline: headlineText?.fontPt ?? sizes.headline,
      support: texts.find((text) => text.role === "body" || text.role === "proof")?.fontPt ?? sizes.support,
      phone: phoneText.fontPt || sizes.phone,
    },
    photoAreaPct: Math.round(photoArea * 100),
    calmFieldPct: calm,
    panel: regions.panel,
  }
}

/**
 * Light open canvas. Headline in two brand colors, the contact line under it,
 * a cut-out subject on the right, a floating offer, and one row of thumbnails.
 */
function composeIntegrated(
  input: GridComposeInput,
  trim: { w: number; h: number },
  pairing: FontPairingId,
  palette: VerticalPalette
): GridCard {
  const paper = isLight(palette.paper) ? palette.paper : "#F7F4EE"
  const ink = inkForBackground(paper)
  const accent = input.rationale.palette.accent_hex
  const accentOnPaper = contrastRatio(accent, paper) >= 4.5 ? accent : ink
  const headlineInk = ink
  const geometry = integratedGeometry(trim)
  const spoken = spokenCopy(input)
  const offerIsHero = leadsWithOffer(input.rationale.scale_ratios.hero, spoken.numeral)
  const headline = spoken.headline
  const [firstLine, secondLine] = splitHeadline(headline)
  const offerParts = offerIsHero
    ? { numeral: spoken.numeral, rest: spoken.rest }
    : { numeral: [spoken.numeral, spoken.rest].filter(Boolean).join(" "), rest: "" }
  const phone = clean(input.spec.phone) || ""
  const website = displayHost(input.spec.website || input.spec.qrDestination || "")
  const name = clean(input.businessName) || "Local crew"
  const column = geometry.column
  const sizes = typeSizes(input.rationale, column.h * 0.72, offerIsHero ? "offer" : "headline")
  const offerColor = offerIsHero && contrastRatio(accent, paper) >= 4.5 ? accent : accentOnPaper
  const blocks: StackBlock[] = [
    { text: firstLine, role: "headline", pt: sizes.headline, floor: (input.rationale.format.trim === "6x9" ? 12 : 11) * 2.5, color: headlineInk },
  ]
  if (secondLine) {
    blocks.push({
      text: secondLine,
      role: "headline",
      pt: sizes.headline,
      floor: (input.rationale.format.trim === "6x9" ? 12 : 11) * 2.5,
      color: accentOnPaper === headlineInk ? ink : accentOnPaper,
    })
  }
  const stacked = placeStack({
    blocks,
    cursor: column.y,
    bottom: column.y + column.h * 0.42,
    content: column,
    pairing,
    align: "left",
  })
  const headlineTexts = stacked.texts.map((text) => shrinkToInk(text, pairing))
  const headlineBottom = headlineTexts.reduce((bottom, text) => Math.max(bottom, text.rect.y + text.rect.h), column.y)
  const offerTop = round2(headlineBottom + 0.1)
  const offerWidth = round2(Math.min(3.3, geometry.photo.x - column.x - 0.08))
  const offerFloor = offerIsHero ? sizes.headline * 1.6 : (input.rationale.format.trim === "6x9" ? 12 : 11) * 1.5
  const aboveThumbs = round2(geometry.thumbTop - 0.1)
  const clusterReserve = QR_IN + 0.28
  const trailing = (offerParts.rest ? 0.3 : 0) + 0.26
  const offerRoom = Math.max(0.42, aboveThumbs - offerTop - trailing - clusterReserve)
  const roomPt = Math.floor(((Math.max(0.2, offerRoom) / 0.84) * 72) * 2) / 2
  const offerCap = Math.max(18, Math.min(sizes.offer, roomPt))
  const offerLine = shrinkToInk(fitText({
    text: offerParts.numeral,
    rect: { x: column.x, y: offerTop, w: offerWidth, h: offerRoom },
    role: "offer",
    pairing,
    color: offerColor,
    minPt: Math.min(offerFloor, offerCap),
    maxPt: offerCap,
  }), pairing)
  const texts = [...headlineTexts, offerLine].filter((text) => text.text)
  let cursor = round2(offerLine.rect.y + offerLine.rect.h + 0.02)
  if (offerParts.rest) {
    const rest = shrinkToInk(fitText({
      text: offerParts.rest,
      rect: { x: column.x, y: cursor, w: offerWidth, h: 0.26 },
      role: "body",
      pairing,
      color: ink,
      minPt: 12,
      maxPt: 14,
    }), pairing)
    if (rest.text) texts.push(rest)
    cursor = round2((rest.text ? rest.rect.y + rest.rect.h : cursor) + 0.04)
  }
  const wordmark = shrinkToInk(fitText({
    text: name,
    rect: { x: column.x, y: cursor, w: offerWidth, h: 0.22 },
    role: "label",
    pairing,
    color: ink,
    minPt: 11,
    maxPt: 12,
  }), pairing)
  if (wordmark.text) {
    texts.push(wordmark)
    cursor = round2(wordmark.rect.y + wordmark.rect.h + 0.06)
  }
  const responseWidth = round2(Math.max(1.4, geometry.photo.x - column.x - 0.08))
  const phoneText = shrinkToInk(fitText({
    text: phone,
    rect: { x: column.x, y: cursor, w: responseWidth, h: 0.36 },
    role: "contact",
    pairing,
    color: ink,
    minPt: 16,
    maxPt: column.w >= 6 ? 22 : 20,
  }), pairing)
  const websiteText = shrinkToInk(fitText({
    text: website,
    rect: { x: column.x, y: round2(phoneText.rect.y + phoneText.rect.h + 0.03), w: responseWidth, h: 0.24 },
    role: "label",
    pairing,
    color: ink,
    minPt: URL_MIN_PT,
    maxPt: 12,
  }), pairing)
  const qrRect: InchRect = {
    x: column.x,
    y: round2(websiteText.rect.y + websiteText.rect.h + 0.06),
    w: QR_IN,
    h: QR_IN,
  }
  const clusterTop = phoneText.rect.y
  const clusterBottom = Math.max(qrRect.y + qrRect.h, websiteText.rect.y + websiteText.rect.h)
  const photos = thumbnailRow(geometry, trim)
  photos.unshift({ id: "subject", role: "photo", rect: geometry.photo, bleed: false, treatment: "cutout" })
  const shapes: ShapePlan[] = [
    { id: "paper", role: "paper", rect: { x: 0, y: 0, w: trim.w, h: trim.h }, fill: paper },
    ...thumbnailFrames(geometry, trim, ink),
  ]
  const photoArea = (geometry.photo.w * geometry.photo.h) / (trim.w * trim.h)
  const front: PostcardFacePlan = {
    templateId: scaffoldFor(input.rationale.vertical),
    size: input.rationale.format.trim,
    face: "front",
    pairing,
    palette,
    photos: input.rationale.photo_brief.placement === "none" ? [] : photos,
    shapes,
    texts,
    trust: [],
    lockup: {
      rect: {
        x: column.x,
        y: clusterTop,
        w: round2(qrRect.x + qrRect.w - column.x),
        h: round2(clusterBottom - clusterTop),
      },
      qrRect,
      qrInches: QR_IN,
      qrLabel: SCAN_LABEL,
      qrLabelPt: 9,
      phone: phoneText.text ? phoneText : undefined,
      website: websiteText.text ? websiteText : undefined,
    },
    overflows: faceOverflows(texts, [phoneText, websiteText]),
    missingContact: [phoneText.text ? "" : "phone", websiteText.text ? "" : "website"].filter((item) => item.length > 0),
  }
  const back = composeBack({
    trim: input.rationale.format.trim,
    geometry: input.rationale.format.trim === "6x9" ? buildPostcard6x9PrintSpec() : buildPostcard5x8PrintSpec(),
    palette,
    pairing,
    ink,
    businessName: name,
    phone,
    website,
    proof: input.rationale.trust.back_only[0] ?? "Proof stays on this side",
    disclaimer: input.disclaimer ?? null,
  })
  const offerText = texts.find((text) => text.role === "offer")
  const headlineText = texts.find((text) => text.role === "headline")
  return {
    front,
    back,
    typePt: {
      offer: offerText?.fontPt ?? sizes.offer,
      headline: headlineText?.fontPt ?? sizes.headline,
      support: texts.find((text) => text.role === "body")?.fontPt ?? 12,
      phone: phoneText.fontPt || sizes.phone,
    },
    photoAreaPct: Math.round(photoArea * 100),
    calmFieldPct: 55,
    panel: column,
  }
}

/** The box the critic samples is the ink, so a cut-out can sit in the empty margin. */
function shrinkToInk(text: FittedText, pairing: FontPairingId): FittedText {
  if (!text.text || text.lines.length === 0) return text
  const em = text.font === "display" ? PAIRING_MEASURE[pairing].display : PAIRING_MEASURE[pairing].text
  const factor = paintedLineFactor(text)
  const width = text.lines.reduce((max, line) => Math.max(max, line.length * (text.fontPt / 72) * em), 0.4)
  const painted = text.lines.length * (text.fontPt / 72) * factor
  const words = text.lines.join(" ").replace(/\s+/g, " ").trim()
  const widthOk = width <= text.rect.w + 0.04
  const heightOk = painted <= text.rect.h + 0.04
  const wordsOk = words === text.text.replace(/\s+/g, " ").trim()
  return {
    ...text,
    overflows: !(widthOk && heightOk && wordsOk),
    rect: {
      x: text.rect.x,
      y: text.rect.y,
      w: round2(Math.min(text.rect.w, width + 0.04)),
      h: round2(Math.max(0.16, painted * 1.04)),
    },
  }
}

function integratedGeometry(trim: { w: number; h: number }): {
  photo: InchRect
  column: InchRect
  thumbTop: number
  thumbH: number
} {
  const thumbH = round2(Math.min(0.7, trim.h * 0.13))
  const thumbTop = round2(trim.h - SAFE_IN - thumbH)
  return {
    photo: {
      x: round2(Math.min(trim.w * 0.29, 2.32)),
      y: 0.04,
      w: round2(trim.w - Math.min(trim.w * 0.29, 2.32)),
      h: round2(Math.max(1.8, thumbTop - 0.1)),
    },
    column: {
      x: SAFE_IN,
      y: SAFE_IN,
      w: round2(trim.w * 0.56),
      h: round2(thumbTop - SAFE_IN - 0.1),
    },
    thumbTop,
    thumbH,
  }
}

function thumbnailRow(geometry: { thumbTop: number; thumbH: number }, trim: { w: number; h: number }): PhotoSlotPlan[] {
  const count = 4
  const gap = 0.08
  const left = SAFE_IN
  const right = trim.w - SAFE_IN
  const width = round2((right - left - gap * (count - 1)) / count)
  return Array.from({ length: count }, (_, index) => ({
    id: `thumb-${index + 1}`,
    role: "photo",
    rect: { x: round2(left + index * (width + gap)), y: geometry.thumbTop, w: width, h: geometry.thumbH },
    bleed: false,
    treatment: "thumbnail" as const,
  }))
}

function thumbnailFrames(
  geometry: { thumbTop: number; thumbH: number },
  trim: { w: number; h: number },
  ink: string
): ShapePlan[] {
  return thumbnailRow(geometry, trim).map((slot, index) => ({
    id: `thumb-frame-${index + 1}`,
    role: "thumbnail",
    rect: { x: slot.rect.x - 0.02, y: slot.rect.y - 0.02, w: slot.rect.w + 0.04, h: slot.rect.h + 0.04 },
    fill: ink,
  }))
}

function splitHeadline(headline: string): [string, string] {
  const words = headline.split(/\s+/).filter(Boolean)
  if (words.length < 2) return [headline, ""]
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")]
}

function composeBack(input: {
  trim: TrimSize
  geometry: PostcardGeometry
  palette: VerticalPalette
  pairing: FontPairingId
  ink: string
  businessName: string
  phone: string
  website: string
  proof: string
  disclaimer: string | null
}): PostcardFacePlan {
  const content = canvasToTrim(addressSideContentRect(input.geometry), input.geometry.bleedInchesPerSide)
  const texts: FittedText[] = []
  let cursor = content.y
  const lines = [
    { text: input.businessName, role: "proof" as const, pt: 12 },
    { text: input.phone, role: "contact" as const, pt: input.trim === "6x9" ? 16 : 14 },
    { text: input.website, role: "label" as const, pt: 11 },
    { text: input.proof, role: "body" as const, pt: 11 },
  ]
  for (const line of lines) {
    if (!line.text) continue
    const rect = { x: content.x, y: cursor, w: content.w, h: 0.32 }
    if (rect.y + rect.h > content.y + content.h) break
    texts.push(fitText({
      text: line.text,
      rect,
      role: line.role,
      pairing: input.pairing,
      color: input.ink,
      minPt: line.pt,
      maxPt: line.pt,
    }))
    cursor += 0.36
  }
  if (input.disclaimer) {
    const height = Math.min(1.05, content.y + content.h - cursor)
    if (height >= 0.4) {
      texts.push(fitText({
        text: input.disclaimer,
        rect: { x: content.x, y: cursor, w: content.w, h: height },
        role: "body",
        pairing: input.pairing,
        color: input.ink,
        minPt: 7,
        maxPt: 8,
      }))
    }
  }
  const trim = trimInches(input.trim)
  return {
    templateId: "medicare_calm",
    size: input.trim,
    face: "back",
    pairing: input.pairing,
    palette: input.palette,
    photos: [],
    shapes: [{ id: "paper", role: "paper", rect: { x: 0, y: 0, w: trim.w, h: trim.h }, fill: input.palette.paper }],
    texts,
    trust: [],
    lockup: null,
    overflows: texts.some((text) => text.overflows),
    missingContact: [],
  }
}

export function trimInches(size: TrimSize): { w: number; h: number } {
  return size === "6x9" ? { w: 9, h: 6 } : { w: 8, h: 5 }
}

export function safeRect(size: TrimSize): InchRect {
  const trim = trimInches(size)
  return { x: SAFE_IN, y: SAFE_IN, w: trim.w - SAFE_IN * 2, h: trim.h - SAFE_IN * 2 }
}

export function textInsideSafe(rect: InchRect, size: TrimSize): boolean {
  const safe = safeRect(size)
  const epsilon = 0.02
  return (
    rect.x >= safe.x - epsilon &&
    rect.y >= safe.y - epsilon &&
    rect.x + rect.w <= safe.x + safe.w + epsilon &&
    rect.y + rect.h <= safe.y + safe.h + epsilon
  )
}

export function compositionMode(rationale: DesignRationale): CompositionMode {
  const mode = rationale.grid.intentional_break
  if (
    mode === "integrated" ||
    mode === "full-bleed" ||
    mode === "panel" ||
    mode === "dark-offer-field" ||
    mode === "overlapping-card" ||
    mode === "type-led" ||
    mode === "calm-column"
  ) {
    return mode
  }
  return "overlapping-card"
}

/** A dark bar inside the photograph, tall enough for the phone, the code, and one URL line. */
function photoResponseBand(photo: InchRect): InchRect {
  const h = Math.min(1.36, Math.max(1.2, photo.h - 0.12))
  return {
    x: photo.x,
    y: round2(photo.y + photo.h - h),
    w: photo.w,
    h: round2(h),
  }
}

function lockupBounds(
  content: InchRect,
  response: { qrRect: InchRect; website: FittedText }
): InchRect {
  const bottom = response.website.text
    ? response.website.rect.y + response.website.rect.h
    : response.qrRect.y + response.qrRect.h
  const right = Math.max(response.qrRect.x + response.qrRect.w, content.x + content.w)
  return {
    x: content.x,
    y: response.qrRect.y,
    w: round2(right - content.x),
    h: round2(Math.max(response.qrRect.h, bottom - response.qrRect.y)),
  }
}

function fullBleedColumn(trim: { w: number; h: number }, seat?: TypeSeat | null): InchRect {
  if (!seat) {
    return {
      x: round2(trim.w * 0.04),
      y: round2(trim.h * 0.08),
      w: round2(trim.w * 0.48),
      h: round2(trim.h * 0.78),
    }
  }
  const width = round2(Math.min(trim.w * 0.56, Math.max(3.2, seat.rect.w * trim.w)))
  const height = round2(trim.h - SAFE_IN * 2)
  let x = round2(seat.rect.x * trim.w)
  let y = SAFE_IN
  if (x + width > trim.w - SAFE_IN) x = round2(trim.w - SAFE_IN - width)
  if (y + height > trim.h - SAFE_IN) y = round2(trim.h - SAFE_IN - height)
  return {
    x: round2(Math.max(SAFE_IN, x)),
    y: round2(Math.max(SAFE_IN, y)),
    w: width,
    h: height,
  }
}

export function panelLayout(
  mode: CompositionMode,
  trim: { w: number; h: number },
  seat?: TypeSeat | null
): { photo: InchRect; panel: InchRect } {
  const { w, h } = trim
  if (mode === "dark-offer-field") {
    const panelW = round2(w * 0.58)
    return {
      photo: { x: panelW, y: 0, w: round2(w - panelW), h },
      panel: { x: 0, y: 0, w: panelW, h },
    }
  }
  if (mode === "type-led") {
    const photoH = round2(h * 0.42)
    return {
      photo: { x: 0, y: 0, w, h: photoH },
      panel: { x: 0, y: photoH, w, h: round2(h - photoH) },
    }
  }
  if (mode === "full-bleed") {
    return {
      photo: { x: 0, y: 0, w, h },
      panel: fullBleedColumn(trim, seat),
    }
  }
  if (mode === "panel") {
    const panelW = round2(w * 0.46)
    return {
      photo: { x: panelW, y: 0, w: round2(w - panelW), h },
      panel: { x: 0, y: 0, w: panelW, h },
    }
  }
  if (mode === "calm-column") {
    const panelW = round2(w * 0.36)
    return {
      photo: { x: 0, y: 0, w: round2(w - panelW), h },
      panel: { x: round2(w - panelW), y: 0, w: panelW, h },
    }
  }
  return {
    photo: { x: 0, y: 0, w, h },
    panel: {
      x: round2(w * 0.04),
      y: round2(h * 0.16),
      w: round2(w * 0.56),
      h: round2(h * 0.76),
    },
  }
}

export function rectsIntersect(a: InchRect, b: InchRect): boolean {
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return overlapX > 0.02 && overlapY > 0.02
}

/** Every text box the front actually paints, including the scan line under the code. */
export function paintedTextRects(plan: PostcardFacePlan): Array<{ role: string; rect: InchRect }> {
  const items: Array<{ role: string; rect: InchRect }> = plan.texts
    .filter((text) => text.text.trim().length > 0 && text.lines.length > 0)
    .map((text) => ({ role: text.role, rect: text.rect }))
  if (plan.lockup?.phone?.text && plan.lockup.phone.lines.length > 0) {
    items.push({ role: "phone", rect: plan.lockup.phone.rect })
  }
  if (plan.lockup?.website?.text && plan.lockup.website.lines.length > 0) {
    items.push({ role: "website", rect: plan.lockup.website.rect })
  }
  if (plan.lockup?.qrLabel) {
    const labelH = Math.min(0.2, plan.lockup.qrRect.h * 0.24)
    items.push({
      role: "scan",
      rect: {
        x: plan.lockup.qrRect.x,
        y: round2(plan.lockup.qrRect.y + plan.lockup.qrRect.h - labelH),
        w: plan.lockup.qrRect.w,
        h: labelH,
      },
    })
  }
  return items
}

function placeResponse(input: {
  content: InchRect
  phone: string
  website: string
  pairing: FontPairingId
  ink: string
  urlMin?: number
}): { qrRect: InchRect; phone: FittedText; website: FittedText; stackBottom: number; stackRoom: number } {
  const websiteH = 0.26
  const gap = 0.08
  const rowH = QR_IN
  const lockupH = rowH + gap + websiteH
  const lockupTop = input.content.y + input.content.h - lockupH
  const qrRect: InchRect = { x: input.content.x, y: lockupTop, w: QR_IN, h: QR_IN }
  const textX = qrRect.x + qrRect.w + 0.12
  const textW = Math.max(0.8, input.content.x + input.content.w - textX)
  const phoneH = 0.4
  const phone = fitText({
    text: input.phone,
    rect: { x: textX, y: lockupTop + (rowH - phoneH) / 2, w: textW, h: phoneH },
    role: "contact",
    pairing: input.pairing,
    color: input.ink,
    minPt: 16,
    maxPt: input.content.w >= 6 ? 22 : 20,
  })
  const website = fitText({
    text: input.website,
    rect: { x: input.content.x, y: lockupTop + rowH + gap, w: input.content.w, h: websiteH },
    role: "label",
    pairing: input.pairing,
    color: input.ink,
    minPt: input.urlMin ?? URL_MIN_PT,
    maxPt: Math.max(12, input.urlMin ?? URL_MIN_PT),
  })
  return {
    qrRect,
    phone,
    website,
    stackBottom: lockupTop - 0.1,
    stackRoom: lockupTop - 0.1 - input.content.y,
  }
}

/** A free offer is the word FREE, and that word is the hero even when the family asked for a headline. */
function leadsWithOffer(hero: "offer" | "headline", numeral: string): boolean {
  return hero === "offer" || numeral === "FREE"
}

function typeSizes(
  rationale: DesignRationale,
  stackRoom: number,
  hero: "offer" | "headline" = rationale.scale_ratios.hero
): { offer: number; headline: number; support: number; phone: number } {
  const body = rationale.format.trim === "6x9" ? 12 : 11
  let headline = body * rationale.scale_ratios.headline_to_body_cap
  let offer = headline * rationale.scale_ratios.offer_to_headline_cap
  const offerIn = (offer / 72) * 1.08
  const headlineIn = (headline / 72) * 1.15
  const budget = Math.max(1.15, stackRoom - 0.35)
  if (offerIn + headlineIn > budget) {
    const scale = budget / (offerIn + headlineIn)
    offer *= scale
    headline *= scale
  }
  if (hero === "offer") {
    headline = Math.max(headline, body * 2.5)
    offer = Math.max(offer, headline * 1.6)
  } else {
    headline = Math.max(headline, body * 2.5)
    offer = Math.min(Math.max(offer, body * 1.5), headline * 0.9)
  }
  if (rationale.refine?.minOfferPt) offer = Math.max(offer, rationale.refine.minOfferPt)
  return {
    offer: roundPt(offer),
    headline: roundPt(headline),
    support: 12,
    phone: rationale.format.trim === "6x9" ? 22 : 20,
  }
}

interface StackBlock {
  text: string
  role: FittedText["role"]
  pt: number
  floor: number
  color: string
  width?: number
  /** Keep this line large, and shrink the lines under it first. */
  protect?: boolean
}

/**
 * Gives each line the height its words actually need. Point size steps down
 * to the legibility minimum until the stack fits. A line is never given a
 * box shorter than its words, and a line that still will not fit is marked
 * as overflow instead of being dropped or clipped.
 */
function placeStack(input: {
  blocks: StackBlock[]
  cursor: number
  bottom: number
  content: InchRect
  pairing: FontPairingId
  align: "left" | "center"
}): { texts: FittedText[] } {
  const room = input.bottom - input.cursor
  const live = input.blocks.filter((block) => block.text.trim().length > 0).map((block) => ({ ...block }))
  const chosen = live
  let belowFloor = false
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const total = chosen.reduce((sum, block) => sum + measuredHeight(block, input) + 0.06, 0)
    const tooWide = chosen.some((block) => measuredOverflow(block, input))
    if (total <= room + 0.02 && !tooWide) break
    const victim = shrinkTarget(chosen, belowFloor)
    if (victim < 0) {
      if (!belowFloor) {
        belowFloor = true
        continue
      }
      break
    }
    const block = chosen[victim]!
    chosen[victim] = { ...block, pt: roundPt(Math.max(shrinkStop(block, belowFloor), block.pt - 1)) }
  }
  const texts: FittedText[] = []
  let cursor = input.cursor
  for (const block of chosen) {
    const natural = measuredHeight(block, input)
    const roomLeft = input.bottom - cursor
    const height = round2(natural + 0.04)
    const fitted = fitText({
      text: block.text,
      rect: { x: input.content.x, y: cursor, w: block.width ?? input.content.w, h: height },
      role: block.role,
      pairing: input.pairing,
      color: block.color,
      align: input.align,
      minPt: Math.min(block.pt, legibilityMin(block)),
      maxPt: block.pt,
    })
    if (!fitted.text) continue
    const used = measuredHeight({ ...block, pt: fitted.fontPt }, input)
    const rectH = round2(Math.max(used + 0.02, fitted.rect.h))
    const placed = { ...fitted, rect: { ...fitted.rect, h: rectH } }
    texts.push({
      ...placed,
      overflows: fitted.overflows || textIsClipped(placed) || used > roomLeft + 0.08,
    })
    cursor += used + 0.06
  }
  return { texts }
}

function shrinkTarget(blocks: StackBlock[], belowFloor: boolean): number {
  let best = -1
  let slack = 0
  const rank = (block: StackBlock, index: number, protectedOnly: boolean) => {
    if (protectedOnly !== Boolean(block.protect)) return
    if (belowFloor && wouldBreakOfferRatio(blocks, index)) return
    const room = block.pt - shrinkStop(block, belowFloor)
    if (room > slack + 0.01) {
      slack = room
      best = index
    }
  }
  blocks.forEach((block, index) => rank(block, index, false))
  if (best >= 0) return best
  slack = 0
  blocks.forEach((block, index) => rank(block, index, true))
  return best
}

function shrinkStop(block: StackBlock, belowFloor: boolean): number {
  const legibility = legibilityMin(block)
  if (belowFloor) return legibility
  return Math.max(legibility, block.floor)
}

/** FREE stays at least 1.55× the headline while either line can still shrink. */
function wouldBreakOfferRatio(blocks: StackBlock[], index: number): boolean {
  const block = blocks[index]
  if (!block || block.role !== "offer") return false
  const headline = blocks.find((item) => item.role === "headline")
  if (!headline) return false
  if (headline.pt - shrinkStop(headline, true) <= 0.01) return false
  return block.pt - 1 < headline.pt * 1.55
}

function legibilityMin(block: StackBlock): number {
  if (block.role === "offer") return 18
  if (block.role === "headline") return 14
  return 11
}

function faceOverflows(texts: FittedText[], extra: FittedText[]): boolean {
  return [...texts, ...extra].some((text) => text.overflows || textIsClipped(text))
}

/** The line height the postcard painter actually uses. */
export function paintedLineFactor(text: Pick<FittedText, "role" | "font">): number {
  if (text.role === "offer") return 0.8
  return text.font === "display" ? 1.02 : 1.18
}

/** A line that does not fit its box, or that drops a word, is clipped. */
export function textIsClipped(text: FittedText): boolean {
  if (!text.text.trim()) return false
  const source = text.text.split(/\s+/).filter(Boolean).join(" ")
  const painted = text.lines.join(" ").split(/\s+/).filter(Boolean).join(" ")
  if (!painted || source !== painted) return true
  const block = text.lines.length * (text.fontPt / 72) * paintedLineFactor(text)
  return block > text.rect.h + 0.08
}

function measuredHeight(block: StackBlock, input: { content: InchRect; pairing: FontPairingId; align: "left" | "center" }): number {
  const fitted = fitText({
    text: block.text,
    rect: { x: 0, y: 0, w: block.width ?? input.content.w, h: 12 },
    role: block.role,
    pairing: input.pairing,
    color: block.color,
    align: input.align,
    minPt: block.pt,
    maxPt: block.pt,
  })
  const line = (fitted.fontPt / 72) * (fitted.font === "display" ? 1.02 : 1.18) * 1.04
  return Math.max(line, Math.max(1, fitted.lines.length) * line)
}

function measuredOverflow(block: StackBlock, input: { content: InchRect; pairing: FontPairingId; align: "left" | "center" }): boolean {
  return fitText({
    text: block.text,
    rect: { x: 0, y: 0, w: block.width ?? input.content.w, h: 12 },
    role: block.role,
    pairing: input.pairing,
    color: block.color,
    align: input.align,
    minPt: block.pt,
    maxPt: block.pt,
  }).overflows
}

export function paletteFromRationale(rationale: DesignRationale): VerticalPalette {
  const neutrals = rationale.palette.neutral_hex
  const paper = [...neutrals].sort((a, b) => relativeLuminance(b) - relativeLuminance(a))[0] ?? "#F4F1EA"
  const field = [...neutrals].sort((a, b) => relativeLuminance(a) - relativeLuminance(b))[0] ?? "#1A1A1A"
  const ink = inkForBackground(paper)
  const accent = rationale.palette.accent_hex
  return {
    id: paletteIdFor(rationale.vertical),
    paper,
    ink,
    field,
    fieldInk: inkForBackground(field),
    accent,
    accentInk: inkForBackground(accent),
    offerTile: paper,
    offerInk: ink,
    scrim: field,
  }
}

function paletteIdFor(vertical: DesignVertical): VerticalPaletteId {
  if (vertical === "medicare_insurance") return "medicare"
  if (vertical === "general_local_service") return "general"
  return vertical
}

function scaffoldFor(vertical: DesignVertical): PostcardTemplateId {
  if (vertical === "medicare_insurance") return "medicare_calm"
  if (vertical === "plumbing") return "service_band"
  if (vertical === "hvac") return "service_band"
  return "hero_scrim"
}

function spokenCopy(input: GridComposeInput): { headline: string; numeral: string; rest: string } {
  const spoken = resolveFrontCopy({
    headline: clean(input.spec.headline) || "One clear next step",
    offer: clean(input.spec.offer) || clean(input.spec.callToAction) || "Call today",
    moment: input.rationale.audience_moment,
    vertical: input.rationale.vertical,
  })
  if (input.rationale.vertical === "medicare_insurance" && spoken.numeral === "FREE") {
    return { headline: spoken.headline, numeral: spoken.rest || "A local review", rest: "" }
  }
  return spoken
}

function trustLine(input: GridComposeInput): string {
  if (input.rationale.vertical === "medicare_insurance") {
    return clean(input.businessName) || "A local licensed advisor"
  }
  const line = input.rationale.trust.front_line
  if (/license/i.test(line)) return "Licensed and local"
  return clean(input.businessName) || "Local crew"
}

function displayHost(value: string): string {
  return value.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "")
}

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function inset(rect: InchRect, pad: number): InchRect {
  return {
    x: rect.x + pad,
    y: rect.y + pad,
    w: Math.max(0.4, rect.w - pad * 2),
    h: Math.max(0.4, rect.h - pad * 2),
  }
}

function clampRect(rect: InchRect, trim: { w: number; h: number }): InchRect {
  const x = Math.max(SAFE_IN, rect.x)
  const y = Math.max(SAFE_IN, rect.y)
  const right = Math.min(trim.w - SAFE_IN, rect.x + rect.w)
  const bottom = Math.min(trim.h - SAFE_IN, rect.y + rect.h)
  return { x, y, w: Math.max(0.4, right - x), h: Math.max(0.4, bottom - y) }
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

function roundPt(value: number): number {
  return Math.round(value * 2) / 2
}

export function normalizedPanel(panel: InchRect, size: TrimSize): { x: number; y: number; w: number; h: number } {
  const trim = trimInches(size)
  return {
    x: panel.x / trim.w,
    y: panel.y / trim.h,
    w: panel.w / trim.w,
    h: panel.h / trim.h,
  }
}
