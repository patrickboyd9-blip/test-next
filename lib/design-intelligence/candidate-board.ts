import type { GenerateDirectionsResult } from "@/lib/campaign-creator/creative-engine"
import type { CreativeCanvas } from "@/lib/campaign-creator/creative-canvas"
import type { CampaignBrief, CreativeDirection, CreativeSpec } from "@/lib/campaign-creator/types"
import { MEDICARE_AGENT_DISCLAIMER, isMedicareAgentBrief } from "@/lib/campaign-creator/medicare-compliance"

import { directDesign } from "./art-director"
import { critiqueCard } from "./critic"
import { gradeComposition, type CompositionGrade } from "./composition-grade"
import { emptyCost, logTokenCost, type TokenCost } from "./cost"
import { composeGridCard, type GridCard } from "./grid-composer"
import { loadLibrary, type LibraryRecord } from "./library"
import { requestModelRationale } from "./model"
import { criticUsesVision, directorMode, trimFromCanvas } from "./pipeline"
import type { DesignRationale, GridName, TrimSize } from "./rationale"
import { selectReferences, type ReferenceSelection } from "./select"
import { tasteSignalsForOwner } from "./concept-feedback"
import {
  citationsForFamily,
  guidanceFromRetrieval,
  retrieveTaste,
  tasteQueryForBrief,
  type TastePick,
  type TasteSignals,
} from "./taste-retrieval"
import { briefHasNumeralOffer } from "./vertical"
import { loadTasteCorpus, visionTasteStore, type VisionTaste } from "./vision-taste"
import { referencePicksForCritique, requestComparativeCritique } from "./vision-critic"

/**
 * Generates a board of composition families, ranks them, and keeps three
 * that do not repeat a family. The painter is unchanged. Each family is a
 * different Design Rationale the existing composer can place.
 */

export const DEFAULT_CANDIDATE_COUNT = 12
const SURFACE = 3

interface Family {
  id: string
  grid: GridName
  alignment: "left" | "center"
  hero: "offer" | "headline"
  offerRatio: number
  eye: DesignRationale["eye_path"]["pattern"]
  feel: string
  placement: string
  photo: DesignRationale["photo_brief"]["placement"]
  summary: string
}

export const COMPOSITION_FAMILIES: readonly Family[] = [
  { id: "open-canvas-offer", grid: "full-bleed-plus-panel", alignment: "left", hero: "offer", offerRatio: 1.9, eye: "Z", feel: "integrated", placement: "The figure floats on the open field in the brand color.", photo: "full_bleed", summary: "One price floats on the open field." },
  { id: "open-canvas-headline", grid: "full-bleed-plus-panel", alignment: "left", hero: "headline", offerRatio: 0.5, eye: "F", feel: "integrated", placement: "The headline sits on the open field in the brand color.", photo: "full_bleed", summary: "A short headline sits on the open field." },
  { id: "thirds-offer", grid: "thirds", alignment: "left", hero: "offer", offerRatio: 1.8, eye: "Z", feel: "panel", placement: "The figure leads a narrow quiet column.", photo: "panel_bleed_two_edges", summary: "The offer leads a narrow column." },
  { id: "thirds-question", grid: "thirds", alignment: "left", hero: "headline", offerRatio: 0.5, eye: "F", feel: "editorial", placement: "A short question leads. The offer stays second.", photo: "panel_bleed_two_edges", summary: "A question leads the quiet column." },
  { id: "split-offer", grid: "split-40-60", alignment: "left", hero: "offer", offerRatio: 1.75, eye: "Z", feel: "panel", placement: "The figure owns the type half.", photo: "panel_bleed_two_edges", summary: "The offer owns one half of the card." },
  { id: "split-story", grid: "split-40-60", alignment: "left", hero: "headline", offerRatio: 0.48, eye: "diagonal", feel: "editorial", placement: "The headline owns the type half.", photo: "panel_bleed_two_edges", summary: "The story owns one half of the card." },
  { id: "bottom-band-offer", grid: "bands", alignment: "left", hero: "offer", offerRatio: 1.85, eye: "stacked-bands", feel: "integrated", placement: "One band at the foot holds the offer and the response.", photo: "full_bleed", summary: "One band at the foot holds the offer." },
  { id: "bottom-band-quiet", grid: "bands", alignment: "center", hero: "headline", offerRatio: 0.5, eye: "stacked-bands", feel: "calm", placement: "A quiet band holds a short headline.", photo: "full_bleed", summary: "A quiet band under the photograph." },
  { id: "centered-numeral", grid: "centered-stack", alignment: "center", hero: "offer", offerRatio: 2, eye: "Z", feel: "integrated", placement: "One numeral sits near the optical center.", photo: "full_bleed", summary: "One numeral sits in the middle of the photograph." },
  { id: "centered-calm", grid: "centered-stack", alignment: "center", hero: "headline", offerRatio: 0.45, eye: "F", feel: "calm", placement: "A short calm line sits in the middle.", photo: "full_bleed", summary: "A short line sits in the middle." },
  { id: "diagonal-offer", grid: "thirds", alignment: "left", hero: "offer", offerRatio: 1.7, eye: "diagonal", feel: "urgent", placement: "The eye moves from the work to the figure to the phone.", photo: "panel_bleed_two_edges", summary: "The eye runs from the work to the price." },
  { id: "stacked-offer", grid: "bands", alignment: "left", hero: "offer", offerRatio: 1.7, eye: "stacked-bands", feel: "urgent", placement: "The offer stacks above a single response row.", photo: "full_bleed", summary: "The offer stacks above one response row." },
]

export interface ScoredCandidate {
  familyId: string
  grid: GridName
  feel: string
  summary: string
  directionIndex: number
  rationale: DesignRationale
  card: GridCard
  grade: CompositionGrade
  spec: CreativeSpec
  costs: TokenCost[]
  redesigned: boolean
}

export interface BoardResult {
  surfaced: ScoredCandidate[]
  retrieved: TastePick[]
  considered: number
}

export function candidateCount(env: NodeJS.ProcessEnv): number {
  const parsed = Number(env.DESIGN_CANDIDATE_COUNT ?? DEFAULT_CANDIDATE_COUNT)
  if (!Number.isFinite(parsed)) return DEFAULT_CANDIDATE_COUNT
  return Math.max(3, Math.min(16, Math.round(parsed)))
}

export async function applyStudioBoard(
  brief: CampaignBrief,
  result: GenerateDirectionsResult,
  canvas?: CreativeCanvas,
  options?: { env?: NodeJS.ProcessEnv; ownerId?: string; records?: LibraryRecord[]; tastes?: VisionTaste[] }
): Promise<GenerateDirectionsResult> {
  const env = options?.env ?? process.env
  if (env.DESIGN_INTELLIGENCE === "off" || env.DESIGN_CANDIDATE_BOARD === "off") {
    const { applyDesignIntelligence } = await import("./pipeline")
    return applyDesignIntelligence(brief, result, canvas, env)
  }
  if (result.directions.length === 0) return result
  const board = await rankCandidates({
    brief,
    directions: result.directions,
    trim: trimFromCanvas(canvas),
    env,
    ownerId: options?.ownerId,
    records: options?.records,
    tastes: options?.tastes,
  })
  return applyBoard(result, board)
}

export async function rankCandidates(input: {
  brief: CampaignBrief
  directions: CreativeDirection[]
  trim: TrimSize
  env?: NodeJS.ProcessEnv
  ownerId?: string
  records?: LibraryRecord[]
  tastes?: VisionTaste[]
  signals?: TasteSignals
}): Promise<BoardResult> {
  const env = input.env ?? process.env
  const records = input.records ?? await safeLibrary()
  const selection = selectReferences(records, input.brief)
  const tastes = input.tastes ?? await safeTastes()
  const signals = input.signals ?? await safeSignals(input.ownerId)
  const retrieved = retrieveTaste({ tastes, brief: input.brief, signals, limit: 4 })
  const guidance = guidanceFromRetrieval(retrieved, signals)
  const costs: TokenCost[] = []
  let base = directDesign({ brief: input.brief, selection, trim: input.trim }).rationale
  if (directorMode(env) === "model") {
    const model = await requestModelRationale({
      brief: input.brief,
      selection,
      trim: input.trim,
      env,
      guidance,
    })
    const note = {
      cardId: "board",
      step: "art-director" as const,
      model: model.usage?.model ?? "rules",
      inputTokens: model.usage?.inputTokens ?? 0,
      outputTokens: model.usage?.outputTokens ?? 0,
      estimatedUsd: 0,
    }
    costs.push(note)
    logTokenCost(note)
    base = directDesign({ brief: input.brief, selection, trim: input.trim, proposed: model.rationale }).rationale
  } else {
    const rules = emptyCost("board", "art-director")
    costs.push(rules)
    logTokenCost(rules)
  }
  const families = orderFamilies(tasteQueryForBrief(input.brief).feel, signals).slice(0, candidateCount(env))
  const built = families.map((family, index) => {
    const directionIndex = index % input.directions.length
    const spec = input.directions[directionIndex]?.spec ?? {}
    return scoreFamily({
      family,
      brief: input.brief,
      selection,
      trim: input.trim,
      base,
      spec,
      directionIndex,
      costs,
      retrieved,
    })
  })
  const revised = built.flatMap((candidate) => {
    if (candidate.grade.cleared) return [candidate]
    const redesigned = redesignOnce(candidate, input, selection, base, retrieved)
    return redesigned.familyId === candidate.familyId ? [candidate] : [candidate, redesigned]
  })
  const visioned = await maybeVision(revised, retrieved, records, input.brief, env)
  const surfaced = chooseDiverse(visioned, input.directions.length).slice(0, SURFACE)
  return { surfaced, retrieved, considered: families.length }
}

function scoreFamily(input: {
  family: Family
  brief: CampaignBrief
  selection: ReferenceSelection
  trim: TrimSize
  base: DesignRationale
  spec: CreativeSpec
  directionIndex: number
  costs: TokenCost[]
  retrieved: TastePick[]
  redesigned?: boolean
}): ScoredCandidate {
  const rationale = rationaleForFamily(input.base, input.family, input)
  const card = composeGridCard({
    rationale,
    spec: input.spec,
    businessName: input.brief.businessInfo?.name,
    disclaimer: isMedicareAgentBrief(input.brief) ? MEDICARE_AGENT_DISCLAIMER : null,
  })
  const copy = [input.spec.headline, input.spec.offer, input.spec.body, input.spec.phone, input.brief.businessInfo?.name]
    .filter(Boolean)
    .join(" ")
  const critique = critiqueCard(card, rationale, copy)
  const sampled = gradeComposition({
    card,
    rationale,
    autoFails: critique.autoFails,
    worstContrast: critique.autoFails.includes("AF1") ? 3 : 7,
  })
  return {
    familyId: input.family.id,
    grid: rationale.grid.name,
    feel: input.family.feel,
    summary: input.family.summary,
    directionIndex: input.directionIndex,
    rationale,
    card,
    grade: sampled,
    spec: input.spec,
    costs: input.costs,
    redesigned: Boolean(input.redesigned),
  }
}

function redesignOnce(
  candidate: ScoredCandidate,
  input: { brief: CampaignBrief; trim: TrimSize },
  selection: ReferenceSelection,
  base: DesignRationale,
  retrieved: TastePick[]
): ScoredCandidate {
  const next = COMPOSITION_FAMILIES.find((family) => family.id === "open-canvas-offer" && family.id !== candidate.familyId)
    ?? COMPOSITION_FAMILIES.find((family) => family.id === "bottom-band-offer")
    ?? COMPOSITION_FAMILIES[0]!
  const revised = scoreFamily({
    family: next,
    brief: input.brief,
    selection,
    trim: input.trim,
    base,
    spec: candidate.spec,
    directionIndex: candidate.directionIndex,
    costs: candidate.costs,
    retrieved,
    redesigned: true,
  })
  if (revised.grade.score >= candidate.grade.score) return revised
  return { ...candidate, redesigned: true }
}

function chooseDiverse(candidates: ScoredCandidate[], directionCount: number): ScoredCandidate[] {
  const used = new Set<string>()
  const chosen: ScoredCandidate[] = []
  for (let index = 0; index < directionCount; index += 1) {
    const options = candidates
      .filter((candidate) => candidate.directionIndex === index)
      .sort((a, b) => Number(b.grade.cleared) - Number(a.grade.cleared) || b.grade.score - a.grade.score)
    const pick = options.find((candidate) => !used.has(candidate.familyId)) ?? options[0]
    if (!pick) continue
    used.add(pick.familyId)
    chosen[index] = pick
  }
  return chosen.filter((candidate): candidate is ScoredCandidate => Boolean(candidate))
}

function applyBoard(result: GenerateDirectionsResult, board: BoardResult): GenerateDirectionsResult {
  const best = [...board.surfaced].sort((a, b) => b.grade.score - a.grade.score)[0]
  const directions = result.directions.map((direction, index) => {
    const winner = board.surfaced.find((candidate) => candidate.directionIndex === index)
    if (!winner) return { ...direction, recommended: false }
    const cited = citationsForFamily(board.retrieved, winner.feel)
    const sources = cited.map((pick) => ({
      mmrId: pick.id,
      title: pick.principle.split(".")[0] || pick.principle,
      whyItWorks: pick.principle,
    }))
    return {
      ...direction,
      recommended: best ? winner === best : false,
      oneLineDifference: winner.summary,
      spec: {
        ...direction.spec,
        designRationale: winner.rationale,
        palette: [
          winner.rationale.palette.neutral_hex[0] ?? "#F4F1EA",
          winner.rationale.palette.neutral_hex[1] ?? "#1A1A1A",
          winner.rationale.palette.accent_hex,
        ],
      },
      research: {
        sources,
        layoutSummary: winner.summary,
        parameters: direction.research?.parameters ?? {
          headlineScale: winner.rationale.scale_ratios.headline_to_body_cap,
          headlinePosition: "on_color_field",
          photoShare: winner.card.photoAreaPct / 100,
          photoCrop: "open",
          offerBadge: "none",
          colorBlock: "field",
        },
        quality: {
          score: Math.round((winner.grade.score / 10) * 10) / 10,
          rubricPassed: winner.grade.cleared ? 10 : 6,
          rubricTotal: 10,
          hierarchy: winner.grade.letter.startsWith("A") ? 2 : 1,
          legibility: winner.grade.hardGate ? 0 : 2,
          offerClarity: winner.rationale.scale_ratios.hero === "offer" ? 2 : 1,
          photoRelevance: 1,
          craftResemblance: 1,
          attempts: winner.redesigned ? 2 : 1,
          notes: [
            `${winner.grade.scoreKind === "vision" ? "Vision" : "Machine estimate"} ${winner.grade.letter} (${winner.grade.score}).`,
            winner.grade.explanation,
            winner.grade.cleared ? "Cleared B." : "Below B after one redesign. Kept as the best remaining attempt.",
            `Retrieved ${board.retrieved.map((pick) => pick.id).join(", ") || "none"}.`,
            `Family ${winner.familyId}.`,
          ],
        },
      },
    }
  })
  const recommended = directions.find((direction) => direction.recommended) ?? directions[0]
  return {
    ...result,
    directions,
    recommendedDirectionId: recommended?.id ?? result.recommendedDirectionId,
    recommendation: result.recommendation
      ? { ...result.recommendation, directionId: recommended?.id ?? result.recommendation.directionId }
      : result.recommendation,
  }
}

function rationaleForFamily(
  base: DesignRationale,
  family: Family,
  input: { brief: CampaignBrief; selection: ReferenceSelection; trim: TrimSize; retrieved: TastePick[] }
): DesignRationale {
  const numeral = briefHasNumeralOffer(input.brief) && input.selection.vertical !== "medicare_insurance"
  const hero = input.selection.vertical === "medicare_insurance" || !numeral ? "headline" : family.hero
  const proposed: DesignRationale = {
    ...base,
    grid: { name: family.grid, alignment: family.alignment, intentional_break: family.id },
    scale_ratios: {
      ...base.scale_ratios,
      hero,
      offer_to_headline_cap: hero === "offer" ? family.offerRatio : 0.55,
      headline_to_body_cap: Math.max(2.5, base.scale_ratios.headline_to_body_cap),
      offer_to_body: hero === "offer" ? 5 : Math.max(1.5, base.scale_ratios.offer_to_body),
    },
    eye_path: { pattern: family.eye, stops: base.eye_path.stops },
    focal_element: {
      ...base.focal_element,
      kind: hero === "offer" ? "offer_numeral" : base.focal_element.kind === "offer_numeral" ? "photograph_subject" : base.focal_element.kind,
      description: family.placement.length >= 8 ? family.placement : base.focal_element.description,
      visual_weight_pct: 42,
      lead_modality: hero === "offer" ? "offer_field" : "image",
      lead_modality_area_pct: 70,
    },
    offer_treatment: {
      ...base.offer_treatment,
      kind: hero === "offer" ? "numeral_hero" : input.selection.vertical === "medicare_insurance" ? "concrete_step_no_discount" : "headline_is_the_offer",
      placement: family.placement,
    },
    photo_brief: { ...base.photo_brief, placement: family.photo },
    principles_invoked: [...base.principles_invoked.slice(0, 4), ...input.retrieved.slice(0, 2).map((pick) => pick.id)].slice(0, 8),
  }
  if (proposed.principles_invoked.length < 3) {
    proposed.principles_invoked = ["P1", "P4", "P7"]
  }
  return directDesign({
    brief: input.brief,
    selection: input.selection,
    trim: input.trim,
    proposed,
  }).rationale
}

function orderFamilies(feel: string, signals?: TasteSignals): Family[] {
  return COMPOSITION_FAMILIES.map((family, index) => ({ family, index, score: familyRank(family, feel, signals) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.family)
}

function familyRank(family: Family, feel: string, signals?: TasteSignals): number {
  let score = 0
  if (family.feel === feel) score += 3
  if (signals?.likedFamilies.includes(family.id)) score += 6
  if (signals?.dislikedFamilies.includes(family.id)) score -= 8
  return score
}

async function maybeVision(
  candidates: ScoredCandidate[],
  retrieved: TastePick[],
  records: LibraryRecord[],
  brief: CampaignBrief,
  env: NodeJS.ProcessEnv
): Promise<ScoredCandidate[]> {
  if (!criticUsesVision(env) || env.DESIGN_CANDIDATE_RENDERS === "off") return candidates
  const deadline = Date.now() + budgetMs(env)
  const refs = referencePicksForCritique(retrieved)
  const images = await loadReferenceImages(refs, records, env)
  if (images.length < 2) return candidates
  const shortlist = [...candidates].sort((a, b) => b.grade.score - a.grade.score).slice(0, 6)
  const updates = new Map<string, CompositionGrade>()
  await mapPool(shortlist, 3, async (candidate) => {
    if (Date.now() > deadline) return
    const png = await renderPreview(candidate, env)
    if (!png) return
    const vision = await requestComparativeCritique({
      png,
      references: images,
      vertical: candidate.rationale.vertical,
      env,
      cardId: candidate.familyId,
    })
    if (!vision) return
    const critique = critiqueCard(candidate.card, candidate.rationale, candidate.spec.headline ?? "")
    updates.set(candidateKey(candidate), gradeComposition({
      card: candidate.card,
      rationale: candidate.rationale,
      autoFails: critique.autoFails,
      worstContrast: critique.autoFails.includes("AF1") ? 3 : 7,
      vision: { score: vision.score, explanation: vision.explanation },
    }))
  })
  if (updates.size === 0) return candidates
  return candidates.map((candidate) => {
    const grade = updates.get(candidateKey(candidate))
    return grade ? { ...candidate, grade } : candidate
  })
}

function candidateKey(candidate: ScoredCandidate): string {
  return `${candidate.directionIndex}:${candidate.familyId}:${candidate.redesigned ? "r" : "a"}`
}

async function renderPreview(candidate: ScoredCandidate, env: NodeJS.ProcessEnv): Promise<Buffer | null> {
  try {
    const { renderStudioCardPng } = await import("./studio-render")
    const payload = candidate.spec.qrDestination ?? candidate.spec.website ?? candidate.spec.phone ?? "https://example.com/book"
    return await renderStudioCardPng(candidate.card.front, payload, { ppi: 96 })
  } catch (error) {
    console.info(`[design-intelligence] ${JSON.stringify({ step: "render", error: error instanceof Error ? error.message : "render failed", env: env.DESIGN_CANDIDATE_RENDERS ?? "preview" })}`)
    return null
  }
}

async function loadReferenceImages(
  picks: TastePick[],
  records: LibraryRecord[],
  env: NodeJS.ProcessEnv
): Promise<Array<{ id: string; bytes: Buffer; mediaType: "image/jpeg" | "image/png" | "image/webp"; principle: string }>> {
  const { readRecordImage } = await import("./images")
  const loaded = []
  for (const pick of picks) {
    const record = records.find((item) => item.id === pick.id)
    if (!record) continue
    const image = await readRecordImage(record, env)
    if (!image) continue
    loaded.push({ id: pick.id, bytes: image.bytes, mediaType: image.mediaType, principle: pick.principle })
  }
  return loaded
}

async function mapPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift()
      if (!next) return
      await task(next)
    }
  })
  await Promise.all(workers)
}

function budgetMs(env: NodeJS.ProcessEnv): number {
  const parsed = Number(env.DESIGN_BOARD_BUDGET_MS ?? 75000)
  if (!Number.isFinite(parsed)) return 75000
  return Math.max(5000, Math.min(90000, parsed))
}

async function safeLibrary(): Promise<LibraryRecord[]> {
  try {
    return await loadLibrary()
  } catch {
    return []
  }
}

async function safeTastes(): Promise<VisionTaste[]> {
  try {
    return await loadTasteCorpus(visionTasteStore())
  } catch {
    return await loadTasteCorpus()
  }
}

async function safeSignals(ownerId?: string): Promise<TasteSignals | undefined> {
  if (!ownerId) return undefined
  try {
    return await tasteSignalsForOwner(ownerId)
  } catch {
    return undefined
  }
}
