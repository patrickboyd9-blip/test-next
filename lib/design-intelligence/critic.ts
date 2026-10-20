import type { PostcardFacePlan } from "@/lib/postcard-layouts/compose"
import type { InchRect } from "@/lib/postcard-layouts/typefit"
import { addressSideContentRect, rectsOverlap } from "@/lib/print-spec/address-side-content"
import {
  buildPostcard5x8PrintSpec,
  type InchesRect,
} from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"

import { measureBackdropContrast, type ContrastPhoto } from "./backdrop"
import { normalizedPanel, textInsideSafe, textIsClipped, type GridCard } from "./grid-composer"
import { checkPersuasion } from "./persuasion"
import type { DesignRationale, GridName } from "./rationale"

/**
 * Machine half of the A+ rubric. Auto-fails first, then D1–D6 and the
 * vision rows V1–V13 scored from the same geometry. A vision model may
 * replace the V scores later. One structural edit is returned.
 */

export const VISION_PASS = 80
export const WEIGHTED_PASS = 8
export const CRITIC_ROUND_CAP = 3

const GOVERNMENT =
  /\bofficial notice\b|\bfinal notice\b|\bofficial business\b|\brespond within\b|\bact now\b|\byou qualify\b|\bentitled\b|\bgreat seal\b|\beagle\b/i

export interface Critique {
  autoFails: string[]
  dimensions: Record<"D1" | "D2" | "D3" | "D4" | "D5" | "D6", number>
  weighted: number
  vision: Record<string, number>
  visionScore: number
  passed: boolean
  edit: string | null
  brokenRule: string | null
  /** "vision" only after the vision critic has scored this card. */
  scoreKind: "machine estimate" | "vision"
}

const VISION_WEIGHTS: Record<string, number> = {
  V1: 10, V2: 12, V3: 6, V4: 8, V5: 6, V6: 8, V7: 6, V8: 6, V9: 8, V10: 10, V11: 8, V12: 6, V13: 6,
}

export function critiqueCard(
  card: GridCard,
  rationale: DesignRationale,
  copy: string,
  photo?: ContrastPhoto | null,
  clientText = ""
): Critique {
  const autoFails: string[] = []
  const size = rationale.format.trim
  const headline = combinedText(card.front, "headline")
  const offer = textByRole(card.front, "offer")
  const phone = card.front.lockup?.phone
  const words = (headline?.text ?? "").split(/\s+/).filter(Boolean)

  const backdrop = measureBackdropContrast(card, photo)
  const worstContrast = backdrop.worst
  if (worstContrast < 4.5 || backdrop.smallFailing.length > 0) autoFails.push("AF1")
  if (card.front.overflows || card.back.overflows || clippedCopy(card) || words.some((word) => word.includes("-") && word.length > 12)) autoFails.push("AF2")
  if (words.length > 8) autoFails.push("AF3")
  if (card.photoAreaPct < 40 && rationale.photo_brief.placement !== "none") autoFails.push("AF4")
  const body = rationale.format.trim === "6x9" ? 12 : 11
  if ((headline?.fontPt ?? 0) < body * 2.5 - 0.6 || (offer?.fontPt ?? 0) < body * 1.5 - 0.6) autoFails.push("AF5")
  for (const text of liveTexts(card.front)) {
    if (!textInsideSafe(text.rect, size)) autoFails.push("AF6")
  }
  if (card.front.lockup && !textInsideSafe(card.front.lockup.rect, size)) autoFails.push("AF6")
  const phonePt = phone?.fontPt ?? 0
  const phoneFloor = size === "6x9" ? 14 : 12
  if (!phone?.text || phonePt < phoneFloor || (card.front.lockup?.qrInches ?? 0) < 0.75 || card.front.lockup?.qrLabel !== "Scan to book") {
    autoFails.push("AF7")
  }
  const boxed = card.front.shapes.filter((shape) => shape.role === "field" || shape.role === "type-panel" || shape.role === "offer-tile" || shape.role === "coupon" || shape.role === "badge" || shape.role === "starburst")
  const bursts = card.front.shapes.filter((shape) => shape.role === "starburst")
  if (boxed.length >= 4 || bursts.length > 1) autoFails.push("AF8")
  if (backViolatesKeepOut(card)) autoFails.push("AF10")
  if (GOVERNMENT.test(copy) || (rationale.vertical === "medicare_insurance" && rationale.palette.emotion !== "compliance_calm")) {
    autoFails.push("AF8")
  }
  const standouts = card.front.shapes.filter((shape) =>
    shape.role === "offer-tile" || shape.role === "coupon" || shape.role === "badge" || shape.role === "starburst"
  ).length
  for (const finding of checkPersuasion({
    headline: headline?.text ?? "",
    copy,
    clientText,
    vertical: rationale.vertical,
    standoutCount: standouts,
  })) {
    if (finding.ok || finding.id === "government") continue
    const code = PERSUASION_CODES[finding.id]
    if (code) autoFails.push(code)
  }
  if (rationale.vertical === "medicare_insurance" && /\$\s?\d/.test(copy) && rationale.offer_treatment.kind !== "numeral_hero") {
    // A stated price the brief owns is allowed. The costume is the failure, not a number the customer wrote.
  }

  const uniqueFails = [...new Set(autoFails)]
  const offerToHeadline = (offer?.fontPt ?? 0) / Math.max(headline?.fontPt ?? 1, 1)
  const d1 = hierarchyScore(rationale, offerToHeadline, headline?.fontPt ?? 0, body, phonePt, offer?.fontPt ?? 0)
  const d2 = words.length >= 3 && words.length <= 6 ? 9 : words.length <= 8 ? 6 : 3
  const d3 = card.photoAreaPct >= 55 ? 9 : card.photoAreaPct >= 40 ? 6 : 3
  const d4 = worstContrast >= 7 ? 9 : worstContrast >= 4.5 ? 6 : 2
  const d5 = card.calmFieldPct >= 25 && boxed.length <= 2 && bursts.length === 0 ? 9 : boxed.length <= 3 ? 6 : 3
  const d6 = phone?.text && card.front.lockup?.qrLabel === "Scan to book" && phonePt >= phoneFloor ? 9 : phone?.text ? 6 : 3
  const dimensions = { D1: d1, D2: d2, D3: d3, D4: d4, D5: d5, D6: d6 }
  const weighted = round2(d1 * 0.25 + d2 * 0.15 + d3 * 0.2 + d4 * 0.15 + d5 * 0.15 + d6 * 0.1)

  const vision: Record<string, number> = {
    V1: card.front.shapes.filter((shape) => shape.role === "field" || shape.role === "type-panel").length === 1 ? 5 : 2,
    V2: rationale.scale_ratios.hero === "offer"
      ? (offerToHeadline >= 1.55 ? 5 : 2)
      : ((headline?.fontPt ?? 0) >= body * 2.5 ? 5 : 2),
    V3: phone?.text && card.front.lockup ? 5 : 2,
    V4: 5,
    V5: card.front.lockup ? 5 : 2,
    V6: worstContrast >= 4.5 ? (worstContrast >= 7 ? 5 : 4) : 1,
    V7: card.calmFieldPct >= 25 ? 5 : 2,
    V8: rationale.palette.emotion === "compliance_calm" || rationale.palette.second_accent_hex === null ? 5 : 3,
    V9: words.length >= 3 && words.length <= 6 ? 5 : words.length <= 8 ? 3 : 1,
    V10: card.photoAreaPct >= 55 ? 5 : card.photoAreaPct >= 40 ? 3 : 1,
    V11: rationale.offer_treatment.expiry === "none" || /real|printed/i.test(rationale.offer_treatment.expiry) ? 5 : 1,
    V12: card.front.lockup?.qrLabel === "Scan to book" && phone?.text ? 5 : 2,
    V13: GOVERNMENT.test(copy) ? 1 : 5,
  }
  if (rationale.vertical === "medicare_insurance" && rationale.palette.emotion !== "compliance_calm") vision.V8 = 1
  let visionScore = round2(
    Object.entries(VISION_WEIGHTS).reduce((sum, [id, weight]) => sum + ((vision[id] ?? 1) / 5) * weight, 0)
  )
  if (worstContrast < 4.5) visionScore = Math.min(visionScore, 40)
  const passed = uniqueFails.length === 0 && weighted >= WEIGHTED_PASS && visionScore >= VISION_PASS
  const brokenRule = uniqueFails[0] ?? lowestVision(vision)
  return {
    autoFails: uniqueFails,
    dimensions,
    weighted,
    vision,
    visionScore,
    passed,
    brokenRule: passed ? null : brokenRule,
    edit: passed ? null : editFor(brokenRule, rationale),
    scoreKind: "machine estimate",
  }
}

function clippedCopy(card: GridCard): boolean {
  const texts = [...card.front.texts, ...card.back.texts]
  const lockup = card.front.lockup
  if (lockup?.phone) texts.push(lockup.phone)
  if (lockup?.website) texts.push(lockup.website)
  return texts.some((text) => textIsClipped(text))
}

export function applyStructuralEdit(rationale: DesignRationale, editRule: string | null): DesignRationale {
  const next: DesignRationale = {
    ...rationale,
    grid: { ...rationale.grid },
    scale_ratios: { ...rationale.scale_ratios },
    palette: { ...rationale.palette, neutral_hex: [...rationale.palette.neutral_hex], banned: [...rationale.palette.banned] },
    photo_brief: { ...rationale.photo_brief },
    offer_treatment: { ...rationale.offer_treatment },
  }
  if (editRule === "AF1" || editRule === "V6") {
    next.palette.neutral_hex = ["#F7F4EE", "#1A1A1A"]
    next.palette.accent_hex = next.vertical === "medicare_insurance" ? "#3E6B8A" : "#1A1A1A"
  } else if (editRule === "AF4" || editRule === "V10" || editRule === "D3") {
    next.photo_brief.placement = "full_bleed"
    next.grid.name = "full-bleed-plus-panel"
  } else if (editRule === "AF5" || editRule === "V2" || editRule === "D1") {
    if (next.scale_ratios.hero === "offer") next.scale_ratios.offer_to_headline_cap = Math.max(next.scale_ratios.offer_to_headline_cap, 1.8)
    next.scale_ratios.headline_to_body_cap = Math.max(next.scale_ratios.headline_to_body_cap, 3)
  } else if (editRule === "AF3" || editRule === "V9" || editRule === "D2") {
    next.scale_ratios.headline_to_body_cap = Math.max(2.5, next.scale_ratios.headline_to_body_cap)
  } else if (editRule === "similarity" || editRule === "V4") {
    next.grid.name = shiftGrid(next.grid.name)
  } else if (editRule === "AF2" || editRule === "AF6" || editRule === "AF7" || editRule === "V12" || editRule === "D6") {
    next.grid.name = next.grid.name === "thirds" ? "full-bleed-plus-panel" : "thirds"
  } else if (editRule === "V8" || editRule === "V13") {
    next.palette.emotion = next.vertical === "medicare_insurance" ? "compliance_calm" : next.palette.emotion
    next.offer_treatment.expiry = "none"
  }
  return next
}

export function shiftGrid(name: GridName): GridName {
  if (name === "full-bleed-plus-panel") return "thirds"
  if (name === "thirds") return "centered-stack"
  if (name === "centered-stack") return "full-bleed-plus-panel"
  if (name === "split-40-60" || name === "bands") return "full-bleed-plus-panel"
  return "thirds"
}

function editFor(rule: string | null, rationale: DesignRationale): string {
  if (rule === "AF3" || rule === "V9") return "Shorten the headline to six words or fewer and keep one offer."
  if (rule === "AF1" || rule === "V6") return "Set the type on the light panel in near-black so it clears 4.5:1."
  if (rule === "AF4" || rule === "V10") return "Run the photograph to the bleed and keep type on one panel."
  if (rule === "AF5" || rule === "V2") {
    return rationale.scale_ratios.hero === "offer"
      ? "Enlarge the offer until it is at least 1.6× the headline."
      : "Enlarge the headline until it is at least 2.5× the body."
  }
  if (rule === "AF7" || rule === "V12") return "Group the phone, the website, and a labeled code in one lockup."
  if (rule === "similarity") return "Move the panel so the card does not repeat a reference mailer's arrangement."
  if (rule === "V13" || rule === "V8") return "Drop the official-notice cues and keep one calm accent."
  if (rule === "PS1") return "Make the benefit clear in the headline, and keep an outcome version in the rationale."
  if (rule === "PS5") return "Pair the threat with one easy action: a call, a scan, or the free inspection."
  if (rule === "PS3" || rule === "PS7") return "Remove the fake deadline or the fake limit."
  if (rule === "PS4" || rule === "PS6" || rule === "PS12") return "Remove any fact the client did not supply."
  if (rule === "PS8") return "Medicare cannot say free for a $0 premium."
  if (rule === "PS9") return "Remove the testimonial the client did not supply."
  if (rule === "PS10") return "Remove the steering or discriminatory line."
  if (rule === "PS11") return "Remove the fake check."
  return "Give the card one panel, one offer, and one response."
}

const PERSUASION_CODES: Record<string, string> = {
  benefit: "PS1",
  standout: "PS2",
  urgency: "PS3",
  invented: "PS4",
  efficacy: "PS5",
  placeholder: "PS6",
  scarcity: "PS7",
  medicare_free: "PS8",
  testimonial: "PS9",
  fair_housing: "PS10",
  fake_check: "PS11",
  false_personal: "PS12",
}

function hierarchyScore(
  rationale: DesignRationale,
  offerToHeadline: number,
  headlinePt: number,
  body: number,
  phonePt: number,
  offerPt: number
): number {
  const headlineOk = headlinePt >= body * 2.5 - 0.6
  const offerOk = rationale.scale_ratios.hero === "offer" ? offerToHeadline >= 1.55 : offerPt <= headlinePt
  const phoneQuiet = phonePt <= Math.max(offerPt, headlinePt)
  if (headlineOk && offerOk && phoneQuiet) return 9
  if (headlineOk) return 6
  return 3
}

function lowestVision(vision: Record<string, number>): string {
  return Object.entries(vision).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "V1"
}

function textByRole(plan: PostcardFacePlan, role: string) {
  return plan.texts.find((text) => text.role === role)
}

function combinedText(plan: PostcardFacePlan, role: string) {
  const parts = plan.texts.filter((text) => text.role === role && text.text.trim().length > 0)
  const first = parts[0]
  if (!first || parts.length === 1) return first
  return {
    ...first,
    text: parts.map((part) => part.text).join(" "),
    fontPt: Math.max(...parts.map((part) => part.fontPt)),
    lines: parts.flatMap((part) => part.lines),
  }
}

function liveTexts(plan: PostcardFacePlan) {
  return [
    ...plan.texts,
    ...(plan.lockup?.phone ? [plan.lockup.phone] : []),
    ...(plan.lockup?.website ? [plan.lockup.website] : []),
  ]
}

function backViolatesKeepOut(card: GridCard): boolean {
  const geometry = card.front.size === "6x9" ? buildPostcard6x9PrintSpec() : buildPostcard5x8PrintSpec()
  const bleed = geometry.bleedInchesPerSide
  for (const text of card.back.texts) {
    const canvas = trimRectToCanvas(text.rect, bleed)
    for (const keepOut of geometry.keepOuts) {
      if (rectsOverlap(canvas, keepOut.canvas)) return true
    }
  }
  const content = addressSideContentRect(geometry)
  return card.back.texts.some((text) => {
    const canvas = trimRectToCanvas(text.rect, bleed)
    return canvas.xInches < content.xInches - 0.02 || canvas.yInches < content.yInches - 0.02
  })
}

function trimRectToCanvas(rect: InchRect, bleed: number): InchesRect {
  return {
    xInches: rect.x + bleed,
    yInches: rect.y + bleed,
    widthInches: rect.w,
    heightInches: rect.h,
  }
}

export function panelDistance(
  panel: { x: number; y: number; w: number; h: number },
  other: { x: number; y: number; w: number; h: number }
): number {
  return Math.abs(panel.x - other.x) + Math.abs(panel.y - other.y) + Math.abs(panel.w - other.w) + Math.abs(panel.h - other.h)
}

export function referenceFingerprints(): { id: string; panel: { x: number; y: number; w: number; h: number } }[] {
  return [
    { id: "PM-047", panel: { x: 0, y: 0.62, w: 1, h: 0.38 } },
    { id: "PM-022", panel: { x: 0.18, y: 0.2, w: 0.64, h: 0.58 } },
    { id: "PM-054", panel: { x: 0.5, y: 0, w: 0.5, h: 1 } },
  ]
}

export function closestReference(card: GridCard): { id: string; distance: number } {
  const panel = normalizedPanel(card.panel, card.front.size)
  let best = { id: "", distance: 99 }
  for (const fingerprint of referenceFingerprints()) {
    const distance = panelDistance(panel, fingerprint.panel)
    if (distance < best.distance) best = { id: fingerprint.id, distance }
  }
  return best
}

function round2(value: number): number {
  return Math.round(value * 10) / 10
}
