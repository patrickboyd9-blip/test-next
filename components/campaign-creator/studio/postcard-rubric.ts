/**
 * A+ postcard auto-fails from the design-team rubric.
 * Each check is something the layout can measure. A pass means that
 * auto-fail does not fire. The Studio still does not submit a print job.
 *
 * The source file was not readable from this environment (the public URL
 * returned 404). These thresholds are the acceptance list: AF1–AF10.
 */

export const RUBRIC_CONTRAST_MIN = 4.5
export const RUBRIC_HEADLINE_WORDS_MAX = 8
export const RUBRIC_HERO_PHOTO_MIN = 0.4
export const RUBRIC_HEADLINE_BODY_RATIO = 2.5
export const RUBRIC_OFFER_BODY_RATIO = 1.5
export const RUBRIC_PHONE_MIN_PT = 11
export const RUBRIC_QR_MIN_INCHES = 0.75
export const RUBRIC_QR_QUIET_MODULES = 4
export const RUBRIC_BOXED_MODULE_MAX = 3
export const RUBRIC_BODY_FLOOR_PT = 11
export const RUBRIC_SCRIM_MIN_OPACITY = 0.8

export const QR_STANDARD_INCHES = 1.125
export const QR_LARGE_INCHES = 1.5

export type RubricId =
  | "AF1"
  | "AF2"
  | "AF3"
  | "AF4"
  | "AF5"
  | "AF6"
  | "AF7"
  | "AF8"
  | "AF9"
  | "AF10"

export interface RubricCheck {
  id: RubricId
  pass: boolean
  detail: string
}

export interface RubricFacts {
  headlineContrast: number
  /** Null when the offer is not a separate line and is not the headline. */
  offerContrast: number | null
  /** Null when this face has no call to action. */
  ctaContrast: number | null
  headlineOverflows: boolean
  headlineWords: number
  /** False when the front has no photograph. A small accent still counts. */
  heroPhoto: boolean
  fullBleed: boolean
  photoShare: number
  headlinePt: number
  /** Size of the body line, or the 11pt floor when no body is set. */
  bodyPt: number
  bodyShown: boolean
  /** Size of the offer wherever it is painted: headline, offer line, or subhead. */
  offerPt: number | null
  textInsideSafe: boolean
  photoInsideTrim: boolean
  phoneShown: boolean
  phonePt: number
  qrShown: boolean
  qrInches: number
  qrQuietModules: number
  boxedModules: number
  typeOnPhoto: boolean
  scrimCoversType: boolean
  scrimOpacity: number
  backClear: boolean
}

export function scoreAPlusPostcard(facts: RubricFacts): RubricCheck[] {
  return [
    af1(facts),
    af2(facts),
    af3(facts),
    af4(facts),
    af5(facts),
    af6(facts),
    af7(facts),
    af8(facts),
    af9(facts),
    af10(facts),
  ]
}

export function rubricFailures(checks: RubricCheck[]): RubricCheck[] {
  return checks.filter((check) => !check.pass)
}

/** Share of the outer box used as padding on each side for a 4-module quiet zone. */
export function qrQuietPaddingRatio(modules: number, quietModules = RUBRIC_QR_QUIET_MODULES): number {
  const total = Math.max(1, modules) + quietModules * 2
  return quietModules / total
}

function af1(facts: RubricFacts): RubricCheck {
  const headlineOk = facts.headlineContrast >= RUBRIC_CONTRAST_MIN
  const offerOk = facts.offerContrast === null || facts.offerContrast >= RUBRIC_CONTRAST_MIN
  const ctaOk = facts.ctaContrast === null || facts.ctaContrast >= RUBRIC_CONTRAST_MIN
  const offer = facts.offerContrast === null ? "no separate offer" : ratio(facts.offerContrast)
  const cta = facts.ctaContrast === null ? "no button on this face" : ratio(facts.ctaContrast)
  return {
    id: "AF1",
    pass: headlineOk && offerOk && ctaOk,
    detail: `Headline ${ratio(facts.headlineContrast)}; offer ${offer}; button ${cta}.`,
  }
}

function af2(facts: RubricFacts): RubricCheck {
  return {
    id: "AF2",
    pass: !facts.headlineOverflows,
    detail: facts.headlineOverflows
      ? "The headline still overflows its box."
      : "The headline fits inside its box.",
  }
}

function af3(facts: RubricFacts): RubricCheck {
  return {
    id: "AF3",
    pass: facts.headlineWords <= RUBRIC_HEADLINE_WORDS_MAX,
    detail: `Headline is ${facts.headlineWords} words.`,
  }
}

function af4(facts: RubricFacts): RubricCheck {
  if (!facts.heroPhoto) {
    return {
      id: "AF4",
      pass: true,
      detail: "No hero photograph on this card.",
    }
  }
  if (facts.fullBleed) {
    return {
      id: "AF4",
      pass: true,
      detail: "The photograph is full bleed.",
    }
  }
  const share = Math.round(facts.photoShare * 100)
  return {
    id: "AF4",
    pass: facts.photoShare + 0.001 >= RUBRIC_HERO_PHOTO_MIN,
    detail: `The photograph covers ${share}% of the front.`,
  }
}

function af5(facts: RubricFacts): RubricCheck {
  const body = facts.bodyShown ? facts.bodyPt : RUBRIC_BODY_FLOOR_PT
  const headlineRatio = facts.headlinePt / body
  const offerRatio = facts.offerPt === null ? null : facts.offerPt / body
  const headlineOk = headlineRatio + 0.02 >= RUBRIC_HEADLINE_BODY_RATIO
  const offerOk = offerRatio === null || offerRatio + 0.02 >= RUBRIC_OFFER_BODY_RATIO
  const bodyLabel = facts.bodyShown ? `${trimPt(body)}pt body` : `${trimPt(body)}pt body floor`
  const offerLabel =
    offerRatio === null ? "no separate offer" : `offer ${trimPt(facts.offerPt ?? 0)}pt (${trimRatio(offerRatio)}×)`
  return {
    id: "AF5",
    pass: headlineOk && offerOk,
    detail: `Headline ${trimPt(facts.headlinePt)}pt is ${trimRatio(headlineRatio)}× the ${bodyLabel}; ${offerLabel}.`,
  }
}

function af6(facts: RubricFacts): RubricCheck {
  return {
    id: "AF6",
    pass: facts.textInsideSafe && facts.photoInsideTrim,
    detail: facts.textInsideSafe
      ? "Type and marks sit inside the safe zone. The photograph may bleed to the trim."
      : "Type leaves the safe zone.",
  }
}

function af7(facts: RubricFacts): RubricCheck {
  const phoneOk = !facts.phoneShown || facts.phonePt + 0.01 >= RUBRIC_PHONE_MIN_PT
  const qrOk =
    !facts.qrShown ||
    (facts.qrInches + 0.001 >= RUBRIC_QR_MIN_INCHES &&
      facts.qrQuietModules >= RUBRIC_QR_QUIET_MODULES)
  const phone = facts.phoneShown ? `phone ${trimPt(facts.phonePt)}pt` : "no phone on this face"
  const qr = facts.qrShown
    ? `QR ${facts.qrInches.toFixed(2)}in with a ${facts.qrQuietModules}-module quiet zone`
    : "no QR on this face"
  return {
    id: "AF7",
    pass: phoneOk && qrOk,
    detail: `${phone}; ${qr}.`,
  }
}

function af8(facts: RubricFacts): RubricCheck {
  return {
    id: "AF8",
    pass: facts.boxedModules <= RUBRIC_BOXED_MODULE_MAX,
    detail: `${facts.boxedModules} boxed module${facts.boxedModules === 1 ? "" : "s"} on the front. The words sit in one panel.`,
  }
}

function af9(facts: RubricFacts): RubricCheck {
  if (!facts.typeOnPhoto) {
    return {
      id: "AF9",
      pass: true,
      detail: "Type sits on a solid field, not on the photograph.",
    }
  }
  const covered = facts.scrimCoversType && facts.scrimOpacity + 0.001 >= RUBRIC_SCRIM_MIN_OPACITY
  return {
    id: "AF9",
    pass: covered,
    detail: covered
      ? `A ${Math.round(facts.scrimOpacity * 100)}% scrim sits behind the type.`
      : "Type sits on the photograph without a scrim.",
  }
}

function af10(facts: RubricFacts): RubricCheck {
  return {
    id: "AF10",
    pass: facts.backClear,
    detail: facts.backClear
      ? "Return address and indicia stay out of the address panel and the barcode strip."
      : "Creative type crosses the address panel or the barcode strip.",
  }
}

function ratio(value: number): string {
  return `${value.toFixed(1)}:1`
}

function trimPt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function trimRatio(value: number): string {
  return value.toFixed(1)
}
