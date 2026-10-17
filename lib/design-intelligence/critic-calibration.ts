import type { GridCard } from "./grid-composer"
import { isDistinctPanel, isFloatingBox, isOpenCanvas, textColorDiffers } from "./composition-read"

interface CalibratedDraft {
  visionScore: number
  weighted: number
  autoFails: string[]
  brokenRule: string | null
  edit: string | null
}

/**
 * The Phase 2 machine critic scored a tidy panel card near 98 and let it pass.
 * Patrick reads that same card as a B-minus. This calibration is the backstop
 * when the vision model is generous, and the whole score when no key is set.
 *
 * A panel slab lands at B-minus. A floating box lands at C-plus.
 * Type on an open light ground, in two colors, with the subject cut into the
 * layout, lands at A. Contrast failures stay failures.
 */

export const LETTER_ORDER = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"] as const
export type LetterGrade = (typeof LETTER_ORDER)[number]

export const BAR_LETTER: LetterGrade = "B"

export function letterForScore(score: number, autoFails: readonly string[]): LetterGrade {
  if (autoFails.some((fail) => fail === "AF1" || fail === "AF2" || fail === "AF7" || fail === "AF10")) return "F"
  if (score >= 90) return "A"
  if (score >= 85) return "A-"
  if (score >= 80) return "B+"
  if (score >= 75) return "B"
  if (score >= 70) return "B-"
  if (score >= 65) return "C+"
  if (score >= 60) return "C"
  if (score >= 55) return "C-"
  if (score >= 50) return "D"
  return "F"
}

export function meetsBar(letter: string): boolean {
  const index = LETTER_ORDER.indexOf(letter as LetterGrade)
  const bar = LETTER_ORDER.indexOf(BAR_LETTER)
  return index >= 0 && index <= bar
}

export function calibrateCritique<T extends CalibratedDraft>(
  draft: T,
  card: GridCard
): T & { letter: LetterGrade; explanation: string; passed: boolean; visionScore: number; weighted: number } {
  let visionScore = draft.visionScore
  let weighted = draft.weighted
  const autoFails = draft.autoFails
  let explanation: string

  if (autoFails.includes("AF1")) {
    visionScore = Math.min(visionScore, 40)
    weighted = Math.min(weighted, 4)
    explanation =
      "The type fails the pixel contrast sample against the ground behind it. A loud layout does not rescue type that cannot be read. Grade: F."
  } else if (autoFails.length > 0) {
    visionScore = Math.min(visionScore, 64)
    weighted = Math.min(weighted, 6.4)
    explanation = `The card trips ${autoFails.join(", ")} before taste is allowed to lift it. Grade: ${letterForScore(visionScore, autoFails)}.`
  } else if (isFloatingBox(card)) {
    visionScore = Math.min(visionScore, 67)
    weighted = Math.min(weighted, 6.7)
    explanation =
      "The type sits in a floating card on the photograph. The pieces are neat, and they read as a template box rather than one composition. Grade: C+."
  } else if (isDistinctPanel(card)) {
    visionScore = Math.min(visionScore, 71)
    weighted = Math.min(weighted, 7.1)
    explanation =
      "The type sits in its own slab beside the photograph. Hierarchy is readable, and the headline, the offer, and the picture still read as separate boxes. Grade: B-."
  } else if (isOpenCanvas(card) && textColorDiffers(card)) {
    visionScore = Math.max(visionScore, 92)
    weighted = Math.max(weighted, 9)
    explanation =
      "The type sits on the open light ground in two colors, the offer leads, and the subject is cut into the layout instead of boxed beside a panel. Grade: A."
  } else if (isOpenCanvas(card)) {
    visionScore = Math.max(Math.min(visionScore, 84), 80)
    weighted = Math.max(weighted, 8.2)
    explanation =
      "The type sits on the open ground and the subject is part of the layout. The two colors are not yet distinct, so it stops at B+."
  } else {
    explanation = `The card is legible and does not yet have one clear composition. Grade: ${letterForScore(visionScore, autoFails)}.`
  }

  const letter = letterForScore(visionScore, autoFails.includes("AF1") ? autoFails : autoFails.length ? autoFails : [])
  const passed = autoFails.length === 0 && meetsBar(letter) && weighted >= 7.5 && visionScore >= 75
  return {
    ...draft,
    visionScore: round1(visionScore),
    weighted: round1(weighted),
    passed,
    letter,
    explanation,
    brokenRule: passed ? null : draft.brokenRule,
    edit: passed ? null : draft.edit,
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
