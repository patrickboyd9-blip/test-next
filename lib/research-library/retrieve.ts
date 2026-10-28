import type { CampaignBrief } from "@/lib/campaign-creator/types"

import { industriesAdjacent, industryForBrief, neighborRank, normalizeIndustry, researchEmotion, researchOfferType } from "./industry"
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
    industry: industryForBrief(brief, [direction?.name, direction?.headline, direction?.offer].filter(Boolean).join(" ")),
    offerType: researchOfferType(`${brief.offer ?? ""} ${direction?.offer ?? ""} ${brief.goal ?? ""}`),
    audience: brief.audience?.description?.trim() ?? "",
    direction: [direction?.name, direction?.headline, brief.goal].filter(Boolean).join(" "),
    emotion: researchEmotion(`${direction?.emotion ?? ""} ${brief.emotionalTone ?? ""} ${text}`),
  }
}

export function entryHasContent(entry: ResearchEntry): boolean {
  if (entry.referenceOnly) return false
  return Boolean(entry.headlines.some((line) => line.trim()) || entry.offers.some((line) => line.trim()) || entry.photoStyle?.trim())
}

export function retrieveResearch(entries: readonly ResearchEntry[], query: RetrievalQuery, limit = DEFAULT_LIMIT): RetrievalResult {
  const cap = Math.max(1, Math.min(8, limit))
  const ranked = entries
    .map((entry) => ({ entry, ...scoreEntry(entry, query) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
  const same = ranked.filter((hit) => hit.band === "same")
  const adjacent = ranked.filter((hit) => hit.band === "adjacent")
  const richSame = same.filter((hit) => entryHasContent(hit.entry))
  const richAdjacent = adjacent.filter((hit) => entryHasContent(hit.entry))
  let fallback: RetrievalResult["fallback"] = "none"
  let pool = ranked
  if (richSame.length >= cap) {
    pool = richSame
  } else if (richSame.length > 0) {
    fallback = "filled"
    pool = [...richSame, ...richAdjacent, ...same.filter((hit) => !entryHasContent(hit.entry))]
  } else if (richAdjacent.length > 0) {
    fallback = "adjacent"
    pool = [...richAdjacent, ...adjacent.filter((hit) => !entryHasContent(hit.entry))]
  } else if (same.length >= cap) {
    pool = same
  } else if (same.length > 0) {
    fallback = "filled"
    pool = [...same, ...adjacent]
  } else if (adjacent.length > 0) {
    fallback = "adjacent"
    pool = adjacent.length >= cap ? adjacent : ranked
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
  return { hits: reservePhysicalSlots(hits, ranked, query, cap), fallback }
}

/**
 * Gold recipes fill a large industry. Keep one or two slots for a physical
 * C-3PO piece that is actually tagged to the query, including a layout-only piece.
 */
function reservePhysicalSlots(
  hits: RetrievalHit[],
  ranked: readonly { entry: ResearchEntry; score: number; band: RetrievalHit["band"] }[],
  query: RetrievalQuery,
  cap: number,
): RetrievalHit[] {
  const reserve = cap >= 6 ? 2 : 0
  const industry = normalizeIndustry(query.industry)
  if (reserve === 0 || industry === "none") return hits
  const physical = ranked.filter((hit) =>
    hit.entry.origin === "c3po" &&
    hit.band === "same" &&
    normalizeIndustry(hit.entry.industry) === industry
  )
  if (physical.length === 0) return hits
  const next = hits.map((hit) => ({ ...hit }))
  const want = Math.min(reserve, physical.length)
  let kept = 0
  for (const hit of physical) {
    if (kept >= want) break
    if (next.some((item) => item.entry.id === hit.entry.id)) {
      kept += 1
      continue
    }
    const replacement: RetrievalHit = { entry: hit.entry, score: hit.score, band: hit.band }
    if (next.length < cap) {
      next.push(replacement)
      kept += 1
      continue
    }
    let index = -1
    for (let i = next.length - 1; i >= 0; i -= 1) {
      if (next[i]!.entry.origin !== "c3po") {
        index = i
        break
      }
    }
    if (index < 0) break
    next[index] = replacement
    kept += 1
  }
  return next
}

function scoreEntry(entry: ResearchEntry, query: RetrievalQuery): { score: number; band: RetrievalHit["band"] } {
  const queryIndustry = normalizeIndustry(query.industry)
  const entryIndustry = normalizeIndustry(entry.industry)
  if (queryIndustry !== "medicare" && medicareSpecific(entry)) {
    return { score: 0, band: "broader" }
  }
  // A record outside the 28 industries is craft context, not a same-industry example.
  if (queryIndustry !== "none" && entryIndustry === "none") {
    return { score: 0, band: "broader" }
  }
  let score = 2
  let band: RetrievalHit["band"] = "broader"
  const neighbor = neighborRank(queryIndustry, entryIndustry)
  if (entryIndustry !== "none" && entryIndustry === queryIndustry) {
    score += 50
    band = "same"
  } else if (neighbor > 0) {
    score += neighbor === 1 ? 28 : neighbor === 2 ? 22 : 16
    band = "adjacent"
  } else if (industriesAdjacent(entryIndustry, queryIndustry)) {
    score += 18
    band = "adjacent"
  } else {
    score -= 4
  }
  if (entry.referenceOnly) score -= 6
  else if (!entryHasContent(entry)) score -= 80
  if (entry.gold) score += 28
  if (entry.evidence === "visual") score += 22
  else score += 3
  if (entry.favoriteSimilarity) score += entry.favoriteSimilarity * 4
  if (usableResponseNote(entry.responseEvidence)) score += 8
  if (entry.offerType !== "other" && entry.offerType === query.offerType) score += 10
  if (entry.emotion !== "unspecified" && entry.emotion === query.emotion) score += 6
  score += audienceOverlap(entry, query)
  return { score, band }
}

function usableResponseNote(value: string | undefined): boolean {
  const trimmed = value?.replace(/\s+/g, " ").trim() ?? ""
  if (!trimmed) return false
  if (/^(?:unknown|n\/a|na|none|not available|not stated|unspecified)\b/i.test(trimmed)) return false
  if (/\bno measured\b|\bnot measured\b|\bno response (rate|data|noted)\b|\bno data\b|\bnone recorded\b|\bno rate\b/i.test(trimmed)) return false
  return true
}

function medicareSpecific(entry: ResearchEntry): boolean {
  if (entry.industry === "medicare") return true
  const blob = [entry.headlines.join(" "), entry.offers.join(" "), entry.whyItWorks ?? "", entry.photoStyle ?? "", entry.searchText].join(" ")
  return /\bmedicare\b|\bmedicaid\b|\bmedigap\b|\bcoverage gap\b|\baep\b|\bannual enrollment\b/i.test(blob)
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

