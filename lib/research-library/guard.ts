/**
 * Research is a pattern source, never a copy source.
 * These checks keep a library line, a damage claim, or an off-offer headline
 * off the card.
 */
import type { ResearchEntry } from "./types"

const STOP = new Set(["a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "your", "you", "our", "we", "is", "it", "with", "at", "this", "that", "be", "are", "now", "get"])

export function lineTokens(line: string): string[] {
  return line.toLowerCase().replace(/[’']/g, "").split(/[^a-z0-9%$]+/).filter((word) => word && !STOP.has(word))
}

/** Share of the shorter line's words that also appear in the other line (0–1). */
export function lineOverlap(a: string, b: string): number {
  const left = new Set(lineTokens(a))
  const right = new Set(lineTokens(b))
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const word of left) if (right.has(word)) shared += 1
  return shared / Math.min(left.size, right.size)
}

export const COPY_THRESHOLD = 0.6

let libraryLines: string[] = []
let rememberedFrom = -1

/** Called whenever the library is loaded, so every card line is checked against all of it. */
export function rememberLibraryLines(entries: readonly ResearchEntry[]): void {
  if (entries.length === rememberedFrom) return
  rememberedFrom = entries.length
  libraryLines = entries.flatMap((entry) => [...entry.headlines, ...entry.offers]).map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => lineTokens(line).length >= 3)
}

export function clearLibraryLines(): void {
  libraryLines = []
  rememberedFrom = -1
}

/** True when the line is too close to any library headline or offer. Short lines (under 3 content words) are not judged. */
export function copiesLibrary(line: string, extra: readonly ResearchEntry[] = []): boolean {
  if (lineTokens(line).length < 3) return false
  const pool = extra.length > 0
    ? [...libraryLines, ...extra.flatMap((entry) => [...entry.headlines, ...entry.offers])]
    : libraryLines
  return pool.some((source) => lineTokens(source).length >= 3 && lineOverlap(line, source) >= COPY_THRESHOLD)
}

/** A line that tells the homeowner what is wrong with their house, or that they "qualify". */
const CLAIM = /\byou(?:'ve| have| may have| might have)? (?:got )?(?:hail|storm|wind|roof|water) damage\b|\byou (?:qualify|are qualified|have been selected|were selected|are approved|have won)\b|\byour roof (?:is|has been) damaged\b|\bdamage alert\b|^stop!|\b(?:hail|storm|wind|ice)\b[\w\s]{0,12}\b(?:hit|damaged|damaging|struck|ruined)\b[\w\s]{0,6}\byour\b/i

export function makesClaim(line: string): boolean {
  return CLAIM.test(line)
}

export type OfferKind = "financing" | "senior" | "discount" | "free" | "metal" | "gutter" | "storm" | "repair"

const KIND: Record<OfferKind, RegExp> = {
  financing: /\b(?:0%|financ\w*|no payments?|pay(?:ing)? (?:over time|later|monthly)|apr|monthly)\b/i,
  senior: /\bseniors?\b|\bretire\w*\b/i,
  discount: /\$\s?\d|\b\d+%\s*off\b|\boff\b|\bsav(?:e|ings)\b|\bdiscount\b|\bfor less\b|\bcheaper\b/i,
  free: /\bfree\b|\bno[- ]cost\b|\$\s*0\b|\binspection\b/i,
  metal: /\bmetal\b/i,
  gutter: /\bgutters?\b/i,
  storm: /\b(?:storm|hail|hurricane|wind)\b/i,
  repair: /\brepairs?\b|\bleaks?\b|\bmissing shingles?\b/i,
}

/** The offer kinds named in the business's own offer and goal. The business name is ignored. */
export function offerKinds(offer: string, goal = ""): Set<OfferKind> {
  const text = `${offer} ${goal}`
  const kinds = new Set<OfferKind>()
  for (const [kind, pattern] of Object.entries(KIND) as [OfferKind, RegExp][]) if (pattern.test(text)) kinds.add(kind)
  return kinds
}

/**
 * A headline matches the offer when every offer kind it names is in the offer.
 * Storm and repair language is allowed for storm and repair businesses only.
 */
export function headlineFitsOffer(headline: string, offer: string, goal = "", businessName = ""): boolean {
  const allowed = offerKinds(offer, goal)
  if (/\b(?:storm|hail|hurricane|restoration)\b/i.test(businessName)) allowed.add("storm")
  for (const [kind, pattern] of Object.entries(KIND) as [OfferKind, RegExp][]) {
    if (!pattern.test(headline)) continue
    if (allowed.has(kind)) continue
    if (kind === "discount" && (allowed.has("free") || allowed.has("financing"))) return false
    if (kind === "repair" && (allowed.has("storm") || allowed.has("free"))) continue
    return false
  }
  return true
}

/** All the checks a card headline must pass. */
export function headlinePasses(input: { headline: string; offer: string; goal?: string; businessName?: string; extra?: readonly ResearchEntry[] }): boolean {
  const line = input.headline.replace(/\s+/g, " ").trim()
  const words = line.split(/\s+/).filter(Boolean)
  if (words.length < 3 || words.length > 10) return false
  if (makesClaim(line)) return false
  if (!headlineFitsOffer(line, input.offer, input.goal, input.businessName)) return false
  if (copiesLibrary(line, input.extra)) return false
  return true
}

export function sameHeadline(a: string, b: string): boolean {
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  return Boolean(a) && norm(a) === norm(b)
}
