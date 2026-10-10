import { headlineWordCount, repairHeadlineCopy } from "@/lib/campaign-creator/headline-repair"
import {
  resolveStudioContact,
  type StudioContact,
} from "@/lib/campaign-creator/studio-contact"
import { qrPaintDecodes } from "@/lib/campaign-creator/studio-qr"
import {
  normalizeLayoutVariant,
  type CreativeSpec,
  type LayoutVariant,
} from "@/lib/campaign-creator/types"
import { POSTCARD_5X8_V1 } from "@/lib/mail-catalog/pieces/postcard-5x8"

import { copyRestatesLead } from "./studio-copy-hierarchy"
import {
  QR_CONTACT_RESERVE_IN,
  QR_EDGE_RESERVE_IN,
  QR_LABEL_PT,
  QR_MODULE_FIELD,
  QR_MODULE_INK,
  QR_ONE_INCH,
  designRuleFailures,
  fitQrInches,
  qrScanLabel,
  scoreDesignRules,
  wordCount,
  type DesignRuleCheck,
  type DesignRuleFacts,
  type DesignRuleId,
} from "./design-rules"
import {
  QR_LARGE_INCHES,
  QR_STANDARD_INCHES,
  RUBRIC_HEADLINE_BODY_RATIO,
  RUBRIC_OFFER_BODY_RATIO,
  RUBRIC_QR_QUIET_MODULES,
  scoreAPlusPostcard,
  type RubricCheck,
} from "./postcard-rubric"
import {
  resolveStudioPalette,
  studioCompositionTreatment,
  studioPrintMarks,
  studioTypeExecution,
} from "./studio-composition-treatment"

/**
 * Renderer-owned layout check for the 5×8 postcard.
 * Measures contrast, fit, and photo share, then repairs what it can.
 * Remaining issues are returned for the Studio to say out loud.
 * Not a CreativeSpec field. Not a Click2Mail job.
 */

export const HEADLINE_CONTRAST_MIN = 4.5
export const CTA_CONTRAST_MIN = 4.5

export const PRINT_MIN_PT = {
  headline: 22,
  subhead: 12,
  offer: 13,
  body: 11,
  cta: 12,
  contact: 11,
  wordmark: 8,
} as const

export const PRINT_MAX_PT = {
  headline: 64,
  subhead: 18,
  offer: 18,
  body: 12,
  cta: 16,
  contact: 18,
  wordmark: 10,
} as const

export const SPLIT_PHOTO_SHARE_MIN = 0.55

const INK_DARK = "#14120f"
const INK_LIGHT = "#f7f4ee"
const DISPLAY_EM = 0.56
const TEXT_EM = 0.5
const DISPLAY_LINE = 1.02
const TEXT_LINE = 1.18

export type LayoutFamily = "photo-dominant" | "split" | "type-led"

export interface NormRect {
  /** Fractions of the 8×5 finished trim. Origin is the top-left. */
  x: number
  y: number
  w: number
  h: number
}

export interface LayoutIssue {
  code:
    | "contrast"
    | "overflow"
    | "min-size"
    | "photo-share"
    | "headline-length"
    | "hierarchy"
    | "safe-zone"
    | "modules"
    | "scrim"
    | "qr"
    | "lockup"
    | "keep-out"
  role: "headline" | "subhead" | "offer" | "body" | "cta" | "contact" | "photo" | "card"
  detail: string
}

export interface FittedLine {
  text: string
  fontPt: number
  lines: number
  heightIn: number
  overflows: boolean
}

export interface PostcardLayoutPlan {
  family: LayoutFamily
  layoutVariant: LayoutVariant
  photoShare: number
  photoRect: NormRect | null
  textColumn: NormRect
  scrimRect: NormRect | null
  headline: string
  subheadline: string
  hero: string
  offerLine: string
  body: string
  colors: {
    field: string
    ink: string
    headline: string
    ctaFill: string
    ctaInk: string
    scrim: string
    scrimOpacity: number
  }
  /** Display cut. 800 is Archivo's heaviest loaded weight. */
  headlineWeight: number
  typePt: {
    headline: number
    subhead: number
    offer: number
    body: number
    cta: number
    contact: number
    website: number
    wordmark: number
  }
  /** Outer QR box, including the quiet zone. */
  qrInches: number
  qrQuietModules: number
  qrLabel: string
  /** Code, label, phone, and URL as one band in the type column. */
  lockup: ContactLockup | null
  rubric: RubricCheck[]
  designRules: DesignRuleCheck[]
  issues: LayoutIssue[]
  fixes: string[]
}

export interface ContactLockup {
  qrRect: NormRect
  labelRect: NormRect
  clusterRect: NormRect
}

const TRIM_W = POSTCARD_5X8_V1.physical.finishedTrimInches.widthInches
const TRIM_H = POSTCARD_5X8_V1.physical.finishedTrimInches.heightInches
const INSET = POSTCARD_5X8_V1.creativeCanvas.recommendedSafeTextInsetInches

export function postcardLayoutFamily(spec: {
  layoutVariant?: string
  imagePresence?: string
  imageryRole?: string
}): LayoutFamily {
  const layout = normalizeLayoutVariant(spec.layoutVariant) ?? "peer_split"
  if (
    layout === "type_only" ||
    spec.imageryRole === "none" ||
    spec.imageryRole === "logo"
  ) {
    return "type-led"
  }
  if (spec.imagePresence === "accent") return "type-led"
  if (layout === "image_grounded") return "photo-dominant"
  return "split"
}

export function resolvePostcardLayout(input: {
  spec: CreativeSpec
  compact?: boolean
  showWordmark?: boolean
  /** The contact the card actually paints. Defaults to the spec alone. */
  contact?: StudioContact
}): PostcardLayoutPlan {
  const layout = normalizeLayoutVariant(input.spec.layoutVariant) ?? "peer_split"
  const family = postcardLayoutFamily(input.spec)
  const repaired = repairHeadlineCopy(input.spec)
  const copy = displayCopy(input.spec, repaired)
  const treatment = studioCompositionTreatment({
    leadJob: input.spec.leadJob,
    imageryRole: input.spec.imageryRole,
    layoutVariant: layout,
  })
  const palette = resolveStudioPalette(input.spec.palette, treatment)
  const voice = studioTypeExecution(treatment)
  const fixes: string[] = []
  const issues: LayoutIssue[] = []

  if (repaired.headline && repaired.headline !== collapse(input.spec.headline)) {
    fixes.push("Shortened the headline and moved the rest into the subhead.")
  }

  const geometry = geometryFor(family, layout, input.spec.imagePresence === "accent")
  if (family === "split" && geometry.photoShare + 0.001 < SPLIT_PHOTO_SHARE_MIN) {
    issues.push({
      code: "photo-share",
      role: "photo",
      detail: "The photograph covers less than 55% of the card.",
    })
  }

  const colors = resolveColors({
    family,
    field: palette.field,
    ink: palette.ink,
    emphasis: palette.emphasis,
    headlinePrefersEmphasis: voice.heroColor === "emphasis",
    fixes,
    issues,
  })

  const inner = innerTextBox(geometry.textColumn)
  const contact = input.contact ?? resolveStudioContact(input.spec)
  const qrPayload = contact.qrPayload
  const qrClaimed = Boolean(
    collapse(input.spec.qrDestination) ||
      collapse(input.spec.website) ||
      collapse(input.spec.phone)
  )
  const qrShown = Boolean(qrPayload) || qrClaimed
  const fullCard = !input.compact
  const contactBeside = fullCard && Boolean(contact.phone || contact.website)
  const requestedQr = input.spec.layoutHints?.qrProminence === "large" ? QR_LARGE_INCHES : QR_STANDARD_INCHES
  const qrInches = qrShown
    ? fitQrInches(
        requestedQr,
        inner.w * TRIM_W,
        contactBeside ? QR_CONTACT_RESERVE_IN : QR_EDGE_RESERVE_IN
      )
    : requestedQr
  if (qrShown && qrInches + 0.01 < requestedQr) {
    fixes.push("Sized the QR so the phone and the quiet zone still fit beside it.")
  }
  const qrLabel = qrShown ? qrScanLabel(input.spec.callToAction) : ""
  const lockup = qrShown || contactBeside ? placeLockup(geometry.textColumn, qrInches, Boolean(qrLabel)) : null

  const fitted = fitStack({
    hero: copy.hero,
    subhead: copy.subheadline,
    offer: copy.offerLine,
    body: input.compact ? "" : copy.body,
    widthIn: inner.w * TRIM_W,
    heightIn: inner.h * TRIM_H,
    showWordmark: Boolean(input.showWordmark) && !input.compact,
    qrInches: qrShown ? qrInches : 0,
    fixes,
    issues,
  })

  const marks = studioPrintMarks(treatment, layout)
  const draft = {
    family,
    layoutVariant: layout,
    photoShare: geometry.photoShare,
    photoRect: geometry.photoRect,
    textColumn: geometry.textColumn,
    scrimRect: geometry.scrimRect,
    headline: repaired.headline,
    subheadline: copy.subheadline,
    hero: copy.hero,
    offerLine: copy.offerLine,
    body: fitted.body.text,
    colors,
    typePt: {
      headline: fitted.headline.fontPt,
      subhead: fitted.subhead.fontPt,
      offer: fitted.offer.fontPt,
      body: fitted.body.fontPt,
      cta: fitted.ctaPt,
      contact: fitted.contactPt,
      website: Math.max(PRINT_MIN_PT.contact, fitted.contactPt - 3),
      wordmark: PRINT_MIN_PT.wordmark,
    },
    qrInches,
    qrQuietModules: RUBRIC_QR_QUIET_MODULES,
    qrLabel,
    lockup,
    headlineWeight: 800,
    issues,
    fixes,
  }
  const qrDecodable = Boolean(qrPayload && qrPaintDecodes(qrPayload))
  const rubricInput = {
    plan: draft,
    overPhoto: family === "photo-dominant",
    headlineOverflows: fitted.headline.overflows,
    offerPaint: copy.offerPaint,
    phoneShown: Boolean(contact.phone),
    qrShown,
    qrDecodable,
    ctaShown: Boolean(collapse(input.spec.callToAction)),
    ctaBoxed: marks.ctaMark === "reverse-slug",
  }
  const rubric = scoreAPlusPostcard(rubricFacts(rubricInput))
  const measured = rubricFacts(rubricInput)
  const back = postcardBackRegions()
  const designRules = scoreDesignRules(
    designFacts({
      measured,
      plan: draft,
      offerPresent: Boolean(collapse(input.spec.offer)),
      offerPaint: copy.offerPaint,
      ctaWords: wordCount(input.spec.callToAction),
      qrPayload,
      website: contact.website,
      fullCard,
      phoneInLockup: fullCard && Boolean(contact.phone),
      urlInLockup: fullCard && Boolean(contact.website),
      lockupInsideSafe: lockup
        ? rectContains(back.safe, lockup.qrRect) &&
          rectContains(back.safe, lockup.labelRect) &&
          rectContains(back.safe, lockup.clusterRect)
        : true,
      labelOutsideQuiet: lockup ? !rectsIntersect(lockup.qrRect, lockup.labelRect) : true,
      responseCluster: lockup ? rectContains(draft.textColumn, lockup.clusterRect) : true,
      qrBesideCta: lockup ? rectContains(lockup.clusterRect, lockup.qrRect) : false,
      columnCanHoldOneInch:
        inner.w * TRIM_W - (contactBeside ? QR_CONTACT_RESERVE_IN : QR_EDGE_RESERVE_IN) + 0.001 >=
        QR_ONE_INCH,
    })
  )
  for (const check of rubric) {
    if (check.pass) continue
    issues.push(rubricIssue(check))
  }
  for (const check of designRuleFailures(designRules)) {
    if (coveredByRubric(check.id)) continue
    issues.push(designIssue(check))
  }

  return { ...draft, rubric, designRules, issues }
}

export function layoutIssueCopy(issue: LayoutIssue): string {
  switch (issue.code) {
    case "contrast":
      return "Some type still doesn't stand out from its background."
    case "overflow":
      return "Some type still doesn't fit on the card."
    case "min-size":
      return "Some type is still smaller than it should be on a postcard."
    case "photo-share":
      return "The photograph still covers less of the card than it should."
    case "qr":
      return "The QR code is missing or will not scan."
    case "lockup":
      return "The phone, website, and QR are still not one readable lockup."
    case "headline-length":
      return "The headline is still longer than eight words."
    case "hierarchy":
      return "The headline and offer are still too close to the body size."
    case "safe-zone":
      return "Some type still sits outside the safe zone."
    case "modules":
      return "The card still stacks too many boxed modules."
    case "scrim":
      return "Type still sits on the photograph without a readable panel."
    case "keep-out":
      return "Creative type still crosses the address or barcode clear zone."
  }
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

/** Points on the 8-inch card, expressed as a container-query width. */
export function pointsToCqw(points: number): string {
  const cqw = (points / 72) * (100 / TRIM_W)
  return `${cqw.toFixed(3)}cqw`
}

export function rectsIntersect(a: NormRect, b: NormRect, epsilon = 0.004): boolean {
  return (
    a.x + a.w > b.x + epsilon &&
    b.x + b.w > a.x + epsilon &&
    a.y + a.h > b.y + epsilon &&
    b.y + b.h > a.y + epsilon
  )
}

export function rectContains(outer: NormRect, inner: NormRect, epsilon = 0.004): boolean {
  return (
    inner.x >= outer.x - epsilon &&
    inner.y >= outer.y - epsilon &&
    inner.x + inner.w <= outer.x + outer.w + epsilon &&
    inner.y + inner.h <= outer.y + outer.h + epsilon
  )
}

export interface BackRegionLayout {
  safe: NormRect
  returnAddress: NormRect
  indicia: NormRect
  mailingPanel: NormRect
  barcodeStrip: NormRect
}

export function postcardBackRegions(): BackRegionLayout {
  const keepOuts = POSTCARD_5X8_V1.creativeCanvas.reservedKeepOut.rectangles
  const mailing = keepOuts.find((rect) => rect.id === "mailing_panel")
  const barcode = keepOuts.find((rect) => rect.id === "barcode_strip")
  if (!mailing || !barcode) {
    throw new Error("5×8 catalog is missing address-face keep-outs.")
  }
  return {
    safe: inches(INSET, INSET, TRIM_W - INSET * 2, TRIM_H - INSET * 2),
    returnAddress: inches(0.25, 0.28, 3.5, 1.05),
    indicia: inches(5.35, 0.28, 2.4, 0.95),
    mailingPanel: inches(
      mailing.xInches,
      mailing.yInches,
      mailing.widthInches,
      mailing.heightInches
    ),
    barcodeStrip: inches(
      barcode.xInches,
      barcode.yInches,
      barcode.widthInches,
      barcode.heightInches
    ),
  }
}

export function fitTextLine(input: {
  text: string
  widthIn: number
  heightIn: number
  minPt: number
  maxPt: number
  em?: number
  lineHeight?: number
}): FittedLine {
  const text = collapse(input.text)
  if (!text || input.widthIn <= 0 || input.heightIn <= 0) {
    return { text, fontPt: input.minPt, lines: 0, heightIn: 0, overflows: false }
  }
  const em = input.em ?? TEXT_EM
  const lineHeight = input.lineHeight ?? TEXT_LINE
  for (let pt = input.maxPt; pt >= input.minPt; pt -= 0.5) {
    const lines = wrapLines(text, pt, input.widthIn, em)
    const heightIn = blockHeight(lines.length, pt, lineHeight)
    const widest = widestLine(lines, pt, em)
    if (heightIn <= input.heightIn + 0.015 && widest <= input.widthIn + 0.015) {
      return { text, fontPt: pt, lines: lines.length, heightIn, overflows: false }
    }
  }
  const lines = wrapLines(text, input.minPt, input.widthIn, em)
  const heightIn = blockHeight(lines.length, input.minPt, lineHeight)
  const widest = widestLine(lines, input.minPt, em)
  return {
    text,
    fontPt: input.minPt,
    lines: lines.length,
    heightIn,
    overflows: heightIn > input.heightIn + 0.02 || widest > input.widthIn + 0.02,
  }
}

function rubricFacts(input: {
  plan: Omit<PostcardLayoutPlan, "rubric" | "designRules">
  overPhoto: boolean
  headlineOverflows: boolean
  offerPaint: "headline" | "line" | "subhead" | "none"
  phoneShown: boolean
  qrShown: boolean
  qrDecodable: boolean
  ctaShown: boolean
  ctaBoxed: boolean
}): Parameters<typeof scoreAPlusPostcard>[0] {
  const { plan } = input
  const headlineContrast = input.overPhoto
    ? worstCaseContrast(plan.colors.headline, plan.colors.scrim, plan.colors.scrimOpacity)
    : contrastRatio(plan.colors.headline, plan.colors.field)
  const inkContrast = input.overPhoto
    ? worstCaseContrast(plan.colors.ink, plan.colors.scrim, plan.colors.scrimOpacity)
    : contrastRatio(plan.colors.ink, plan.colors.field)
  const offerContrast =
    input.offerPaint === "none"
      ? null
      : input.offerPaint === "headline"
        ? headlineContrast
        : inkContrast
  const back = postcardBackRegions()
  const trim = { x: 0, y: 0, w: 1, h: 1 }
  const typeOnPhoto = Boolean(plan.photoRect && rectsIntersect(plan.textColumn, plan.photoRect))
  const boxed = (input.ctaShown && input.ctaBoxed ? 1 : 0) + (input.qrShown ? 1 : 0)
  return {
    headlineContrast,
    offerContrast,
    ctaContrast: !input.ctaShown
      ? null
      : input.ctaBoxed
        ? contrastRatio(plan.colors.ctaInk, plan.colors.ctaFill)
        : inkContrast,
    headlineOverflows: input.headlineOverflows,
    headlineWords: headlineWordCount(plan.hero),
    heroPhoto: Boolean(plan.photoRect),
    fullBleed: plan.photoShare >= 0.98,
    photoShare: plan.photoShare,
    headlinePt: plan.typePt.headline,
    bodyPt: plan.body ? plan.typePt.body : PRINT_MIN_PT.body,
    bodyShown: Boolean(plan.body),
    offerPt:
      input.offerPaint === "none"
        ? null
        : input.offerPaint === "headline"
          ? plan.typePt.headline
          : input.offerPaint === "line"
            ? plan.typePt.offer
            : plan.typePt.subhead,
    textInsideSafe: rectContains(back.safe, plan.textColumn),
    photoInsideTrim: !plan.photoRect || rectContains(trim, plan.photoRect),
    phoneShown: input.phoneShown,
    phonePt: plan.typePt.contact,
    qrShown: input.qrShown,
    qrDecodable: input.qrDecodable,
    qrInches: plan.qrInches,
    qrQuietModules: plan.qrQuietModules,
    boxedModules: boxed,
    typeOnPhoto,
    scrimCoversType: Boolean(plan.scrimRect && rectContains(plan.scrimRect, plan.textColumn)),
    scrimOpacity: plan.colors.scrimOpacity,
    backClear:
      !rectsIntersect(back.returnAddress, back.mailingPanel) &&
      !rectsIntersect(back.returnAddress, back.barcodeStrip) &&
      !rectsIntersect(back.indicia, back.mailingPanel) &&
      !rectsIntersect(back.indicia, back.barcodeStrip) &&
      rectContains(back.safe, back.returnAddress) &&
      rectContains(back.safe, back.indicia),
  }
}

const RUBRIC_COVERED = new Set<DesignRuleId>([
  "TP-02",
  "TP-04",
  "TP-05",
  "TP-06",
  "TP-07",
  "TP-08",
  "TP-09",
  "TP-10",
  "QR-2",
])

function coveredByRubric(id: DesignRuleId): boolean {
  return RUBRIC_COVERED.has(id)
}

function designIssue(check: DesignRuleCheck): LayoutIssue {
  return { code: "lockup", role: "contact", detail: check.detail }
}

function designFacts(input: {
  measured: ReturnType<typeof rubricFacts>
  plan: Omit<PostcardLayoutPlan, "rubric" | "designRules">
  offerPresent: boolean
  offerPaint: DesignRuleFacts["offerPaint"]
  ctaWords: number
  qrPayload: string | null
  website: string | undefined
  fullCard: boolean
  phoneInLockup: boolean
  urlInLockup: boolean
  lockupInsideSafe: boolean
  labelOutsideQuiet: boolean
  responseCluster: boolean
  qrBesideCta: boolean
  columnCanHoldOneInch: boolean
}): DesignRuleFacts {
  const { measured, plan } = input
  return {
    ctaShown: measured.ctaContrast !== null,
    ctaWords: input.ctaWords,
    headlineWords: measured.headlineWords,
    offerPresent: input.offerPresent,
    offerPaint: input.offerPaint,
    headlineContrast: measured.headlineContrast,
    offerContrast: measured.offerContrast,
    ctaContrast: measured.ctaContrast,
    headlinePt: measured.headlinePt,
    bodyPt: measured.bodyPt,
    bodyShown: measured.bodyShown,
    offerPt: measured.offerPt,
    heroPhoto: measured.heroPhoto,
    fullBleed: measured.fullBleed,
    photoShare: measured.photoShare,
    textInsideSafe: measured.textInsideSafe,
    photoInsideTrim: measured.photoInsideTrim,
    boxedModules: measured.boxedModules,
    typeOnPhoto: measured.typeOnPhoto,
    scrimCoversType: measured.scrimCoversType,
    scrimOpacity: measured.scrimOpacity,
    backClear: measured.backClear,
    responseCluster: input.responseCluster,
    qrShown: measured.qrShown,
    qrDecodable: measured.qrDecodable,
    qrInches: measured.qrInches,
    columnCanHoldOneInch: input.columnCanHoldOneInch,
    qrQuietModules: measured.qrQuietModules,
    labelPresent: Boolean(plan.qrLabel),
    labelWords: wordCount(plan.qrLabel),
    labelOutsideQuiet: input.labelOutsideQuiet,
    labelPt: QR_LABEL_PT,
    labelContrast: contrastRatio("#14120f", QR_MODULE_FIELD),
    moduleContrast: contrastRatio(QR_MODULE_INK, QR_MODULE_FIELD),
    moduleInkDarker: relativeLuminance(QR_MODULE_INK) < relativeLuminance(QR_MODULE_FIELD),
    qrBesideCta: input.qrBesideCta,
    lockupInsideSafe: input.lockupInsideSafe,
    fullCard: input.fullCard,
    phoneShown: measured.phoneShown,
    phoneInLockup: input.phoneInLockup,
    phonePt: measured.phonePt,
    urlShown: Boolean(input.website),
    urlInLockup: input.urlInLockup,
    urlPt: plan.typePt.website,
    urlMatchesQr: hostsMatch(input.website, input.qrPayload),
  }
}

function hostsMatch(website: string | undefined, payload: string | null): boolean {
  if (!payload || payload.startsWith("tel:")) return true
  if (!website) return true
  const left = hostnameOf(website)
  const right = hostnameOf(payload)
  if (!left || !right) return true
  return left === right
}

function hostnameOf(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    return new URL(withProtocol).hostname.replace(/^www\./i, "").toLowerCase()
  } catch {
    return null
  }
}

const QR_LABEL_BLOCK_IN = 0.16
const QR_LABEL_GAP_IN = 0.04

function placeLockup(column: NormRect, qrInches: number, withLabel: boolean): ContactLockup {
  const inner = innerTextBox(column)
  const qrW = qrInches / TRIM_W
  const qrH = qrInches / TRIM_H
  const labelH = withLabel ? QR_LABEL_BLOCK_IN / TRIM_H : 0
  const gapH = withLabel ? QR_LABEL_GAP_IN / TRIM_H : 0
  const qrX = Math.max(inner.x, inner.x + inner.w - qrW)
  const qrY = Math.max(inner.y, inner.y + inner.h - qrH - labelH - gapH)
  const qrRect = { x: qrX, y: qrY, w: Math.min(qrW, inner.w), h: qrH }
  const labelRect = {
    x: qrRect.x,
    y: qrRect.y + qrRect.h + gapH,
    w: qrRect.w,
    h: labelH,
  }
  const clusterRect = {
    x: inner.x,
    y: qrRect.y,
    w: inner.w,
    h: Math.max(qrRect.h, labelRect.y + labelRect.h - qrRect.y),
  }
  return { qrRect, labelRect, clusterRect }
}

function rubricIssue(check: RubricCheck): LayoutIssue {
  const role =
    check.id === "AF2" || check.id === "AF3" || check.id === "AF5"
      ? "headline"
      : check.id === "AF4" || check.id === "AF9"
        ? "photo"
        : check.id === "AF7"
          ? "contact"
          : check.id === "AF1"
            ? "cta"
            : "card"
  const code =
    check.id === "AF1"
      ? "contrast"
      : check.id === "AF2"
        ? "overflow"
        : check.id === "AF3"
          ? "headline-length"
          : check.id === "AF4"
            ? "photo-share"
            : check.id === "AF5"
              ? "hierarchy"
              : check.id === "AF6"
                ? "safe-zone"
                : check.id === "AF7"
                  ? check.detail.includes("will not scan")
                    ? "qr"
                    : "min-size"
                  : check.id === "AF8"
                    ? "modules"
                    : check.id === "AF9"
                      ? "scrim"
                      : "keep-out"
  return { code, role, detail: check.detail }
}

function displayCopy(
  spec: CreativeSpec,
  repaired: { headline: string; subheadline?: string }
): {
  hero: string
  subheadline: string
  offerLine: string
  body: string
  offerPaint: "headline" | "line" | "subhead" | "none"
} {
  const offer = collapse(spec.offer)
  const headline = repaired.headline
  const sub = collapse(repaired.subheadline)
  const hero = offer && headline && copyRestatesLead(offer, headline) ? offer : headline

  let subheadline = ""
  if (sub && !sameLine(hero, sub)) subheadline = sub

  let offerLine = ""
  let offerPaint: "headline" | "line" | "subhead" | "none" = "none"
  if (offer && sameLine(hero, offer)) {
    offerPaint = "headline"
  } else if (offer && lineInside(subheadline, offer)) {
    subheadline = removeLine(subheadline, offer)
    offerLine = offer
    offerPaint = "line"
  } else if (offer && !sameLine(subheadline, offer)) {
    offerLine = offer
    offerPaint = "line"
  }

  const body = collapse(spec.body)
  const showBody = body && !sameLine(hero, body) && !sameLine(subheadline, body)
  return {
    hero,
    subheadline,
    offerLine,
    body: showBody ? body : "",
    offerPaint,
  }
}

function sameLine(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a.toLowerCase() === b.toLowerCase()) return true
  return copyRestatesLead(a, b)
}

function lineInside(haystack: string, needle: string): boolean {
  const host = wordsOf(haystack)
  const line = wordsOf(needle)
  if (!host || !line) return false
  return host.includes(line)
}

function wordsOf(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
}

function removeLine(host: string, line: string): string {
  const pattern = line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return host
    .replace(new RegExp(pattern, "i"), " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/([.!?])(?:\s*[.!?])+/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
}

function geometryFor(
  family: LayoutFamily,
  layout: LayoutVariant,
  accent: boolean
): {
  photoShare: number
  photoRect: NormRect | null
  textColumn: NormRect
  scrimRect: NormRect | null
} {
  const safe = inches(INSET, INSET, TRIM_W - INSET * 2, TRIM_H - INSET * 2)

  if (family === "type-led" && !accent) {
    return { photoShare: 0, photoRect: null, textColumn: safe, scrimRect: null }
  }

  if (family === "type-led" && accent) {
    const photoRect = inches(5.15, 2.55, 2.85, 2.45)
    const textColumn = inches(INSET, INSET, 4.7, TRIM_H - INSET * 2)
    return {
      photoShare: photoRect.w * photoRect.h,
      photoRect,
      textColumn,
      scrimRect: null,
    }
  }

  if (family === "photo-dominant") {
    const textColumn = inches(INSET, INSET, 3.65, TRIM_H - INSET * 2)
    return {
      photoShare: 1,
      photoRect: { x: 0, y: 0, w: 1, h: 1 },
      textColumn,
      scrimRect: inches(0, 0, 6.4, TRIM_H),
    }
  }

  if (layout === "peer_split") {
    const photoRect = inches(0, 0, 4.48, TRIM_H)
    const textColumn = inches(4.6, INSET, 7.75 - 4.6, TRIM_H - INSET * 2)
    return {
      photoShare: photoRect.w * photoRect.h,
      photoRect,
      textColumn,
      scrimRect: null,
    }
  }

  const photoRect = inches(3.52, 0, TRIM_W - 3.52, TRIM_H)
  const textColumn = inches(INSET, INSET, 3.52 - INSET - 0.1, TRIM_H - INSET * 2)
  return {
    photoShare: photoRect.w * photoRect.h,
    photoRect,
    textColumn,
    scrimRect: null,
  }
}

/**
 * Soft fade from the type side into the photograph.
 * The type column stays on the opaque stop, so contrast does not depend on the photo.
 */
export function photoScrimGradient(plan: {
  colors: PostcardLayoutPlan["colors"]
  scrimRect: NormRect | null
  textColumn: NormRect
}): string | null {
  const scrim = plan.scrimRect
  if (!scrim || scrim.w <= 0) return null
  const textRight = plan.textColumn.x + plan.textColumn.w
  const hold = Math.min(scrim.x + scrim.w * 0.92, textRight + 0.02)
  const solidStop = clamp(((hold - scrim.x) / scrim.w) * 100, 36, 78)
  const midStop = Math.min(94, solidStop + 16)
  const solid = rgba(plan.colors.scrim, plan.colors.scrimOpacity)
  const mid = rgba(plan.colors.scrim, plan.colors.scrimOpacity * 0.42)
  const clear = rgba(plan.colors.scrim, 0)
  return `linear-gradient(90deg, ${solid} 0%, ${solid} ${solidStop.toFixed(1)}%, ${mid} ${midStop.toFixed(1)}%, ${clear} 100%)`
}

function resolveColors(input: {
  family: LayoutFamily
  field: string
  ink: string
  emphasis: string
  headlinePrefersEmphasis: boolean
  fixes: string[]
  issues: LayoutIssue[]
}): PostcardLayoutPlan["colors"] {
  if (input.family === "photo-dominant") {
    const scrim = repairScrim({
      preferredScrim: darkest(input.field, input.ink, input.emphasis),
      preferredInk: input.headlinePrefersEmphasis ? input.emphasis : input.ink,
    })
    if (scrim.opacity > 0.8 || scrim.scrim !== input.field) {
      input.fixes.push("Laid a gradient under the type so it stays readable over the photo.")
    }
    const cta = ctaPair(scrim.scrim, input.emphasis)
    const colors = {
      field: scrim.scrim,
      ink: scrim.ink,
      headline: scrim.ink,
      ctaFill: cta.fill,
      ctaInk: cta.ink,
      scrim: scrim.scrim,
      scrimOpacity: scrim.opacity,
    }
    noteContrast(colors, input.issues, true)
    return colors
  }

  let field = input.field
  if (input.family === "split") {
    const bold = boldestPaletteColor(input.field, input.ink, input.emphasis)
    if (
      relativeLuminance(input.field) > 0.42 &&
      relativeLuminance(bold) + 0.08 < relativeLuminance(input.field)
    ) {
      field = bold
      input.fixes.push("Set the type panel to a stronger color from the campaign palette.")
    }
  }
  let ink = readableInk(field, input.ink, HEADLINE_CONTRAST_MIN)
  const preferredHeadline = input.headlinePrefersEmphasis ? input.emphasis : ink
  let headline = readableInk(field, preferredHeadline, HEADLINE_CONTRAST_MIN)
  if (headline !== preferredHeadline) {
    input.fixes.push("Changed the headline color so it reads against the background.")
  }
  if (contrastRatio(headline, field) < HEADLINE_CONTRAST_MIN) {
    const swapped = swapField(field, input.ink, input.emphasis)
    if (swapped && contrastRatio(swapped.ink, swapped.field) >= HEADLINE_CONTRAST_MIN) {
      input.fixes.push("Swapped the palette so the headline stays readable.")
      ink = swapped.ink
      headline = swapped.ink
      const cta = ctaPair(swapped.field, input.emphasis)
      const colors = {
        field: swapped.field,
        ink,
        headline,
        ctaFill: cta.fill,
        ctaInk: cta.ink,
        scrim: swapped.field,
        scrimOpacity: 1,
      }
      noteContrast(colors, input.issues, false)
      return colors
    }
  }

  const cta = ctaPair(field, input.emphasis)
  if (cta.fill !== input.emphasis) {
    input.fixes.push("Adjusted the button color so the call to action stays readable.")
  }
  const colors = {
    field,
    ink,
    headline,
    ctaFill: cta.fill,
    ctaInk: cta.ink,
    scrim: field,
    scrimOpacity: 1,
  }
  noteContrast(colors, input.issues, false)
  return colors
}

function noteContrast(
  colors: PostcardLayoutPlan["colors"],
  issues: LayoutIssue[],
  overPhoto: boolean
): void {
  const headlineBackground = overPhoto
    ? mix(colors.scrim, "#ffffff", colors.scrimOpacity)
    : colors.field
  const headlineContrast = overPhoto
    ? worstCaseContrast(colors.headline, colors.scrim, colors.scrimOpacity)
    : contrastRatio(colors.headline, headlineBackground)
  if (headlineContrast < HEADLINE_CONTRAST_MIN) {
    issues.push({
      code: "contrast",
      role: "headline",
      detail: "The headline still misses the contrast minimum.",
    })
  }
  if (contrastRatio(colors.ctaInk, colors.ctaFill) < CTA_CONTRAST_MIN) {
    issues.push({
      code: "contrast",
      role: "cta",
      detail: "The call to action still misses the contrast minimum.",
    })
  }
}

function repairScrim(input: { preferredScrim: string; preferredInk: string }): {
  scrim: string
  ink: string
  opacity: number
} {
  const scrims = uniqueColors([input.preferredScrim, INK_DARK, "#f4f1ea", INK_LIGHT])
  const inks = uniqueColors([input.preferredInk, INK_LIGHT, INK_DARK])
  const opacities = [1, 0.94, 0.88]
  let fallback = { scrim: INK_DARK, ink: INK_LIGHT, opacity: 1, score: 0 }
  for (const opacity of opacities) {
    for (const scrim of scrims) {
      for (const ink of inks) {
        const score = worstCaseContrast(ink, scrim, opacity)
        if (score > fallback.score) fallback = { scrim, ink, opacity, score }
        if (score >= HEADLINE_CONTRAST_MIN) return { scrim, ink, opacity }
      }
    }
  }
  return { scrim: fallback.scrim, ink: fallback.ink, opacity: fallback.opacity }
}

function ctaPair(background: string, preferredFill: string): { fill: string; ink: string } {
  const fills = uniqueColors([preferredFill, INK_LIGHT, INK_DARK, "#ffffff"])
  for (const fill of fills) {
    const ink = readableInk(fill, contrastInk(fill), CTA_CONTRAST_MIN)
    if (contrastRatio(ink, fill) < CTA_CONTRAST_MIN) continue
    if (contrastRatio(fill, background) < 1.35 && contrastRatio(ink, background) < CTA_CONTRAST_MIN) {
      continue
    }
    return { fill, ink }
  }
  return { fill: INK_DARK, ink: INK_LIGHT }
}

function swapField(
  field: string,
  ink: string,
  emphasis: string
): { field: string; ink: string } | null {
  const candidates = uniqueColors([ink, emphasis, INK_DARK, INK_LIGHT, field])
  let best: { field: string; ink: string; score: number } | null = null
  for (const nextField of candidates) {
    const nextInk = readableInk(nextField, contrastInk(nextField), HEADLINE_CONTRAST_MIN)
    const score = contrastRatio(nextInk, nextField)
    if (!best || score > best.score) best = { field: nextField, ink: nextInk, score }
  }
  if (!best || best.score < HEADLINE_CONTRAST_MIN) return null
  if (best.field === field) return null
  return { field: best.field, ink: best.ink }
}

function fitStack(input: {
  hero: string
  subhead: string
  offer: string
  body: string
  widthIn: number
  heightIn: number
  showWordmark: boolean
  qrInches: number
  fixes: string[]
  issues: LayoutIssue[]
}): {
  headline: FittedLine
  subhead: FittedLine
  offer: FittedLine
  body: FittedLine
  ctaPt: number
  contactPt: number
} {
  const wordmarkH = input.showWordmark ? 0.34 : 0
  const ctaPt = PRINT_MAX_PT.cta
  const contactPt = 16
  const marksH = input.qrInches > 0 ? Math.max(1.35, input.qrInches + QR_LABEL_BLOCK_IN + QR_LABEL_GAP_IN) : 1.15
  const gap = 0.14
  let remain = Math.max(0.5, input.heightIn - wordmarkH - marksH - gap)

  const empty = (minPt: number): FittedLine => ({
    text: "",
    fontPt: minPt,
    lines: 0,
    heightIn: 0,
    overflows: false,
  })

  const subhead = input.subhead
    ? fitTextLine({
        text: input.subhead,
        widthIn: input.widthIn,
        heightIn: Math.min(0.78, remain * 0.34),
        minPt: PRINT_MIN_PT.subhead,
        maxPt: PRINT_MAX_PT.subhead,
        em: TEXT_EM,
        lineHeight: TEXT_LINE,
      })
    : empty(PRINT_MIN_PT.subhead)
  remain = Math.max(0.35, remain - subhead.heightIn)

  const offer = input.offer
    ? fitTextLine({
        text: input.offer,
        widthIn: input.widthIn,
        heightIn: Math.min(0.55, remain * 0.28),
        minPt: PRINT_MIN_PT.offer,
        maxPt: PRINT_MAX_PT.offer,
        em: TEXT_EM,
        lineHeight: TEXT_LINE,
      })
    : empty(PRINT_MIN_PT.offer)
  remain = Math.max(0.35, remain - offer.heightIn)

  const headline = fitTextLine({
    text: input.hero,
    widthIn: input.widthIn,
    heightIn: remain,
    minPt: PRINT_MIN_PT.headline,
    maxPt: PRINT_MAX_PT.headline,
    em: DISPLAY_EM,
    lineHeight: DISPLAY_LINE,
  })
  const bodyRoom = remain - headline.heightIn
  const offerCap = input.offer ? offer.fontPt / RUBRIC_OFFER_BODY_RATIO : PRINT_MAX_PT.body
  const ratioCap = Math.min(PRINT_MAX_PT.body, headline.fontPt / RUBRIC_HEADLINE_BODY_RATIO, offerCap)
  const bodyMax = Math.floor(ratioCap * 2) / 2
  let body =
    input.body && !headline.overflows && bodyRoom >= 0.5 && bodyMax + 0.001 >= PRINT_MIN_PT.body
      ? fitTextLine({
          text: input.body,
          widthIn: input.widthIn,
          heightIn: Math.min(0.62, bodyRoom),
          minPt: PRINT_MIN_PT.body,
          maxPt: bodyMax,
          em: TEXT_EM,
          lineHeight: TEXT_LINE,
        })
      : empty(PRINT_MIN_PT.body)
  if (input.body && !body.text) {
    input.fixes.push("Held the body back so the headline can stay large.")
  }
  if (body.overflows) {
    body = empty(PRINT_MIN_PT.body)
    input.fixes.push("Held the body back so the headline can stay large.")
  }

  if (headline.text && headline.fontPt < PRINT_MAX_PT.headline - 0.5) {
    input.fixes.push("Sized the headline so it fits the card.")
  }
  if (headline.overflows) {
    input.issues.push({
      code: "overflow",
      role: "headline",
      detail: "The headline still overflows its box at the smallest print size.",
    })
  }
  if (subhead.overflows) {
    input.issues.push({
      code: "overflow",
      role: "subhead",
      detail: "The subhead still overflows its box.",
    })
  }
  if (offer.overflows) {
    input.issues.push({
      code: "overflow",
      role: "offer",
      detail: "The offer still overflows its box.",
    })
  }

  return { headline, subhead, offer, body, ctaPt, contactPt }
}

function innerTextBox(column: NormRect): NormRect {
  // Matches the type column's 1.5% / 1.25% padding, which is tighter than a fixed inset on a narrow split.
  const padX = Math.max(0.04, column.w * TRIM_W * 0.015) / TRIM_W
  const padY = Math.max(0.04, column.h * TRIM_H * 0.0125) / TRIM_H
  return {
    x: column.x + padX,
    y: column.y + padY,
    w: Math.max(0.05, column.w - padX * 2),
    h: Math.max(0.05, column.h - padY * 2),
  }
}

function inches(x: number, y: number, w: number, h: number): NormRect {
  return { x: x / TRIM_W, y: y / TRIM_H, w: w / TRIM_W, h: h / TRIM_H }
}

function wrapLines(text: string, fontPt: number, widthIn: number, em: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (measure(next, fontPt, em) <= widthIn || !current) {
      current = next
      continue
    }
    lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : [text]
}

function measure(text: string, fontPt: number, em: number): number {
  return text.length * (fontPt / 72) * em
}

function widestLine(lines: string[], fontPt: number, em: number): number {
  return lines.reduce((max, line) => Math.max(max, measure(line, fontPt, em)), 0)
}

function blockHeight(lines: number, fontPt: number, lineHeight: number): number {
  // CSS line boxes and tracking run a little taller than the raw em box.
  return lines * (fontPt / 72) * lineHeight * 1.04
}

export function readableInk(background: string, preferred: string, minimum: number): string {
  if (contrastRatio(preferred, background) >= minimum) return preferred
  const dark = contrastRatio(INK_DARK, background)
  const light = contrastRatio(INK_LIGHT, background)
  const best = dark >= light ? INK_DARK : INK_LIGHT
  return contrastRatio(best, background) >= contrastRatio(preferred, background) ? best : preferred
}

function contrastInk(background: string): string {
  return relativeLuminance(background) > 0.45 ? INK_DARK : INK_LIGHT
}

function boldestPaletteColor(...colors: string[]): string {
  return uniqueColors(colors).reduce((best, color) =>
    relativeLuminance(color) < relativeLuminance(best) ? color : best
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex) ?? [20, 18, 15]
  const opacity = Math.round(alpha * 1000) / 1000
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`
}

function darkest(...colors: string[]): string {
  return colors.reduce((best, color) =>
    relativeLuminance(color) < relativeLuminance(best) ? color : best
  )
}

function worstCaseContrast(ink: string, scrim: string, opacity: number): number {
  return Math.min(
    contrastRatio(ink, mix(scrim, "#ffffff", opacity)),
    contrastRatio(ink, mix(scrim, "#000000", opacity))
  )
}

function mix(a: string, b: string, aWeight: number): string {
  const left = hexToRgb(a) ?? [20, 18, 15]
  const right = hexToRgb(b) ?? [255, 255, 255]
  const rgb = left.map((channel, index) =>
    Math.round(channel * aWeight + right[index] * (1 - aWeight))
  )
  return rgbToHex(rgb[0], rgb[1], rgb[2])
}

function uniqueColors(colors: string[]): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  for (const color of colors) {
    const key = color.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    next.push(color)
  }
  return next
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex) ?? [0, 0, 0]
  const linear = rgb.map((channel) => {
    const s = channel / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function hexToRgb(hex: string): [number, number, number] | null {
  let value = hex.trim().replace("#", "")
  if (value.length === 3) {
    value = value
      .split("")
      .map((char) => char + char)
      .join("")
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
}

function collapse(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}
