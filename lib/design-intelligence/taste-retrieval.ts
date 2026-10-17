import type { CampaignBrief } from "@/lib/campaign-creator/types"

import { gradeRank } from "./library"
import {
  highGrade,
  inferFeel,
  inferOfferType,
  normalizeIndustry,
  type VisionTaste,
} from "./vision-taste"

/**
 * Picks the high-grade readings an art director may reason from.
 * Industry, offer type, and feel do the matching. A liked composition
 * moves up. A disliked one moves down. The returned ids are the citations.
 */

export interface TasteQuery {
  industry: string
  offerType: string
  feel: string
}

export interface TasteSignals {
  likedFamilies: string[]
  dislikedFamilies: string[]
  likedNotes: string[]
  dislikedNotes: string[]
}

export interface TastePick {
  id: string
  grade: string
  industry: string
  offerType: string
  feel: string
  principle: string
  doNotCopy: string
  origin: VisionTaste["origin"]
}

export function tasteQueryForBrief(brief: CampaignBrief): TasteQuery {
  const text = [
    brief.goal,
    brief.offer,
    brief.audience?.description,
    brief.businessInfo?.name,
    brief.emotionalTone,
    brief.otherRequirements,
    brief.desiredRecipientAction,
  ].filter((value): value is string => Boolean(value?.trim())).join(" ")
  const industry = industryFromText(text)
  const offerType = offerFromBrief(brief, text)
  let feel = inferFeel(`${text} ${brief.emotionalTone ?? ""}`)
  if (industry === "medicare" || /calm/i.test(brief.emotionalTone ?? "")) feel = "calm"
  if (industry === "restaurant") feel = "appetite"
  if (!/panel|boxed|calm|urgent|editorial|appetite/i.test(text) && industry !== "medicare" && industry !== "restaurant") {
    feel = "integrated"
  }
  return { industry, offerType, feel }
}

export function retrieveTaste(input: {
  tastes: readonly VisionTaste[]
  brief: CampaignBrief
  signals?: TasteSignals
  limit?: number
}): TastePick[] {
  const query = tasteQueryForBrief(input.brief)
  const limit = Math.max(1, Math.min(6, input.limit ?? 4))
  return input.tastes
    .filter((taste) => highGrade(taste))
    .map((taste) => ({ taste, score: tasteScore(taste, query, input.signals) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || gradeRank(a.taste.grade) - gradeRank(b.taste.grade) || a.taste.id.localeCompare(b.taste.id))
    .slice(0, limit)
    .map((item) => toPick(item.taste))
}

export function guidanceFromRetrieval(picks: readonly TastePick[], signals?: TasteSignals): string {
  const lines = picks.map((pick) => `- ${pick.id} (${pick.grade}, ${pick.feel}): ${pick.principle} Do not copy: ${pick.doNotCopy}`)
  if (signals?.likedNotes.length) lines.push(`Customer liked: ${signals.likedNotes.slice(0, 3).join(" ")}`)
  if (signals?.dislikedNotes.length) lines.push(`Customer rejected: ${signals.dislikedNotes.slice(0, 3).join(" ")}`)
  if (signals?.likedFamilies.length) lines.push(`Preferred compositions: ${signals.likedFamilies.join(", ")}.`)
  if (signals?.dislikedFamilies.length) lines.push(`Avoid compositions: ${signals.dislikedFamilies.join(", ")}.`)
  return lines.join("\n")
}

export function citationsForFamily(picks: readonly TastePick[], feel: string): TastePick[] {
  const matched = picks.filter((pick) => pick.feel === feel)
  const chosen = (matched.length > 0 ? matched : picks).slice(0, 2)
  return chosen
}

function tasteScore(taste: VisionTaste, query: TasteQuery, signals?: TasteSignals): number {
  let score = 1
  const rank = gradeRank(taste.grade)
  if (rank === 0) score += 12
  else if (rank === 1) score += 10
  else if (rank === 2) score += 7
  else if (rank === 3) score += 4
  else return 0

  if (taste.industry === query.industry) score += 8
  else if (sameTrade(taste.industry, query.industry)) score += 5
  else if (taste.industry === "general" || query.industry === "general") score += 1
  else score -= 2

  if (taste.offerType === query.offerType) score += 6
  else if (taste.offerType === "other" || query.offerType === "other") score += 1

  if (taste.feel === query.feel) score += 4
  if (query.feel === "integrated" && (taste.feel === "integrated" || taste.feel === "editorial")) score += 2
  if (signals?.likedFamilies.includes(taste.compositionFamily) || signals?.likedFamilies.includes(taste.feel)) score += 5
  if (signals?.dislikedFamilies.includes(taste.compositionFamily) || signals?.dislikedFamilies.includes(taste.feel)) score -= 8
  if (taste.origin === "vision") score += 1
  return score
}

function toPick(taste: VisionTaste): TastePick {
  return {
    id: taste.id,
    grade: taste.grade,
    industry: taste.industry,
    offerType: taste.offerType,
    feel: taste.feel,
    principle: taste.whatWorks,
    doNotCopy: taste.doNotCopy,
    origin: taste.origin,
  }
}

function industryFromText(text: string): string {
  if (/\bmedicare\b|\bmedicaid\b|\binsurance\b/i.test(text)) return "medicare"
  if (/\broof|shingle|gutter/i.test(text)) return "roofing"
  if (/\bplumb|drain|water heater/i.test(text)) return "plumbing"
  if (/\bhvac\b|\bair condition|\bfurnace\b|\btune-up\b|\btune up\b/i.test(text)) return "hvac"
  if (/\breal estate\b|\bwe buy\b|\bhome for sale\b/i.test(text)) return "real_estate"
  if (/\bsolar\b|\bpanel install/i.test(text)) return "solar"
  if (/\bdental\b|\bdentist\b/i.test(text)) return "dental"
  if (/\bpest\b|\btermite\b/i.test(text)) return "pest_control"
  if (/\blandscap|lawn\b|\byard\b/i.test(text)) return "landscaping"
  if (/\brestaurant\b|\bdining\b|\bmenu\b/i.test(text)) return "restaurant"
  if (/\bjunk\b/i.test(text)) return "junk_removal"
  return "general"
}

function offerFromBrief(brief: CampaignBrief, text: string): string {
  const fromOffer = inferOfferType(`${brief.offer ?? ""} ${brief.goal ?? ""}`)
  if (fromOffer !== "other") return fromOffer
  return inferOfferType(text)
}

function sameTrade(left: string, right: string): boolean {
  const home = new Set(["roofing", "plumbing", "hvac", "solar", "pest_control", "landscaping"])
  return home.has(normalizeIndustry(left)) && home.has(normalizeIndustry(right))
}
