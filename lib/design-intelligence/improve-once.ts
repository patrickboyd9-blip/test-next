import type { CreativeSpec } from "@/lib/campaign-creator/types"

import { measureBackdropContrast, type BackdropContrast, type ContrastPhoto } from "./backdrop"
import { gradeComposition, craftFaults, type CompositionGrade } from "./composition-grade"
import { critiqueCard, type Critique } from "./critic"
import { composeGridCard, type GridCard } from "./grid-composer"
import { analyzePhotoField, type PhotoReading } from "./photo-field"
import type { DesignRationale, TypeSeat } from "./rationale"

/**
 * One improvement after the critic names the single biggest weakness.
 * A change that adds a hard failure, or that lowers the grade, is dropped.
 */

export interface FinishedCard {
  rationale: DesignRationale
  card: GridCard
  contrast: BackdropContrast
  critique: Critique
  grade: CompositionGrade
  weakness: string
  explanation: string
  improved: boolean
}

export function finishCardOnPhoto(input: {
  rationale: DesignRationale
  spec: GridSpec
  businessName?: string
  photo: ContrastPhoto
  disclaimer?: string | null
}): FinishedCard {
  const reading = analyzePhotoField(input.photo.rgba, input.photo.width, input.photo.height)
  const seated = { ...input.rationale, type_seat: reading.seat }
  const first = judge(seated, input)
  const weakness = biggestWeakness(first.card, first.contrast, first.critique, reading)
  const proposal = improveFromWeakness(seated, weakness)
  if (!proposal) {
    return { ...first, rationale: seated, weakness, explanation: seatedExplanation(weakness), improved: false }
  }
  const next = judge(proposal.rationale, input)
  if (regressed(first.critique, next.critique) || next.grade.score < first.grade.score) {
    return { ...first, rationale: seated, weakness, explanation: seatedExplanation(weakness), improved: false }
  }
  return {
    ...next,
    rationale: proposal.rationale,
    weakness,
    explanation: proposal.explanation,
    improved: true,
  }
}

export function improveFromWeakness(
  rationale: DesignRationale,
  weakness: string,
  options?: { allowSeat?: boolean }
): { rationale: DesignRationale; explanation: string } | null {
  const text = weakness.replace(/\s+/g, " ").trim()
  if (!text) return null
  const allowSeat = options?.allowSeat !== false
  if (/contrast|washed|hard to (?:see|read)|7:1|small type|busy|ladder|face|clutter/i.test(text)) {
    if (!allowSeat) return null
    const seat = withScrim(rationale.type_seat)
    if (!seat) return null
    if (rationale.type_seat?.scrim && rationale.type_seat.shadow) return null
    return {
      rationale: { ...rationale, type_seat: seat },
      explanation: "A light scrim sits behind the type so the small lines clear the photograph.",
    }
  }
  if (/offer|free|scale|bigger|larger|timid|small headline/i.test(text) && !/small type/i.test(text)) {
    const cap = rationale.scale_ratios.offer_to_headline_cap
    const nextCap = Math.min(2.4, Math.max(1.85, cap + 0.2))
    if (rationale.scale_ratios.hero === "offer" && nextCap <= cap) return null
    return {
      rationale: {
        ...rationale,
        scale_ratios: { ...rationale.scale_ratios, hero: "offer", offer_to_headline_cap: nextCap },
      },
      explanation: "FREE is larger than the headline.",
    }
  }
  return null
}

type GridSpec = Parameters<typeof composeGridCard>[0]["spec"]

function judge(
  rationale: DesignRationale,
  input: { spec: GridSpec; businessName?: string; photo: ContrastPhoto; disclaimer?: string | null }
): Omit<FinishedCard, "rationale" | "weakness" | "explanation" | "improved"> {
  const card = composeGridCard({
    rationale,
    spec: input.spec,
    businessName: input.businessName,
    disclaimer: input.disclaimer,
  })
  const contrast = measureBackdropContrast(card, input.photo)
  const critique = critiqueCard(card, rationale, copyOf(input.spec), input.photo)
  const grade = gradeComposition({
    card,
    rationale,
    autoFails: critique.autoFails,
    worstContrast: contrast.smallFailing.length > 0 ? Math.min(contrast.worst, 3) : contrast.worst,
  })
  return { card, contrast, critique, grade }
}

export function biggestWeakness(
  card: GridCard,
  contrast: BackdropContrast,
  critique: Critique,
  reading?: PhotoReading | null
): string {
  if (contrast.smallFailing.length > 0 || contrast.worst < 4.5 || critique.autoFails.includes("AF1")) {
    return "Small type does not clear 7:1 on this photograph."
  }
  if (reading?.stocky) return "The photograph looks like a stock portrait."
  if (reading?.cluttered) return "The photograph is cluttered behind the type."
  const craft = craftFaults(card)
  if (craft.redundantCopy) return "The offer is repeated."
  if (craft.orphaned) return "The code sits apart from the phone."
  return ""
}

function withScrim(seat: TypeSeat | undefined): TypeSeat | null {
  if (!seat) return null
  return { ...seat, scrim: true, shadow: true }
}

function regressed(before: Critique, after: Critique): boolean {
  for (const rule of ["AF1", "AF2", "AF6", "AF7"]) {
    if (after.autoFails.includes(rule) && !before.autoFails.includes(rule)) return true
  }
  return false
}

function copyOf(spec: Pick<CreativeSpec, "headline" | "offer" | "body" | "phone">): string {
  return [spec.headline, spec.offer, spec.body, spec.phone].filter(Boolean).join(" ")
}

function seatedExplanation(weakness: string): string {
  if (!weakness) return "Type sits on the calm side of the photograph."
  return weakness
}
