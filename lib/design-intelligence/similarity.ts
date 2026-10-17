import type { CampaignBrief } from "@/lib/campaign-creator/types"

import { closestReference, type Critique } from "./critic"
import type { GridCard } from "./grid-composer"

/**
 * Rejects a card that repeats a reference mailer's arrangement, or that
 * carries a benchmark brand, phone, or address the customer's brief does not
 * own. Transferable structure is allowed. A near-copy is not.
 */

export const SIMILARITY_DISTANCE = 0.22

const REFERENCE_MARKS: { pattern: RegExp; label: string }[] = [
  { pattern: /858[-.\s]?358[-.\s]?6454/, label: "a benchmark phone number" },
  { pattern: /bestwindowsanddoors/i, label: "a benchmark web address" },
  { pattern: /renewal by andersen|\bandersen\b/i, label: "a benchmark brand" },
  { pattern: /\bbellami\b/i, label: "a benchmark brand" },
  { pattern: /flex weft/i, label: "a benchmark product name" },
  { pattern: /\bcvs\b/i, label: "a benchmark brand" },
]

export interface SimilarityResult {
  tooClose: boolean
  reason: string | null
  nearestId: string | null
  distance: number
}

export function checkSimilarity(card: GridCard, copy: string, brief: CampaignBrief): SimilarityResult {
  const nearest = closestReference(card)
  if (nearest.distance < SIMILARITY_DISTANCE) {
    return {
      tooClose: true,
      reason: `The panel sits too close to ${nearest.id}. Move it. Do not redraw that mailer.`,
      nearestId: nearest.id,
      distance: nearest.distance,
    }
  }
  const owned = `${brief.businessInfo?.name ?? ""} ${brief.offer ?? ""} ${brief.website ?? ""} ${brief.phone ?? ""}`.toLowerCase()
  for (const mark of REFERENCE_MARKS) {
    if (!mark.pattern.test(copy)) continue
    const probe = mark.label.includes("phone") ? copy : mark.pattern.source
    if (ownedIncludes(owned, copy, mark.pattern)) continue
    return {
      tooClose: true,
      reason: `The card repeats ${mark.label}. ${probe ? "Use the customer's own words." : ""}`.trim(),
      nearestId: nearest.id,
      distance: nearest.distance,
    }
  }
  return { tooClose: false, reason: null, nearestId: nearest.id, distance: nearest.distance }
}

function ownedIncludes(owned: string, copy: string, pattern: RegExp): boolean {
  const found = copy.match(pattern)?.[0]?.toLowerCase()
  if (!found) return false
  return owned.includes(found.replace(/\s+/g, " "))
}

export function critiquePasses(critique: Critique, similarity: SimilarityResult): boolean {
  return critique.passed && !similarity.tooClose
}
