/**
 * Tight principles (TP-01–TP-12) and the QR/contact lockup (QR-1–QR-12).
 *
 * The design notes live in
 * patrickboyd9-blip/modern-mail-creative-design-intelligence:
 * notes/principles-tight.md and notes/qr-contact-lockups.md.
 * That repository returned 404 from this environment, including the
 * commits that correct Click2Mail geometry (8cd679e and 8325602).
 * Those commits set bleed and the safe zone to 0.25 in. This module
 * keeps that geometry and the lockup the notes are for: size, quiet
 * zone, label, placement beside the call to action, and contrast.
 *
 * A hard rule can fail a card. A warning is reported and does not.
 * A prompt rule is told to the creative engine. Guidance is for a person.
 */

import {
  RUBRIC_BODY_FLOOR_PT,
  RUBRIC_BOXED_MODULE_MAX,
  RUBRIC_CONTRAST_MIN,
  RUBRIC_HEADLINE_BODY_RATIO,
  RUBRIC_HEADLINE_WORDS_MAX,
  RUBRIC_HERO_PHOTO_MIN,
  RUBRIC_OFFER_BODY_RATIO,
  RUBRIC_PHONE_MIN_PT,
  RUBRIC_QR_MIN_INCHES,
  RUBRIC_QR_QUIET_MODULES,
  RUBRIC_SCRIM_MIN_OPACITY,
} from "./postcard-rubric"

export const QR_ONE_INCH = 1
export const QR_LABEL_PT = 8
export const QR_LABEL_MAX_WORDS = 4
export const QR_MODULE_INK = "#111111"
export const QR_MODULE_FIELD = "#ffffff"
/** Phone or URL column plus the gap before the code. */
export const QR_CONTACT_RESERVE_IN = 1.67
export const QR_EDGE_RESERVE_IN = 0.04

export type DesignRuleId =
  | "TP-01"
  | "TP-02"
  | "TP-03"
  | "TP-04"
  | "TP-05"
  | "TP-06"
  | "TP-07"
  | "TP-08"
  | "TP-09"
  | "TP-10"
  | "TP-11"
  | "TP-12"
  | "QR-1"
  | "QR-2"
  | "QR-3"
  | "QR-4"
  | "QR-5"
  | "QR-6"
  | "QR-7"
  | "QR-8"
  | "QR-9"
  | "QR-10"
  | "QR-11"
  | "QR-12"

export type RuleDisposition = "hard" | "warn" | "prompt" | "guidance"

export interface DesignRuleCheck {
  id: DesignRuleId
  disposition: RuleDisposition
  /** Null when this rule is not measured on a card. */
  pass: boolean | null
  detail: string
}

export interface DesignRuleFacts {
  ctaShown: boolean
  ctaWords: number
  headlineWords: number
  offerPresent: boolean
  offerPaint: "headline" | "line" | "subhead" | "none"
  headlineContrast: number
  offerContrast: number | null
  ctaContrast: number | null
  headlinePt: number
  bodyPt: number
  bodyShown: boolean
  offerPt: number | null
  heroPhoto: boolean
  fullBleed: boolean
  photoShare: number
  textInsideSafe: boolean
  photoInsideTrim: boolean
  boxedModules: number
  typeOnPhoto: boolean
  scrimCoversType: boolean
  scrimOpacity: number
  backClear: boolean
  responseCluster: boolean
  qrShown: boolean
  qrDecodable: boolean
  qrInches: number
  /** True when the type column can hold a 1 in code beside the contact lines. */
  columnCanHoldOneInch: boolean
  qrQuietModules: number
  labelPresent: boolean
  labelWords: number
  labelOutsideQuiet: boolean
  labelPt: number
  labelContrast: number
  moduleContrast: number
  moduleInkDarker: boolean
  qrBesideCta: boolean
  lockupInsideSafe: boolean
  /** Full card, not the compare thumbnail that hides the contact lines. */
  fullCard: boolean
  phoneShown: boolean
  phoneInLockup: boolean
  phonePt: number
  urlShown: boolean
  urlInLockup: boolean
  urlPt: number
  urlMatchesQr: boolean
}

export const DESIGN_RULE_CATALOG: readonly {
  id: DesignRuleId
  disposition: RuleDisposition
  statement: string
}[] = [
  {
    id: "TP-01",
    disposition: "warn",
    statement: "One call to action, six words or fewer.",
  },
  {
    id: "TP-02",
    disposition: "hard",
    statement: "The headline is eight words or fewer.",
  },
  {
    id: "TP-03",
    disposition: "warn",
    statement: "The offer is the headline or the line directly under it.",
  },
  {
    id: "TP-04",
    disposition: "hard",
    statement: "The headline is at least 2.5× the body, and the offer at least 1.5×.",
  },
  {
    id: "TP-05",
    disposition: "hard",
    statement: "A photograph covers at least 40% of the front, or the card has no photograph.",
  },
  {
    id: "TP-06",
    disposition: "hard",
    statement: "Headline, offer, and call to action clear 4.5:1 contrast.",
  },
  {
    id: "TP-07",
    disposition: "hard",
    statement: "Type stays a quarter inch inside the trim.",
  },
  {
    id: "TP-08",
    disposition: "hard",
    statement: "The words sit in one field, not a stack of four boxed modules.",
  },
  {
    id: "TP-09",
    disposition: "hard",
    statement: "Type on a photograph sits on a scrim.",
  },
  {
    id: "TP-10",
    disposition: "hard",
    statement: "The return address and indicia stay out of the address panel and the barcode strip.",
  },
  {
    id: "TP-11",
    disposition: "hard",
    statement: "Phone, website, and QR are one cluster with the call to action.",
  },
  {
    id: "TP-12",
    disposition: "guidance",
    statement: "The card should feel like paper, not a software screen. The model is told this. A person still judges it.",
  },
  {
    id: "QR-1",
    disposition: "hard",
    statement: "The QR is at least 1 inch when the column can hold it, and never under 0.75 inch.",
  },
  {
    id: "QR-2",
    disposition: "hard",
    statement: "The quiet zone is four modules on every side.",
  },
  {
    id: "QR-3",
    disposition: "hard",
    statement: "The scan label sits outside the quiet zone.",
  },
  {
    id: "QR-4",
    disposition: "hard",
    statement: "The modules are dark on a white field, at 4.5:1 or better.",
  },
  {
    id: "QR-5",
    disposition: "hard",
    statement: "The code is not reversed. Dark modules, light field.",
  },
  {
    id: "QR-6",
    disposition: "hard",
    statement: "A short scan label sits with the code.",
  },
  {
    id: "QR-7",
    disposition: "hard",
    statement: "The scan label clears 4.5:1 against its plate.",
  },
  {
    id: "QR-8",
    disposition: "hard",
    statement: "The scan label is at least 8 points.",
  },
  {
    id: "QR-9",
    disposition: "hard",
    statement: "The QR sits in the same cluster as the call to action.",
  },
  {
    id: "QR-10",
    disposition: "hard",
    statement: "The whole lockup stays inside the quarter-inch safe zone.",
  },
  {
    id: "QR-11",
    disposition: "hard",
    statement: "The phone and the website sit in the lockup, at least 11 points.",
  },
  {
    id: "QR-12",
    disposition: "warn",
    statement: "A URL code matches the website printed beside it, and the symbol scans.",
  },
]

const DISPOSITION = new Map(DESIGN_RULE_CATALOG.map((rule) => [rule.id, rule.disposition]))

export function scoreDesignRules(facts: DesignRuleFacts): DesignRuleCheck[] {
  return [
    tp01(facts),
    tp02(facts),
    tp03(facts),
    tp04(facts),
    tp05(facts),
    tp06(facts),
    tp07(facts),
    tp08(facts),
    tp09(facts),
    tp10(facts),
    tp11(facts),
    tp12(),
    qr1(facts),
    qr2(facts),
    qr3(facts),
    qr4(facts),
    qr5(facts),
    qr6(facts),
    qr7(facts),
    qr8(facts),
    qr9(facts),
    qr10(facts),
    qr11(facts),
    qr12(facts),
  ]
}

export function designRuleFailures(checks: DesignRuleCheck[]): DesignRuleCheck[] {
  return checks.filter((check) => check.pass === false && check.disposition === "hard")
}

export function designRuleWarnings(checks: DesignRuleCheck[]): DesignRuleCheck[] {
  return checks.filter((check) => check.pass === false && check.disposition === "warn")
}

/** Largest code that fits the column, preferring the requested size. */
export function fitQrInches(requested: number, columnWidthIn: number, reserveIn: number): number {
  const room = columnWidthIn - reserveIn
  const floor = room + 0.001 >= QR_ONE_INCH ? QR_ONE_INCH : RUBRIC_QR_MIN_INCHES
  const fitted = Math.min(requested, Math.max(room, floor))
  const target = Math.max(floor, fitted)
  const snapped = Math.floor(target * 1000 + 1e-6) / 1000
  return Math.max(RUBRIC_QR_MIN_INCHES, Math.min(requested, snapped))
}

/** Short line under the code. Never a second offer. */
export function qrScanLabel(callToAction: string | undefined): string {
  const words = (callToAction ?? "").replace(/\s+/g, " ").trim().toLowerCase()
  if (/\bcall\b/.test(words)) return "Scan to call"
  if (/\b(book|schedule|reserve)\b/.test(words)) return "Scan to book"
  return "Scan"
}

export function wordCount(value: string | undefined): number {
  const words = (value ?? "").trim().split(/\s+/).filter(Boolean)
  return words.length
}

function rule(
  id: DesignRuleId,
  pass: boolean | null,
  detail: string
): DesignRuleCheck {
  return { id, disposition: DISPOSITION.get(id) ?? "hard", pass, detail }
}

function tp01(facts: DesignRuleFacts): DesignRuleCheck {
  const pass = !facts.ctaShown || facts.ctaWords <= 6
  return rule(
    "TP-01",
    pass,
    facts.ctaShown ? `Call to action is ${facts.ctaWords} words.` : "No call to action on this face."
  )
}

function tp02(facts: DesignRuleFacts): DesignRuleCheck {
  return rule("TP-02", facts.headlineWords <= RUBRIC_HEADLINE_WORDS_MAX, `Headline is ${facts.headlineWords} words.`)
}

function tp03(facts: DesignRuleFacts): DesignRuleCheck {
  if (!facts.offerPresent) {
    return rule("TP-03", true, "No offer on this card.")
  }
  const pass = facts.offerPaint !== "none"
  return rule(
    "TP-03",
    pass,
    pass ? `The offer is painted as the ${facts.offerPaint}.` : "The offer is not in the headline or the line under it."
  )
}

function tp04(facts: DesignRuleFacts): DesignRuleCheck {
  const body = facts.bodyShown ? facts.bodyPt : RUBRIC_BODY_FLOOR_PT
  const headlineRatio = facts.headlinePt / body
  const offerRatio = facts.offerPt === null ? null : facts.offerPt / body
  const headlineOk = headlineRatio + 0.02 >= RUBRIC_HEADLINE_BODY_RATIO
  const offerOk = offerRatio === null || offerRatio + 0.02 >= RUBRIC_OFFER_BODY_RATIO
  return rule(
    "TP-04",
    headlineOk && offerOk,
    `Headline is ${headlineRatio.toFixed(1)}× the body.`
  )
}

function tp05(facts: DesignRuleFacts): DesignRuleCheck {
  if (!facts.heroPhoto) return rule("TP-05", true, "No photograph on this card.")
  if (facts.fullBleed) return rule("TP-05", true, "The photograph is full bleed.")
  return rule(
    "TP-05",
    facts.photoShare + 0.001 >= RUBRIC_HERO_PHOTO_MIN,
    `The photograph covers ${Math.round(facts.photoShare * 100)}% of the front.`
  )
}

function tp06(facts: DesignRuleFacts): DesignRuleCheck {
  const headlineOk = facts.headlineContrast >= RUBRIC_CONTRAST_MIN
  const offerOk = facts.offerContrast === null || facts.offerContrast >= RUBRIC_CONTRAST_MIN
  const ctaOk = facts.ctaContrast === null || facts.ctaContrast >= RUBRIC_CONTRAST_MIN
  return rule("TP-06", headlineOk && offerOk && ctaOk, `Headline contrast ${facts.headlineContrast.toFixed(1)}:1.`)
}

function tp07(facts: DesignRuleFacts): DesignRuleCheck {
  return rule(
    "TP-07",
    facts.textInsideSafe && facts.photoInsideTrim,
    facts.textInsideSafe ? "Type sits inside the quarter-inch safe zone." : "Type leaves the safe zone."
  )
}

function tp08(facts: DesignRuleFacts): DesignRuleCheck {
  return rule("TP-08", facts.boxedModules <= RUBRIC_BOXED_MODULE_MAX, `${facts.boxedModules} boxed modules.`)
}

function tp09(facts: DesignRuleFacts): DesignRuleCheck {
  if (!facts.typeOnPhoto) return rule("TP-09", true, "Type sits on a solid field.")
  const covered = facts.scrimCoversType && facts.scrimOpacity + 0.001 >= RUBRIC_SCRIM_MIN_OPACITY
  return rule("TP-09", covered, covered ? "A scrim sits behind the type." : "Type sits on the photograph without a scrim.")
}

function tp10(facts: DesignRuleFacts): DesignRuleCheck {
  return rule(
    "TP-10",
    facts.backClear,
    facts.backClear ? "Address and barcode zones stay clear." : "Creative type crosses a mailing keep-out."
  )
}

function tp11(facts: DesignRuleFacts): DesignRuleCheck {
  const needed = facts.phoneShown || facts.urlShown || facts.qrShown
  return rule(
    "TP-11",
    !needed || facts.responseCluster,
    facts.responseCluster ? "The response path is one cluster." : "The response path is split across the card."
  )
}

function tp12(): DesignRuleCheck {
  return rule("TP-12", null, "Guidance for a person. The creative engine is also told to keep paper, not a software screen.")
}

function noQr(id: DesignRuleId): DesignRuleCheck {
  return rule(id, true, "No QR on this face.")
}

function qr1(facts: DesignRuleFacts): DesignRuleCheck {
  if (!facts.qrShown) return noQr("QR-1")
  const floor = facts.columnCanHoldOneInch ? QR_ONE_INCH : RUBRIC_QR_MIN_INCHES
  return rule("QR-1", facts.qrInches + 0.001 >= floor, `QR is ${facts.qrInches.toFixed(2)} in. The floor here is ${floor.toFixed(2)} in.`)
}

function qr2(facts: DesignRuleFacts): DesignRuleCheck {
  if (!facts.qrShown) return noQr("QR-2")
  return rule(
    "QR-2",
    facts.qrQuietModules >= RUBRIC_QR_QUIET_MODULES,
    `Quiet zone is ${facts.qrQuietModules} modules.`
  )
}

function qr3(facts: DesignRuleFacts): DesignRuleCheck {
  if (!facts.qrShown) return noQr("QR-3")
  return rule(
    "QR-3",
    facts.labelOutsideQuiet,
    facts.labelOutsideQuiet ? "The label sits outside the quiet zone." : "The label crosses the quiet zone."
  )
}

function qr4(facts: DesignRuleFacts): DesignRuleCheck {
  if (!facts.qrShown) return noQr("QR-4")
  return rule("QR-4", facts.moduleContrast >= RUBRIC_CONTRAST_MIN, `Module contrast ${facts.moduleContrast.toFixed(1)}:1.`)
}

function qr5(facts: DesignRuleFacts): DesignRuleCheck {
  if (!facts.qrShown) return noQr("QR-5")
  return rule(
    "QR-5",
    facts.moduleInkDarker,
    facts.moduleInkDarker ? "Dark modules on a light field." : "The code is reversed."
  )
}

function qr6(facts: DesignRuleFacts): DesignRuleCheck {
  if (!facts.qrShown) return noQr("QR-6")
  const pass = facts.labelPresent && facts.labelWords >= 1 && facts.labelWords <= QR_LABEL_MAX_WORDS
  return rule("QR-6", pass, pass ? `Label is ${facts.labelWords} words.` : "The scan label is missing or too long.")
}

function qr7(facts: DesignRuleFacts): DesignRuleCheck {
  if (!facts.qrShown) return noQr("QR-7")
  return rule("QR-7", facts.labelContrast >= RUBRIC_CONTRAST_MIN, `Label contrast ${facts.labelContrast.toFixed(1)}:1.`)
}

function qr8(facts: DesignRuleFacts): DesignRuleCheck {
  if (!facts.qrShown) return noQr("QR-8")
  return rule("QR-8", facts.labelPt + 0.01 >= QR_LABEL_PT, `Label is ${facts.labelPt} pt.`)
}

function qr9(facts: DesignRuleFacts): DesignRuleCheck {
  if (!facts.qrShown) return noQr("QR-9")
  if (!facts.ctaShown) return rule("QR-9", true, "No call to action on this face. The QR stays in the response cluster.")
  return rule(
    "QR-9",
    facts.qrBesideCta,
    facts.qrBesideCta ? "The QR sits with the call to action." : "The QR is away from the call to action."
  )
}

function qr10(facts: DesignRuleFacts): DesignRuleCheck {
  if (!facts.qrShown && !facts.phoneShown && !facts.urlShown) {
    return rule("QR-10", true, "No response lockup on this face.")
  }
  return rule(
    "QR-10",
    facts.lockupInsideSafe,
    facts.lockupInsideSafe ? "The lockup sits inside the safe zone." : "The lockup leaves the safe zone."
  )
}

function qr11(facts: DesignRuleFacts): DesignRuleCheck {
  if (!facts.fullCard) return rule("QR-11", true, "Contact lines are held off the thumbnail.")
  const phoneOk = !facts.phoneShown || (facts.phoneInLockup && facts.phonePt + 0.01 >= RUBRIC_PHONE_MIN_PT)
  const urlOk = !facts.urlShown || (facts.urlInLockup && facts.urlPt + 0.01 >= RUBRIC_PHONE_MIN_PT)
  return rule(
    "QR-11",
    phoneOk && urlOk,
    `Phone ${facts.phoneShown ? `${facts.phonePt} pt` : "off"}; website ${facts.urlShown ? `${facts.urlPt} pt` : "off"}.`
  )
}

function qr12(facts: DesignRuleFacts): DesignRuleCheck {
  if (!facts.qrShown) return noQr("QR-12")
  const pass = facts.qrDecodable && facts.urlMatchesQr
  const detail = !facts.qrDecodable
    ? "The QR will not scan."
    : facts.urlMatchesQr
      ? "The code matches the printed website."
      : "The printed website is a different site than the code."
  return rule("QR-12", pass, detail)
}
