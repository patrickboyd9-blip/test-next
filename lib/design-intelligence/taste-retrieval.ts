import type { CampaignBrief } from "@/lib/campaign-creator/types"

import { gradeRank, loadSeedAnalyses, type LibraryRecord } from "./library"
import { tasteFromWrittenNotes, type TasteAnalysis } from "./taste"
import { verticalForBrief } from "./vertical"
import type { TasteSignal } from "./feedback"

/**
 * Pulls the high-grade readings that match this brief.
 * Industry, offer type, and feel do the matching. A vision reading outranks
 * a written note. Citations have to be ids this function actually returned.
 */

export interface TasteQuery {
  industry: string
  offerType: string
  feel: string
}

export interface RetrievedTaste {
  id: string
  grade: string
  principle: string
  doNotCopy: string
  industry: string
  offerType: string
  feel: string
  typeIntegration: TasteAnalysis["typeIntegration"]
  groundedBy: TasteAnalysis["groundedBy"]
}

export function industryForBrief(brief: CampaignBrief): string {
  const text = briefText(brief)
  if (/\bsolar\b/i.test(text)) return "solar"
  if (/\bdental|dentist\b/i.test(text)) return "dental"
  if (/\bpest\b/i.test(text)) return "pest_control"
  if (/\blandscap|\byard\b|\blawn\b/i.test(text)) return "landscaping"
  if (/\brestaurant\b|\bdinner\b|\bmenu\b/i.test(text)) return "restaurant"
  if (/\bwe buy houses\b|\bcash offer\b/i.test(text)) return "real_estate"
  return verticalForBrief(brief)
}

export function offerTypeForBrief(brief: CampaignBrief): string {
  const offer = `${brief.offer ?? ""} ${brief.goal ?? ""}`
  if (/free|\$\s*0\b/i.test(offer)) return "free"
  if (/%/.test(offer)) return "percent"
  if (/\$\s?\d/.test(offer)) return "numeral"
  if (/inspect|estimate|review|tune-?up|consult/i.test(offer)) return "inspection"
  return "other"
}

export function feelForBrief(brief: CampaignBrief): string {
  if (verticalForBrief(brief) === "medicare_insurance") return "calm"
  const tone = brief.emotionalTone?.trim().toLowerCase()
  if (tone) return tone
  return "integrated"
}

export function queryFromBrief(brief: CampaignBrief): TasteQuery {
  return {
    industry: industryForBrief(brief),
    offerType: offerTypeForBrief(brief),
    feel: feelForBrief(brief),
  }
}

export function writtenTasteFromLibrary(records?: readonly LibraryRecord[]): TasteAnalysis[] {
  const analyses = records?.map((record) => record.analysis).filter((item): item is NonNullable<typeof item> => Boolean(item))
  const source = analyses && analyses.length > 0 ? analyses : loadSeedAnalyses()
  return source.flatMap((analysis) => {
    const taste = tasteFromWrittenNotes(analysis)
    return taste ? [taste] : []
  })
}

export function mergeTaste(vision: readonly TasteAnalysis[], written: readonly TasteAnalysis[]): TasteAnalysis[] {
  const byId = new Map<string, TasteAnalysis>()
  for (const analysis of written) byId.set(analysis.id, analysis)
  for (const analysis of vision) byId.set(analysis.id, analysis)
  return [...byId.values()]
}

export function retrieveTaste(input: {
  analyses: readonly TasteAnalysis[]
  brief: CampaignBrief
  signals?: TasteSignal[]
  limit?: number
}): RetrievedTaste[] {
  const query = queryFromBrief(input.brief)
  const limit = input.limit ?? 4
  const ranked = input.analyses
    .filter((analysis) => analysis.grade !== "F" && !ANTI_IDS.has(analysis.id))
    .map((analysis) => ({ analysis, score: tasteScore(analysis, query, input.signals ?? []) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.analysis.id.localeCompare(b.analysis.id))

  const high = ranked.filter((item) => gradeRank(item.analysis.grade) <= 1)
  const pool = (high.length >= 2 ? high : ranked.filter((item) => gradeRank(item.analysis.grade) <= 3)).slice(0, limit)
  return pool.map((item) => toRetrieved(item.analysis))
}

export function citesForDirection(pool: readonly RetrievedTaste[], feel: string): RetrievedTaste[] {
  const matched = pool.filter((item) => item.feel === feel || (feel === "integrated" && item.typeIntegration === "on_open_canvas"))
  const picks = (matched.length > 0 ? matched : pool).slice(0, 2)
  return picks.filter((item) => pool.some((retrieved) => retrieved.id === item.id))
}

const ANTI_IDS = new Set(["MMR-513", "MMR-047", "MMR-047-2", "PM-011"])

function tasteScore(analysis: TasteAnalysis, query: TasteQuery, signals: readonly TasteSignal[]): number {
  let score = 0
  if (analysis.industry === query.industry) score += 8
  else if (sameFamily(analysis.industry, query.industry)) score += 2
  else score += 0
  if (analysis.offerType === query.offerType) score += 5
  if (analysis.feel === query.feel || (query.feel === "integrated" && analysis.typeIntegration === "on_open_canvas")) score += 4
  const rank = gradeRank(analysis.grade)
  if (rank > 3) score -= 4
  else score += Math.max(0, 6 - rank)
  if (analysis.groundedBy === "vision") score += 3
  for (const signal of signals) {
    if (signal.industry && signal.industry !== query.industry && signal.industry !== analysis.industry) continue
    if (!signalMatches(signal, analysis)) continue
    if (signal.vote === "up") score += 3
    if (signal.vote === "down") score -= 6
  }
  return score
}

function signalMatches(signal: TasteSignal, analysis: TasteAnalysis): boolean {
  if (signal.feel && signal.feel === analysis.feel) return true
  if (signal.family && signal.family === analysis.compositionFamily) return true
  const panel = signal.feel === "panel" || signal.family === "panel-left" || signal.family === "panel-right" || signal.family === "boxed-card"
  if (panel && (analysis.feel === "panel" || analysis.typeIntegration === "on_panel" || analysis.typeIntegration === "boxed")) return true
  const open = signal.feel === "integrated" || signal.family === "cutout-right" || signal.family === "cutout-left" || signal.family === "stacked-open" || signal.family === "offer-float"
  if (open && (analysis.feel === "integrated" || analysis.typeIntegration === "on_open_canvas")) return true
  return false
}

function sameFamily(a: string, b: string): boolean {
  const home = new Set(["roofing", "plumbing", "hvac", "solar", "pest_control", "landscaping", "general_local_service"])
  return home.has(a) && home.has(b)
}

function toRetrieved(analysis: TasteAnalysis): RetrievedTaste {
  return {
    id: analysis.id,
    grade: analysis.grade,
    principle: clip(analysis.whatMakesItWork),
    doNotCopy: analysis.doNotCopy[0] ?? "Do not copy the mark, the amounts, the phone, the photos, or the wording.",
    industry: analysis.industry,
    offerType: analysis.offerType,
    feel: analysis.feel,
    typeIntegration: analysis.typeIntegration,
    groundedBy: analysis.groundedBy,
  }
}

function clip(value: string): string {
  return value.length > 180 ? `${value.slice(0, 177)}...` : value
}

function briefText(brief: CampaignBrief): string {
  return [brief.goal, brief.offer, brief.audience?.description, brief.businessInfo?.name, brief.emotionalTone, brief.otherRequirements]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
}
