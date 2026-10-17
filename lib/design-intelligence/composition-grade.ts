import type { InchRect } from "@/lib/postcard-layouts/typefit"

import type { GridCard } from "./grid-composer"
import { rectsIntersect, trimInches } from "./grid-composer"
import { gradeRank } from "./library"
import { containsZeroDollar, headlineRepeatsOffer } from "./offer-copy"
import { calibrationSentence } from "./owner-favorites"
import type { DesignRationale } from "./rationale"

/**
 * Letter grades for the phase-3 critic.
 * B is the floor that can be shown as cleared. B- and below go back or drop.
 * The bands are calibrated so a panel-style card lands at B- or C+,
 * and an integrated card (type on the open field, one floating offer) lands at A.
 */

export const LETTERS = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"] as const
export type LetterGrade = (typeof LETTERS)[number]

export const BOARD_FLOOR = "B"
/** Redundant copy, an orphaned code, or a dead band cannot clear B. */
export const CRAFT_CEILING = 81

export interface CraftFaults {
  redundantCopy: boolean
  orphaned: boolean
  deadSpace: boolean
}

export interface CompositionReading {
  panelShare: number
  typePanel: boolean
  boxed: number
  offerToHeadline: number
  photoShare: number
  calmFieldPct: number
  thumbnailRow: boolean
}

export interface CompositionGrade {
  score: number
  letter: LetterGrade
  cleared: boolean
  explanation: string
  /** "vision" only after a vision model has looked at the render. */
  scoreKind: "machine estimate" | "vision"
  hardGate: "contrast" | "legibility" | null
}

export function letterFor(score: number): LetterGrade {
  if (score >= 93) return "A"
  if (score >= 90) return "A-"
  if (score >= 87) return "B+"
  if (score >= 83) return "B"
  if (score >= 80) return "B-"
  if (score >= 77) return "C+"
  if (score >= 73) return "C"
  if (score >= 70) return "C-"
  if (score >= 60) return "D"
  return "F"
}

export function clearsBoard(letter: string): boolean {
  return gradeRank(letter) <= gradeRank(BOARD_FLOOR)
}

export function readComposition(card: GridCard, rationale: DesignRationale): CompositionReading {
  const trim = trimInches(rationale.format.trim)
  const area = trim.w * trim.h
  const panelShare = (card.panel.w * card.panel.h) / area
  const typePanel = card.front.shapes.some((shape) => {
    if (shape.role !== "type-panel") return false
    return (shape.rect.w * shape.rect.h) / area >= 0.28
  })
  const boxed = card.front.shapes.filter((shape) =>
    shape.role === "field" ||
    shape.role === "type-panel" ||
    shape.role === "offer-tile" ||
    shape.role === "coupon" ||
    shape.role === "badge" ||
    shape.role === "starburst"
  ).length
  const headline = card.typePt.headline > 0 ? card.typePt.headline : 1
  return {
    panelShare,
    typePanel,
    boxed,
    offerToHeadline: card.typePt.offer / headline,
    photoShare: card.photoAreaPct / 100,
    calmFieldPct: card.calmFieldPct,
    thumbnailRow: card.front.photos.filter((photo) => photo.treatment === "thumbnail").length >= 3
      || (rationale.grid.name === "bands" && card.panel.h / trim.h <= 0.24),
  }
}

/**
 * Geometry score for a card we composed.
 * A full-height type panel keeps the card in the B- / C+ band even when the
 * offer is large. Type sitting on the open field, with a floating offer, can reach A.
 */
export function scoreComposition(reading: CompositionReading): number {
  let score = 82
  if (reading.typePanel && reading.panelShare >= 0.32) score -= 4
  if (reading.boxed >= 3) score -= 5
  if (reading.boxed >= 5) score -= 4
  if (reading.offerToHeadline >= 1.55) score += 3
  if (reading.offerToHeadline >= 1.8 && !reading.typePanel) score += 8
  if (!reading.typePanel) score += 12
  if (reading.photoShare >= 0.55) score += 2
  if (reading.calmFieldPct >= 40 && !reading.typePanel) score += 3
  if (reading.thumbnailRow && reading.boxed <= 2) score += 4
  if (reading.boxed <= 1 && !reading.typePanel) score += 3
  return clamp(score)
}

/**
 * The pattern Patrick described, and the panel pattern we are leaving.
 * Used to calibrate the critic and to anchor the vision prompt.
 */
export function scoreDesignPattern(pattern: {
  typeOnCanvas: boolean
  floatingOffer: boolean
  cutoutSubject: boolean
  singleThumbnailRow: boolean
  boxedModules: number
  panelHoldsAllType: boolean
}): number {
  let score = 88
  if (pattern.typeOnCanvas) score += 4
  if (pattern.floatingOffer) score += 6
  if (pattern.cutoutSubject) score += 3
  if (pattern.singleThumbnailRow && pattern.boxedModules <= 1) score += 4
  if (pattern.panelHoldsAllType) score -= 8
  if (!pattern.typeOnCanvas && !pattern.floatingOffer) score -= 2
  if (pattern.boxedModules >= 3) score -= 4
  if (pattern.boxedModules >= 5) score -= 6
  return clamp(score)
}

/** Reads a written mailer note the way the critic reads a reference, without looking at pixels. */
export function scoreReferenceWriteup(text: string, gradeHint?: string): number {
  const hay = text.toLowerCase()
  let score = 82
  if (/full-bleed|full bleed|on the canvas|open field/.test(hay)) score += 4
  if (/far larger than the (short )?headline|hero-numeral|at or above 1\.6/.test(hay)) score += 6
  if (/one phone/.test(hay) && /one offer/.test(hay)) score += 3
  if (/price rail|price column|scallop|three prices|nearly equal|badge row/.test(hay)) score -= 14
  if (/official notice|eagle|great seal/.test(hay)) score -= 18
  if (gradeHint === "A") score += 3
  if (gradeHint === "A-") score += 2
  return clamp(score)
}

export function craftFaults(card: GridCard): CraftFaults {
  const headline = card.front.texts.filter((text) => text.role === "headline").map((text) => text.text).join(" ")
  const offerLine = card.front.texts.find((text) => text.role === "offer")?.text ?? ""
  const rest = card.front.texts.find((text) => text.role === "body")?.text ?? ""
  const offer = [offerLine, rest].filter(Boolean).join(" ")
  const painted = card.front.texts.map((text) => text.text).join(" ")
  const qr = card.front.lockup?.qrRect
  const phone = card.front.lockup?.phone?.rect
  const website = card.front.lockup?.website?.rect
  const subject = card.front.photos.find((photo) => photo.treatment === "cutout")?.rect
  const thumbTop = card.front.photos.find((photo) => photo.treatment === "thumbnail")?.rect.y
    ?? trimInches(card.front.size).h - 0.25
  const bands = [
    ...card.front.texts.map((text) => text.rect),
    ...(qr ? [qr] : []),
    ...(phone ? [phone] : []),
    ...(website ? [website] : []),
  ]
  return judgeCraft({
    headline,
    offer,
    painted,
    qr,
    phone,
    website,
    subject,
    bands,
    thumbTop,
  })
}

export function judgeCraft(input: {
  headline: string
  offer: string
  painted?: string
  qr?: InchRect | null
  phone?: InchRect | null
  website?: InchRect | null
  subject?: InchRect | null
  bands: InchRect[]
  thumbTop: number
}): CraftFaults {
  const painted = input.painted ?? `${input.headline} ${input.offer}`
  return {
    redundantCopy: containsZeroDollar(painted) || headlineRepeatsOffer(input.headline, input.offer),
    orphaned: responseIsOrphaned(input.qr, input.phone, input.website, input.subject),
    deadSpace: hasDeadBand(input.bands, input.thumbTop),
  }
}

function responseIsOrphaned(
  qr: InchRect | null | undefined,
  phone: InchRect | null | undefined,
  website: InchRect | null | undefined,
  subject: InchRect | null | undefined
): boolean {
  if (!qr) return false
  if (!phone) return true
  if (subject && rectsIntersect(qr, subject)) return true
  const withPhone = near(qr, phone, 0.22)
  const withSite = website ? near(qr, website, 0.22) : true
  const siteWithPhone = website ? near(website, phone, 0.16) : true
  return !(withPhone || (withSite && siteWithPhone))
}

function near(a: InchRect, b: InchRect, gap: number): boolean {
  const gapX = a.x + a.w <= b.x ? b.x - (a.x + a.w) : b.x + b.w <= a.x ? a.x - (b.x + b.w) : 0
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const gapY = a.y + a.h <= b.y ? b.y - (a.y + a.h) : b.y + b.h <= a.y ? a.y - (b.y + b.h) : 0
  if (overlapY > 0 && gapX <= gap) return true
  if (overlapX > 0 && gapY <= gap) return true
  return gapX <= gap && gapY <= gap
}

function hasDeadBand(bands: InchRect[], thumbTop: number): boolean {
  const occupied = bands
    .filter((band) => band.h > 0 && band.y < thumbTop)
    .sort((a, b) => a.y - b.y)
  if (occupied.length < 2) return false
  let cursor = occupied[0]!.y + occupied[0]!.h
  let hole = 0
  for (const band of occupied.slice(1)) {
    if (band.y > cursor + 0.02) hole = Math.max(hole, band.y - cursor)
    cursor = Math.max(cursor, band.y + band.h)
  }
  return hole > 0.95
}

export function gradeComposition(input: {
  card: GridCard
  rationale: DesignRationale
  autoFails: string[]
  worstContrast: number
  vision?: { score: number; explanation: string } | null
}): CompositionGrade {
  const reading = readComposition(input.card, input.rationale)
  let score = scoreComposition(reading)
  const hardGate = hardGateFor(input.autoFails, input.worstContrast)
  if (hardGate) score = Math.min(score, 72)
  let explanation = machineExplanation(reading, score)
  let scoreKind: CompositionGrade["scoreKind"] = "machine estimate"
  if (input.vision && Number.isFinite(input.vision.score)) {
    scoreKind = "vision"
    const capped = reading.typePanel && reading.panelShare >= 0.32
      ? Math.min(input.vision.score, 81)
      : input.vision.score
    score = hardGate ? Math.min(capped, 72) : capped
    explanation = input.vision.explanation.trim() || explanation
    if (capped < input.vision.score) {
      explanation = `${explanation} Held at ${letterFor(capped)} because the type still sits in a panel.`
    }
  }
  const craft = craftFaults(input.card)
  if (craft.redundantCopy || craft.orphaned || craft.deadSpace) {
    score = Math.min(score, CRAFT_CEILING)
    const reasons = [
      craft.redundantCopy ? "the offer is repeated in the headline" : "",
      craft.orphaned ? "the code sits apart from the phone and the URL" : "",
      craft.deadSpace ? "a band of the card is left empty" : "",
    ].filter(Boolean)
    explanation = `${explanation} Held at ${letterFor(score)} because ${reasons.join(", ")}.`
  }
  score = clamp(score)
  const letter = letterFor(score)
  return {
    score,
    letter,
    cleared: !hardGate && clearsBoard(letter),
    explanation,
    scoreKind,
    hardGate,
  }
}

function hardGateFor(autoFails: string[], worstContrast: number): CompositionGrade["hardGate"] {
  if (worstContrast < 4.5 || autoFails.includes("AF1")) return "contrast"
  if (autoFails.includes("AF2") || autoFails.includes("AF6")) return "legibility"
  return null
}

function machineExplanation(reading: CompositionReading, score: number): string {
  const letter = letterFor(score)
  if (reading.typePanel && reading.panelShare >= 0.32) {
    return `Machine estimate. ${letter}. The type sits in a panel covering about ${Math.round(reading.panelShare * 100)}% of the card, so it reads as a template. The offer is ${reading.offerToHeadline.toFixed(2)}× the headline.`
  }
  return `Machine estimate. ${letter}. Type is on the open field, the offer is ${reading.offerToHeadline.toFixed(2)}× the headline, and boxed modules are ${reading.boxed}.`
}

function clamp(score: number): number {
  return Math.max(40, Math.min(98, Math.round(score)))
}

export function visionGradeAnchor(env: NodeJS.ProcessEnv = process.env): string {
  return [
    "Calibration, from looking at mail, not from copying it.",
    "A looks like this: a light ground, a two-color headline set directly on the canvas, a cut-out subject integrated into the layout, one large floating offer in the brand color, and at most one row of small thumbnails. Boxes are the exception. The eye moves without jumping between frames.",
    "B- or C+ looks like this: a side or bottom panel holds all the type, the offer is close to the headline in size, and the card is a stack of boxes. It is organized and legible, and it still reads as a template.",
    "A panel-style card is not an A. Do not reward it for being tidy.",
    "Repeating the offer in the headline and the lockup is at most a B-. A free offer is the word FREE, never a $0 figure, and the headline then has to say something else.",
    "A code that floats away from the phone and the URL, or a band of the card left empty between the type, is at most a B-.",
    calibrationSentence(env),
    "Type on a photograph sits on a calm patch of sky or wall. It does not sit on a face, a person, or a ladder. Small type under 14pt needs 7:1. A stock portrait, or a cluttered background behind the type, is a weakness.",
    "Contrast below 4.5:1, or below 7:1 for type under 14pt, or type that overflows, is a hard fail regardless of the composition.",
  ].join(" ")
}

export const VISION_GRADE_ANCHOR = visionGradeAnchor()
