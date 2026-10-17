import type { CampaignBrief, CreativeDirection, ResearchQuality } from "@/lib/campaign-creator/types"
import type { GenerateDirectionsResult } from "@/lib/campaign-creator/creative-engine"
import { MEDICARE_AGENT_DISCLAIMER, isMedicareAgentBrief } from "@/lib/campaign-creator/medicare-compliance"
import type { CreativeCanvas } from "@/lib/campaign-creator/creative-canvas"

import { directDesign } from "./art-director"
import { emptyCost, estimateUsd, logTokenCost, type TokenCost } from "./cost"
import {
  CRITIC_ROUND_CAP,
  applyStructuralEdit,
  critiqueCard,
  type Critique,
} from "./critic"
import { scoreCandidates } from "./candidates"
import { composeDirectedCard } from "./composition-family"
import { type GridCard } from "./grid-composer"
import { loadLibrary, type LibraryRecord } from "./library"
import type { DesignRationale, TrimSize } from "./rationale"
import { selectReferences } from "./select"
import type { RetrievedTaste } from "./taste-retrieval"
import { checkSimilarity, type SimilarityResult } from "./similarity"
import { requestModelRationale, type ModelUsage } from "./model"
import { viewSelection, type ImageView } from "./view-images"

export interface DirectedCard {
  rationale: DesignRationale
  card: GridCard
  critique: Critique
  similarity: SimilarityResult
  rounds: number
  edits: string[]
  costs: TokenCost[]
  shown: boolean
  viewed: ImageView[]
}

export async function directOneCard(input: {
  brief: CampaignBrief
  spec: CreativeDirection["spec"]
  businessName?: string
  trim?: TrimSize
  records?: LibraryRecord[]
  env?: NodeJS.ProcessEnv
  cardId?: string
}): Promise<DirectedCard> {
  const env = input.env ?? process.env
  const records = input.records ?? (await loadLibrary())
  const selection = selectReferences(records, input.brief)
  const trim = input.trim ?? "5x8"
  const cardId = input.cardId ?? "card"
  const costs: TokenCost[] = []
  let proposed: unknown
  let modelNote: TokenCost | null = null
  if (directorMode(env) === "model") {
    const model = await requestModelRationale({ brief: input.brief, selection, trim, env })
    proposed = model.rationale
    modelNote = usageCost(cardId, "art-director", model.usage, env)
    costs.push(modelNote)
    logTokenCost(modelNote)
  } else {
    const rules = emptyCost(cardId, "art-director")
    costs.push(rules)
    logTokenCost(rules)
  }
  const viewed = await viewSelection(records, selection, env)
  const directed = directDesign({ brief: input.brief, selection, trim, proposed })
  const repaired = repairCard({
    brief: input.brief,
    spec: input.spec,
    businessName: input.businessName,
    rationale: directed.rationale,
    costs,
    env,
    cardId,
  })
  return noteViews(repaired, viewed)
}

export function repairCard(input: {
  brief: CampaignBrief
  spec: CreativeDirection["spec"]
  businessName?: string
  rationale: DesignRationale
  costs?: TokenCost[]
  env?: NodeJS.ProcessEnv
  cardId?: string
}): DirectedCard {
  const env = input.env ?? process.env
  const cap = criticCap(env)
  let rationale = input.rationale
  let spec = input.spec
  const edits: string[] = []
  let best: DirectedCard | null = null
  const rounds = Math.max(1, cap)
  for (let round = 1; round <= rounds; round += 1) {
    const card = composeDirectedCard({
      rationale,
      spec,
      businessName: input.businessName,
      disclaimer: isMedicareAgentBrief(input.brief) ? MEDICARE_AGENT_DISCLAIMER : null,
    })
    const copy = cardCopy(spec, input.businessName)
    const critique = critiqueCard(card, rationale, copy)
    const similarity = checkSimilarity(card, copy, input.brief)
    const passed = critiquePasses(critique, similarity)
    const attempt: DirectedCard = {
      rationale,
      card,
      critique: passed ? critique : { ...critique, passed: false, edit: critique.edit ?? similarity.reason },
      similarity,
      rounds: round,
      edits: [...edits],
      costs: input.costs ?? [],
      shown: passed,
      viewed: [],
    }
    if (preferAttempt(attempt, best)) best = attempt
    if (passed || round === rounds) break
    if (similarity.tooClose) {
      edits.push(similarity.reason ?? "Shift the panel away from the reference.")
      rationale = applyStructuralEdit(rationale, "similarity")
      continue
    }
    if (critique.autoFails.includes("AF3")) {
      spec = { ...spec, headline: shortenHeadline(spec.headline) }
      edits.push("Shorten the headline to six words or fewer.")
      continue
    }
    edits.push(critique.edit ?? "One structural edit.")
    rationale = applyStructuralEdit(rationale, critique.brokenRule)
  }
  if (!best) throw new Error("Critic produced no attempt.")
  if (!best.shown) {
    best = { ...best, edits: [...best.edits, "Shown as the best attempt. The score stays internal."] }
  }
  return best
}

function preferAttempt(next: DirectedCard, current: DirectedCard | null): boolean {
  if (!current) return true
  if (next.shown !== current.shown) return next.shown
  if (next.critique.autoFails.length !== current.critique.autoFails.length) {
    return next.critique.autoFails.length < current.critique.autoFails.length
  }
  return next.critique.visionScore > current.critique.visionScore
}

export async function applyDesignIntelligence(
  brief: CampaignBrief,
  result: GenerateDirectionsResult,
  canvas?: CreativeCanvas,
  env: NodeJS.ProcessEnv = process.env,
  context?: { ownerId?: string; campaignId?: string }
): Promise<GenerateDirectionsResult> {
  if (env.DESIGN_INTELLIGENCE === "off") return result
  let records: LibraryRecord[] = []
  try {
    records = await loadLibrary()
  } catch {
    records = []
  }
  const selection = records.length > 0 ? selectReferences(records, brief) : null
  const trim = trimFromCanvas(canvas)
  const viewed = selection ? await viewSelection(records, selection, env) : []
  const surfaced = await scoreCandidates({
    brief,
    directions: result.directions,
    trim,
    records,
    env,
    ownerId: context?.ownerId,
    businessName: brief.businessInfo?.name,
  })
  if (surfaced.candidates.length === 0) return result
  const directions = surfaced.candidates.map((candidate) => {
    const directed = noteViews({
      rationale: candidate.rationale,
      card: candidate.card,
      critique: candidate.critique,
      similarity: checkSimilarity(candidate.card, cardCopy(candidate.source.spec, brief.businessInfo?.name), brief),
      rounds: 1,
      edits: candidate.edits,
      costs: candidate.costs,
      shown: candidate.critique.passed,
      viewed,
    }, viewed)
    for (const cost of directed.costs) logTokenCost(cost)
    return attachDirection(withCandidateId(candidate.source, candidate.sourceId), directed, selection, candidate.cites, candidate.recommended)
  })
  const recommended = directions.find((direction) => direction.recommended) ?? directions[0]
  return {
    ...result,
    directions,
    recommendedDirectionId: recommended?.id ?? result.recommendedDirectionId,
    recommendation: recommended
      ? { ...result.recommendation, directionId: recommended.id }
      : result.recommendation,
  }
}

function noteViews(directed: DirectedCard, viewed: ImageView[]): DirectedCard {
  if (viewed.length === 0) return { ...directed, viewed }
  const line = `Viewed ${viewed.map((view) => view.id).join(", ")}.`
  return {
    ...directed,
    viewed,
    edits: directed.edits.includes(line) ? directed.edits : [...directed.edits, line],
  }
}

function withCandidateId(direction: CreativeDirection, id: string): CreativeDirection {
  if (direction.id === id) return direction
  return { ...direction, id }
}

function attachDirection(
  direction: CreativeDirection,
  directed: DirectedCard,
  _selection: unknown,
  cites: RetrievedTaste[] = [],
  recommended = direction.recommended
): CreativeDirection {
  const quality = qualityFrom(directed)
  const sources = cites.map((cite) => ({
    mmrId: cite.id,
    title: cite.principle,
    whyItWorks: cite.principle,
  }))
  return {
    ...direction,
    spec: {
      ...direction.spec,
      designRationale: directed.rationale,
      palette: [
        directed.rationale.palette.neutral_hex[0] ?? "#F4F1EA",
        directed.rationale.palette.neutral_hex[1] ?? directed.rationale.palette.neutral_hex[0] ?? "#1A1A1A",
        directed.rationale.palette.accent_hex,
      ],
    },
    research: {
      sources,
      layoutSummary: layoutSentence(directed.rationale),
      parameters: direction.research?.parameters ?? {
        headlineScale: directed.rationale.scale_ratios.headline_to_body_cap,
        headlinePosition: "on_color_field",
        photoShare: directed.card.photoAreaPct / 100,
        photoCrop: "open",
        offerBadge: "none",
        colorBlock: "field",
      },
      quality,
    },
    recommended,
    oneLineDifference: recommended ? direction.oneLineDifference : familyLine(directed.rationale),
  }
}

function familyLine(rationale: DesignRationale): string {
  const family = rationale.grid.intentional_break.replace(/^family:/, "").replaceAll("-", " ")
  if (family.startsWith("cutout") || family === "offer float" || family === "stacked open") {
    return "Type sits on the open ground, with the subject cut into the layout."
  }
  return "A different arrangement of the same offer."
}

export function qualityFrom(directed: DirectedCard): ResearchQuality {
  return {
    score: Math.round((directed.critique.visionScore / 10) * 10) / 10,
    rubricPassed: directed.critique.passed && !directed.similarity.tooClose ? 10 : directed.critique.autoFails.length === 0 ? 6 : 3,
    rubricTotal: 10,
    hierarchy: directed.critique.dimensions.D1 / 5,
    legibility: directed.critique.dimensions.D4 / 5,
    offerClarity: directed.critique.dimensions.D6 / 5,
    photoRelevance: directed.critique.dimensions.D3 / 5,
    craftResemblance: directed.similarity.tooClose ? 0 : 2,
    attempts: directed.rounds,
    notes: [
      `Internal vision score ${directed.critique.visionScore}. Letter ${directed.critique.letter}. Weighted ${directed.critique.weighted}.`,
      directed.critique.explanation,
      directed.shown ? "Cleared the ship gate." : "Best attempt. Score stays off the card.",
      ...directed.edits,
      ...directed.costs.map((cost) => `Cost ${cost.step} ${cost.model}: ${cost.inputTokens}+${cost.outputTokens} tokens, about $${cost.estimatedUsd.toFixed(4)}.`),
    ],
  }
}

export function layoutSentence(rationale: DesignRationale): string {
  const family = rationale.grid.intentional_break
  if (/family:(cutout|offer-float|stacked-open)/.test(family)) {
    return "The offer and the headline sit on the open ground. The subject is cut into the layout, and the response is one group."
  }
  const hero = rationale.scale_ratios.hero === "offer" ? "One figure leads." : "One short headline leads."
  return `${hero} The photograph and the response sit on a ${rationale.grid.name.replaceAll("-", " ")} grid.`
}

export function trimFromCanvas(canvas?: CreativeCanvas): TrimSize {
  if (!canvas) return "5x8"
  const { shortInches, longInches } = canvas.trimSizeInches
  if (shortInches >= 6 && longInches >= 9) return "6x9"
  return "5x8"
}

export function directorMode(env: NodeJS.ProcessEnv): "rules" | "model" {
  if (env.DESIGN_DIRECTOR === "rules") return "rules"
  if (env.ANTHROPIC_API_KEY?.trim()) return "model"
  return "rules"
}

export function criticUsesVision(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.ANTHROPIC_API_KEY?.trim()) && env.DESIGN_CRITIC !== "machine"
}

export function criticCap(env: NodeJS.ProcessEnv): number {
  const parsed = Number(env.DESIGN_CRITIC_ROUNDS ?? CRITIC_ROUND_CAP)
  if (!Number.isFinite(parsed)) return CRITIC_ROUND_CAP
  return Math.max(1, Math.min(CRITIC_ROUND_CAP, Math.round(parsed)))
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

function cardCopy(spec: CreativeDirection["spec"], businessName?: string): string {
  return [spec.headline, spec.offer, spec.body, spec.phone, spec.website, businessName].filter(Boolean).join(" ")
}

function shortenHeadline(headline: string | undefined): string {
  const words = (headline ?? "").split(/\s+/).filter(Boolean)
  if (words.length <= 6) return headline ?? ""
  return words.slice(0, 6).join(" ")
}

function critiquePasses(critique: Critique, similarity: SimilarityResult): boolean {
  return critique.passed && !similarity.tooClose
}
