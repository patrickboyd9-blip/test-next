import type { CreativeSpec } from "@/lib/campaign-creator/types"
import type { PostcardFacePlan, PhotoSlotPlan, ShapePlan } from "@/lib/postcard-layouts/compose"
import type { FontPairingId, PostcardTemplateId, VerticalPaletteId } from "@/lib/postcard-layouts/ids"
import type { VerticalPalette } from "@/lib/postcard-layouts/palette"
import { fitText, type FittedText, type InchRect } from "@/lib/postcard-layouts/typefit"
import { addressSideContentRect } from "@/lib/print-spec/address-side-content"
import {
  buildPostcard5x8PrintSpec,
  type InchesRect,
  type PostcardGeometry,
} from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"

import type { CompositionMode } from "./art-director"
import { contrastRatio, inkForBackground, isLight, relativeLuminance } from "./contrast"
import type { DesignRationale, DesignVertical, TrimSize } from "./rationale"

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
  const pairing: FontPairingId = input.rationale.vertical === "medicare_insurance" ? "letter" : "trade"
  const palette = paletteFromRationale(input.rationale)
  const mode = compositionMode(input.rationale)
  const regions = panelLayout(mode, trim)
  const paper = isLight(palette.paper) ? palette.paper : "#F4F1EA"
  const darkField = mode === "dark-offer-field"
  const panelFill = darkField ? palette.field : paper
  const ink = inkForBackground(panelFill)
  const accent = input.rationale.palette.accent_hex
  const offerIsHero = input.rationale.scale_ratios.hero === "offer"
  const offerIsTile = !offerIsHero && (mode === "overlapping-card" || mode === "type-led")
  const tileFill = contrastRatio(accent, inkForBackground(accent)) >= 4.5 ? accent : ink
  const tileInk = inkForBackground(tileFill)
  const responseOnPhoto = mode === "type-led"
  const responseFill = "#1A1A1A"
  const content = clampRect(inset(regions.panel, responseOnPhoto ? 0.1 : 0.16), trim)
  const responseBand = responseOnPhoto ? photoResponseBand(regions.photo) : null
  const responseContent = responseBand ? clampRect(inset(responseBand, 0.06), trim) : content
  const responseInk = responseBand ? inkForBackground(responseFill) : ink
  const headline = clean(input.spec.headline) || "One clear next step"
  const offerSource = clean(input.spec.offer) || clean(input.spec.callToAction) || "Call today"
  const offerParts = offerIsHero ? splitOffer(offerSource) : { numeral: offerSource, rest: "" }
  const trust = trustLine(input)
  const phone = clean(input.spec.phone) || ""
  const website = displayHost(input.spec.website || input.spec.qrDestination || "")
  const response = placeResponse({ content: responseContent, phone, website, pairing, ink: responseInk })
  const stackRoom = responseBand ? content.h : response.stackRoom
  const sizes = typeSizes(input.rationale, stackRoom)
  const offerColor = offerIsTile ? tileInk : offerIsHero && contrastRatio(accent, panelFill) >= 4.5 ? accent : ink
  const bodyFloor = input.rationale.format.trim === "6x9" ? 12 : 11
  const headlineFloor = bodyFloor * 2.5
  const offerFloor = offerIsHero ? headlineFloor * 1.6 : bodyFloor * 1.5
  const blocks: StackBlock[] = []
  if (offerIsHero) {
    blocks.push({ text: offerParts.numeral, role: "offer", pt: sizes.offer, floor: offerFloor, color: offerColor })
    if (offerParts.rest) blocks.push({ text: offerParts.rest, role: "body", pt: sizes.support, floor: 11, color: ink })
    blocks.push({ text: headline, role: "headline", pt: sizes.headline, floor: headlineFloor, color: ink })
  } else {
    blocks.push({ text: headline, role: "headline", pt: sizes.headline, floor: headlineFloor, color: ink })
    blocks.push({ text: offerParts.numeral, role: "offer", pt: sizes.offer, floor: offerFloor, color: offerColor })
  }
  if (trust) blocks.push({ text: trust, role: "proof", pt: Math.min(sizes.support, 13), floor: 11, color: ink })
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
    : [{ id: "photo", role: "photo", rect: regions.photo, bleed: true }]

  const offerText = texts.find((text) => text.role === "offer")
  const shapes: ShapePlan[] = [
    { id: "paper", role: "paper", rect: { x: 0, y: 0, w: trim.w, h: trim.h }, fill: darkField ? palette.field : palette.paper },
    { id: "panel", role: "type-panel", rect: regions.panel, fill: panelFill },
  ]
  if (responseBand) {
    shapes.push({ id: "response-band", role: "band", rect: responseBand, fill: responseFill })
  }
  if (offerIsTile && offerText) {
    shapes.push({
      id: "offer-tile",
      role: "offer-tile",
      rect: offerText.rect,
      fill: tileFill,
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
    overflows: [...texts, phoneText, websiteText].some((text) => text.overflows),
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
  if (mode === "dark-offer-field" || mode === "overlapping-card" || mode === "type-led" || mode === "calm-column") {
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

export function panelLayout(mode: CompositionMode, trim: { w: number; h: number }): { photo: InchRect; panel: InchRect } {
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
  const items = plan.texts
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
    minPt: URL_MIN_PT,
    maxPt: 12,
  })
  return {
    qrRect,
    phone,
    website,
    stackBottom: lockupTop - 0.1,
    stackRoom: lockupTop - 0.1 - input.content.y,
  }
}

function typeSizes(
  rationale: DesignRationale,
  stackRoom: number
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
  if (rationale.scale_ratios.hero === "offer") {
    headline = Math.max(headline, body * 2.5)
    offer = Math.max(offer, headline * 1.6)
  } else {
    headline = Math.max(headline, body * 2.5)
    offer = Math.min(Math.max(offer, body * 1.5), headline * 0.9)
  }
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
}

/**
 * Gives each line the height its words actually need. The point size steps
 * down, together, until the stack fits above the response lockup. Floors keep
 * the offer and the headline on the rubric's scale.
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
  const live = input.blocks.filter((block) => block.text.trim().length > 0)
  let scale = 1
  let chosen = live
  for (let attempt = 0; attempt < 28; attempt += 1) {
    chosen = live.map((block) => ({ ...block, pt: roundPt(Math.max(block.floor, block.pt * scale)) }))
    const total = chosen.reduce((sum, block) => sum + measuredHeight(block, input) + 0.08, 0)
    const tooWide = chosen.some((block) => measuredOverflow(block, input))
    if (total <= room + 0.02 && !tooWide) break
    if (chosen.every((block) => block.pt <= block.floor + 0.01)) break
    scale *= 0.92
  }
  const texts: FittedText[] = []
  let cursor = input.cursor
  for (const block of chosen) {
    const natural = measuredHeight(block, input)
    const roomLeft = input.bottom - cursor
    if (roomLeft < 0.22) break
    const fitted = fitText({
      text: block.text,
      rect: { x: input.content.x, y: cursor, w: input.content.w, h: Math.min(natural + 0.02, roomLeft) },
      role: block.role,
      pairing: input.pairing,
      color: block.color,
      align: input.align,
      minPt: Math.min(block.pt, block.floor),
      maxPt: block.pt,
    })
    if (!fitted.text) continue
    texts.push(fitted)
    const used = measuredHeight({ ...block, pt: fitted.fontPt }, input)
    cursor += used + 0.08
  }
  return { texts }
}

function measuredHeight(block: StackBlock, input: { content: InchRect; pairing: FontPairingId; align: "left" | "center" }): number {
  const fitted = fitText({
    text: block.text,
    rect: { x: 0, y: 0, w: input.content.w, h: 12 },
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
    rect: { x: 0, y: 0, w: input.content.w, h: 12 },
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

function splitOffer(offer: string): { numeral: string; rest: string } {
  const priced = offer.match(/^(\$?\d[\d,]*(?:\.\d+)?%?)\b\s*(.*)$/)
  if (priced) return { numeral: priced[1] ?? offer, rest: (priced[2] ?? "").trim() }
  const words = offer.split(/\s+/).filter(Boolean)
  if (words.length > 1 && (words[0] ?? "").length <= 12) {
    return { numeral: words[0] ?? offer, rest: words.slice(1).join(" ") }
  }
  return { numeral: offer, rest: "" }
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
