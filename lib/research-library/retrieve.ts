import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { verticalForBrief } from "@/lib/design-intelligence/vertical"

import { industriesAdjacent, normalizeIndustry, researchEmotion, researchOfferType } from "./industry"
import type { ResearchEntry, RetrievalHit, RetrievalQuery, RetrievalResult } from "./types"

const DEFAULT_LIMIT = 6

export function queryFromBrief(brief: CampaignBrief, direction?: { name?: string; headline?: string; offer?: string; emotion?: string }): RetrievalQuery {
  const text = [
    brief.goal,
    brief.offer,
    brief.audience?.description,
    brief.businessInfo?.name,
    brief.emotionalTone,
    brief.otherRequirements,
    brief.desiredRecipientAction,
    direction?.name,
    direction?.headline,
    direction?.offer,
  ].filter((value): value is string => Boolean(value?.trim())).join(" ")
  return {
    industry: industryFromBrief(brief, text),
    offerType: researchOfferType(`${brief.offer ?? ""} ${direction?.offer ?? ""} ${brief.goal ?? ""}`),
    audience: brief.audience?.description?.trim() ?? "",
    direction: [direction?.name, direction?.headline, brief.goal].filter(Boolean).join(" "),
    emotion: researchEmotion(`${direction?.emotion ?? ""} ${brief.emotionalTone ?? ""} ${text}`),
  }
}

export function retrieveResearch(entries: readonly ResearchEntry[], query: RetrievalQuery, limit = DEFAULT_LIMIT): RetrievalResult {
  const cap = Math.max(1, Math.min(8, limit))
  const ranked = entries
    .map((entry) => ({ entry, ...scoreEntry(entry, query) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
  const same = ranked.filter((hit) => hit.band === "same")
  let fallback: RetrievalResult["fallback"] = "none"
  let pool = ranked
  if (same.length >= cap) {
    pool = same
  } else if (same.length > 0) {
    fallback = "filled"
    pool = [...same, ...ranked.filter((hit) => hit.band === "adjacent")]
  } else if (ranked.some((hit) => hit.band === "adjacent")) {
    fallback = "adjacent"
    pool = ranked.filter((hit) => hit.band === "adjacent")
    if (pool.length < cap) pool = ranked
  } else {
    fallback = "broader"
  }
  const hits: RetrievalHit[] = []
  const seen = new Set<string>()
  for (const hit of pool) {
    if (seen.has(hit.entry.id)) continue
    seen.add(hit.entry.id)
    hits.push({ entry: hit.entry, score: hit.score, band: hit.band })
    if (hits.length >= cap) break
  }
  return { hits, fallback }
}

function scoreEntry(entry: ResearchEntry, query: RetrievalQuery): { score: number; band: RetrievalHit["band"] } {
  let score = 2
  let band: RetrievalHit["band"] = "broader"
  if (entry.industry === query.industry) {
    score += 50
    band = "same"
  } else if (industriesAdjacent(entry.industry, query.industry)) {
    score += 22
    band = "adjacent"
  } else if (entry.industry === "home_services" || entry.industry === "insurance" || query.industry === "home_services") {
    score += 6
  } else {
    score -= 4
  }
  if (entry.gold) score += 28
  if (entry.evidence === "visual") score += 22
  else score += 3
  if (entry.favoriteSimilarity) score += entry.favoriteSimilarity * 4
  if (entry.responseEvidence) score += 8
  if (entry.offerType !== "other" && entry.offerType === query.offerType) score += 10
  if (entry.emotion !== "unspecified" && entry.emotion === query.emotion) score += 6
  score += audienceOverlap(entry, query)
  return { score, band }
}

function audienceOverlap(entry: ResearchEntry, query: RetrievalQuery): number {
  const words = new Set(tokens(query.audience))
  if (words.size === 0) return 0
  let hits = 0
  for (const word of tokens(entry.searchText)) {
    if (words.has(word)) hits += 1
  }
  return Math.min(6, hits * 2)
}

function tokens(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3)
}

function industryFromBrief(brief: CampaignBrief, text: string): string {
  if (/\bauto insurance\b|\bcar insurance\b|\bvehicle insurance\b/i.test(text)) return "auto_insurance"
  if (/\bhomeowners insurance\b|\bhome insurance\b/i.test(text)) return "home_insurance"
  if (/\blife insurance\b/i.test(text)) return "life_insurance"
  if (/\bfinal expense\b/i.test(text)) return "final_expense"
  if (/\bmedicare\b|\bmedicaid\b/i.test(text)) return "medicare"
  if (/\bhvac\b|\bair condition|\bfurnace\b/i.test(text)) return "hvac"
  if (/\broof|shingle|gutter/i.test(text)) return "roofing"
  if (/\bplumb|drain|water heater/i.test(text)) return "plumbing"
  if (/\bdental|dentist/i.test(text)) return "dental"
  if (/\breal estate\b|\brealtor\b/i.test(text)) return "real_estate"
  const vertical = verticalForBrief(brief)
  if (vertical === "medicare_insurance") return "insurance"
  if (vertical === "general_local_service") return "home_services"
  return normalizeIndustry(vertical)
}
