import type { CampaignBrief, CreativeDirection } from "@/lib/campaign-creator/types"
import { MEDICARE_AGENT_DISCLAIMER, isMedicareAgentBrief } from "@/lib/campaign-creator/medicare-compliance"

import { directDesign } from "./art-director"
import { composeDirectedCard, rationaleForFamily } from "./composition-family"
import type { CompositionFamily } from "./composition-read"
import { isDistinctPanel, isFloatingBox, isOpenCanvas, textColorDiffers } from "./composition-read"
import { emptyCost, estimateUsd, type TokenCost } from "./cost"
import { critiqueCard, type Critique } from "./critic"
import { letterForScore, meetsBar } from "./critic-calibration"
import type { GridCard } from "./grid-composer"
import { loadTasteSignals, type TasteSignal } from "./feedback"
import type { LibraryRecord } from "./library"
import { requestModelRationale, requestVisionCritique, type ModelUsage } from "./model"
import type { DesignRationale, TrimSize } from "./rationale"
import { selectReferences } from "./select"
import {
  mergeTaste,
  retrieveTaste,
  writtenTasteFromLibrary,
  type RetrievedTaste,
} from "./taste-retrieval"
import { listTaste, tasteStore } from "./taste-store"
import { readRecordImage } from "./images"

/**
 * Generates a spread of compositions, scores them, and keeps the best diverse
 * three. The count is DESIGN_CANDIDATE_COUNT (default 12, never more than 12).
 * Vision grading runs in parallel on a short list so a generation stays inside
 * about a minute and a half.
 */

export interface ScoredCandidate {
  sourceId: string
  source: CreativeDirection
  family: CompositionFamily
  rationale: DesignRationale
  card: GridCard
  critique: Critique
  cites: RetrievedTaste[]
  costs: TokenCost[]
  edits: string[]
  recommended: boolean
}

const PANEL_CYCLE: CompositionFamily[] = ["panel-left", "panel-right", "bottom-band", "centered-card", "split", "boxed-card"]
const OPEN_CYCLE: CompositionFamily[] = ["cutout-right", "cutout-left", "stacked-open", "offer-float"]

export function candidateCount(env: NodeJS.ProcessEnv): number {
  const parsed = Number(env.DESIGN_CANDIDATE_COUNT ?? 12)
  if (!Number.isFinite(parsed)) return 12
  return Math.max(3, Math.min(12, Math.round(parsed)))
}

export function visionCap(env: NodeJS.ProcessEnv): number {
  if (env.DESIGN_CRITIC === "machine" || !env.ANTHROPIC_API_KEY?.trim()) return 0
  const parsed = Number(env.DESIGN_VISION_CAP ?? 4)
  if (!Number.isFinite(parsed)) return 4
  return Math.max(0, Math.min(6, Math.round(parsed)))
}

export function familiesForCount(count: number): CompositionFamily[] {
  const cycle = [...PANEL_CYCLE, ...OPEN_CYCLE, ...OPEN_CYCLE]
  return Array.from({ length: count }, (_, index) => cycle[index % cycle.length]!)
}

export async function scoreCandidates(input: {
  brief: CampaignBrief
  directions: CreativeDirection[]
  trim: TrimSize
  records: LibraryRecord[]
  env?: NodeJS.ProcessEnv
  ownerId?: string
  businessName?: string
}): Promise<{ candidates: ScoredCandidate[]; retrieved: RetrievedTaste[] }> {
  const env = input.env ?? process.env
  const directions = input.directions.filter((direction) => direction.spec)
  if (directions.length === 0) return { candidates: [], retrieved: [] }
  const selection = selectReferences(input.records, input.brief)
  const signals = input.ownerId ? await loadTasteSignals(input.ownerId).catch(() => [] as TasteSignal[]) : []
  const retrieved = await loadRetrieved(input.brief, input.records, signals)
  let proposed: unknown
  const costs: TokenCost[] = []
  if (env.DESIGN_DIRECTOR !== "rules" && env.ANTHROPIC_API_KEY?.trim()) {
    const model = await requestModelRationale({
      brief: input.brief,
      selection,
      trim: input.trim,
      env,
      retrieved,
      signals,
    })
    proposed = model.rationale
    costs.push(usageCost("generation", "art-director", model.usage, env))
  } else {
    costs.push(emptyCost("generation", "art-director"))
  }
  const base = directDesign({ brief: input.brief, selection, trim: input.trim, proposed }).rationale
  const families = familiesForCount(candidateCount(env))
  const disclaimer = isMedicareAgentBrief(input.brief) ? MEDICARE_AGENT_DISCLAIMER : null
  let scored: ScoredCandidate[] = families.map((family, index) => {
    const source = directions[index % directions.length]!
    const rationale = rationaleForFamily(base, family)
    const card = composeDirectedCard({
      rationale,
      spec: source.spec,
      businessName: input.businessName ?? input.brief.businessInfo?.name,
      disclaimer,
    })
    const critique = critiqueCard(card, rationale, cardCopy(source, input.businessName ?? input.brief.businessInfo?.name))
    return {
      sourceId: source.id,
      source,
      family,
      rationale,
      card,
      critique,
      cites: [] as RetrievedTaste[],
      costs: index === 0 ? costs : [],
      edits: [] as string[],
      recommended: false,
    }
  })

  scored = await applyVision(scored, input.brief, retrieved, env)
  scored = redesignBelowBar(scored, input.brief, disclaimer)
  const picked = pickDiverse(scored, 3, retrieved)
  return { candidates: picked, retrieved }
}

async function loadRetrieved(brief: CampaignBrief, records: LibraryRecord[], signals: TasteSignal[]): Promise<RetrievedTaste[]> {
  const vision = await listTaste(tasteStore()).catch(() => [])
  const pool = mergeTaste(vision, writtenTasteFromLibrary(records.length > 0 ? records : undefined))
  return retrieveTaste({ analyses: pool, brief, signals, limit: 4 })
}

async function applyVision(
  scored: ScoredCandidate[],
  brief: CampaignBrief,
  retrieved: RetrievedTaste[],
  env: NodeJS.ProcessEnv
): Promise<ScoredCandidate[]> {
  const cap = visionCap(env)
  if (cap === 0) return scored
  const started = Date.now()
  const budget = Number(env.DESIGN_CANDIDATE_BUDGET_MS ?? 75_000)
  const shortlist = [...scored]
    .filter((item) => !item.critique.autoFails.includes("AF1"))
    .sort((a, b) => b.critique.visionScore - a.critique.visionScore)
    .slice(0, cap)
  const references = await referenceImages(retrieved, env)
  await Promise.all(
    shortlist.map(async (item) => {
      if (Date.now() - started > budget) return
      let png: Buffer
      try {
        const { renderStudioCardPng } = await import("./studio-render")
        png = await renderStudioCardPng(item.card.front, item.source.spec.qrDestination ?? item.source.spec.website ?? item.source.spec.phone ?? "https://example.com/book")
      } catch (error) {
        console.info(`[design-intelligence] ${JSON.stringify({ step: "critic", error: error instanceof Error ? error.message : "render failed" })}`)
        return
      }
      const vision = await requestVisionCritique({ png, env, vertical: item.rationale.vertical, references })
      if (!vision) return
      item.costs = [...item.costs, usageCost(item.sourceId, "critic", vision.usage, env)]
      item.critique = blendVision(item.critique, item.card, vision.score, vision.explanation, vision.edit)
      item.edits = [...item.edits, vision.explanation]
    })
  )
  void brief
  return scored
}

export function blendVision(machine: Critique, card: GridCard, visionScore: number, explanation: string, edit: string): Critique {
  let score = visionScore
  if (machine.autoFails.includes("AF1")) score = Math.min(score, 40)
  else if (isFloatingBox(card)) score = Math.min(score, 67)
  else if (isDistinctPanel(card)) score = Math.min(score, 71)
  else if (isOpenCanvas(card) && textColorDiffers(card) && machine.autoFails.length === 0) {
    score = visionScore >= 75 ? Math.max(visionScore, 90) : visionScore
  }
  const letter = letterForScore(score, machine.autoFails)
  const passed = machine.autoFails.length === 0 && meetsBar(letter)
  return {
    ...machine,
    visionScore: Math.round(score * 10) / 10,
    letter,
    passed,
    explanation: explanation || machine.explanation,
    edit: passed ? null : edit || machine.edit,
    scoreKind: "vision",
  }
}

function redesignBelowBar(
  scored: ScoredCandidate[],
  brief: CampaignBrief,
  disclaimer: string | null
): ScoredCandidate[] {
  return scored.map((item, index) => {
    if (meetsBar(item.critique.letter) || item.critique.autoFails.some((fail) => fail === "AF3" || fail === "AF7" || fail === "AF10")) {
      return item
    }
    const family = OPEN_CYCLE[index % OPEN_CYCLE.length]!
    if (item.family === family) return item
    const rationale = rationaleForFamily(item.rationale, family)
    const card = composeDirectedCard({
      rationale,
      spec: item.source.spec,
      businessName: brief.businessInfo?.name,
      disclaimer,
    })
    const critique = critiqueCard(card, rationale, cardCopy(item.source, brief.businessInfo?.name))
    if (!meetsBar(critique.letter) && critique.visionScore <= item.critique.visionScore) return item
    return {
      ...item,
      family,
      rationale,
      card,
      critique,
      edits: [...item.edits, "Rebuilt on the open ground because the first composition was under a B."],
    }
  })
}

export function pickDiverse(scored: ScoredCandidate[], count: number, retrieved: RetrievedTaste[]): ScoredCandidate[] {
  const sorted = [...scored].sort((a, b) => Number(b.critique.passed) - Number(a.critique.passed) || b.critique.visionScore - a.critique.visionScore)
  const picked: ScoredCandidate[] = []
  const families = new Set<string>()
  for (const item of sorted) {
    if (!item.critique.passed) continue
    if (families.has(item.family)) continue
    families.add(item.family)
    picked.push(item)
    if (picked.length === count) break
  }
  for (const item of sorted) {
    if (picked.length === count) break
    if (picked.includes(item) || families.has(item.family)) continue
    families.add(item.family)
    picked.push({
      ...item,
      edits: item.critique.passed ? item.edits : [...item.edits, "Under a B after one redesign. Kept only so the set is not empty."],
    })
  }
  const used = new Set<string>()
  return picked.map((item, index) => {
    let sourceId = item.source.id
    if (used.has(sourceId)) sourceId = `${item.source.id}-${index + 1}`
    used.add(sourceId)
    return {
      ...item,
      sourceId,
      cites: rotateCites(retrieved, index),
      recommended: index === 0,
    }
  })
}

function rotateCites(pool: readonly RetrievedTaste[], index: number): RetrievedTaste[] {
  if (pool.length === 0) return []
  const first = pool[index % pool.length]!
  const second = pool[(index + 1) % pool.length]
  return second && second.id !== first.id ? [first, second] : [first]
}

async function referenceImages(retrieved: RetrievedTaste[], env: NodeJS.ProcessEnv) {
  const images: Array<{ id: string; bytes: Buffer; mediaType: "image/jpeg" | "image/png" | "image/webp" }> = []
  const records = await import("./library").then((mod) => mod.loadLibrary())
  for (const item of retrieved) {
    if (images.length === 3) break
    if (gradeRankSafe(item.grade) > 1) continue
    const record = records.find((row) => row.id === item.id)
    if (!record) continue
    const image = await readRecordImage(record, env)
    if (!image) continue
    images.push({ id: item.id, bytes: image.bytes, mediaType: image.mediaType })
  }
  return images
}

function gradeRankSafe(grade: string): number {
  const order = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"]
  const index = order.indexOf(grade)
  return index < 0 ? order.length : index
}

function cardCopy(direction: CreativeDirection, businessName?: string): string {
  const spec = direction.spec
  return [spec.headline, spec.offer, spec.body, spec.phone, spec.website, businessName].filter(Boolean).join(" ")
}

function usageCost(cardId: string, step: TokenCost["step"], usage: ModelUsage | null, env: NodeJS.ProcessEnv): TokenCost {
  const inputTokens = usage?.inputTokens ?? 0
  const outputTokens = usage?.outputTokens ?? 0
  return {
    cardId,
    step,
    model: usage?.model ?? "rules",
    inputTokens,
    outputTokens,
    estimatedUsd: estimateUsd(inputTokens, outputTokens, env),
  }
}
