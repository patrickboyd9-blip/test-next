import type { GenerateDirectionsResult } from "@/lib/campaign-creator/creative-engine"
import type { CreativeCanvas } from "@/lib/campaign-creator/creative-canvas"
import type { CampaignBrief, CreativeDirection, CreativeSpec } from "@/lib/campaign-creator/types"
import { MEDICARE_AGENT_DISCLAIMER, isMedicareAgentBrief } from "@/lib/campaign-creator/medicare-compliance"

import { directDesign, usesSeparatedPanel, type CompositionMode } from "./art-director"
import { normalizeToneTag, normalizeVerticalTag, selectBlueprints, type MailerBlueprint } from "./blueprint"
import { copyPatternFromText, offerTypeFromText, patternFitsOffer } from "./blueprint-tags"
import { ownerFavoriteIds } from "./owner-favorites"
import { loadBlueprintCorpus } from "./blueprint-store"
import { rebuildFromBlueprint } from "./blueprint-rebuild"
import { critiqueCard } from "./critic"
import { gradeComposition, type CompositionGrade } from "./composition-grade"
import { emptyCost, logTokenCost, type TokenCost } from "./cost"
import { composeGridCard, type GridCard } from "./grid-composer"
import { improveFromWeakness } from "./improve-once"
import { loadLibrary, type LibraryRecord } from "./library"
import { requestModelRationale } from "./model"
import { criticUsesVision, directorMode, trimFromCanvas } from "./pipeline"
import { validateDesignRationale, type DesignRationale, type GridName, type TrimSize } from "./rationale"
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
import { ATTORNEY_AD_LABEL, attorneyAdMark } from "./attorney-compliance"
import { scrubUnstatedAudience, scrubUnstatedName, statedNameFallback } from "./audience-facts"
import { applyOutcomeHeadline, clientFactText, roleForDirection, selectPersuasion, type DirectionRole } from "./persuasion"
import type { ImageryRole, LeadJob } from "@/lib/campaign-creator/types"
import { offerIsFigure } from "./offer-copy"
import { briefHasNumeralOffer } from "./vertical"
import { loadTasteCorpus, visionTasteStore, type VisionTaste } from "./vision-taste"
import { referencePicksForCritique, requestComparativeCritique } from "./vision-critic"

/**
 * Generates a board of composition families, ranks them, and keeps three
 * that do not repeat a composition mode. Each family is a real mode the
 * postcard painter understands: integrated, full-bleed, panel, and the
 * other modes. The mode is written on grid.intentional_break after the
 * art director returns, so the slot recipe cannot collapse the board
 * back to one layout.
 */

export const DEFAULT_CANDIDATE_COUNT = 12
const SURFACE = 3

interface Family {
  id: string
  mode: CompositionMode
  grid: GridName
  alignment: "left" | "center"
  hero: "offer" | "headline"
  offerRatio: number
  headlineToBody: number
  eye: DesignRationale["eye_path"]["pattern"]
  feel: string
  placement: string
  summary: string
}

/** Twelve layouts. The mode is what the painter reads. The id keeps variants apart. */
export const COMPOSITION_FAMILIES: readonly Family[] = [
  { id: "integrated-offer", mode: "integrated", grid: "centered-stack", alignment: "left", hero: "offer", offerRatio: 1.9, headlineToBody: 3.2, eye: "Z", feel: "integrated", placement: "The offer floats on the open canvas, larger than the headline.", summary: "Type and a floating offer sit on the open canvas." },
  { id: "full-bleed-headline", mode: "full-bleed", grid: "full-bleed-plus-panel", alignment: "left", hero: "headline", offerRatio: 0.5, headlineToBody: 2.7, eye: "F", feel: "editorial", placement: "The headline sits on the photograph, with no type panel.", summary: "Type sits on the photograph." },
  { id: "panel-headline", mode: "panel", grid: "thirds", alignment: "left", hero: "headline", offerRatio: 0.7, headlineToBody: 4, eye: "F", feel: "panel", placement: "One text panel holds the headline beside the photograph.", summary: "One text panel beside the photograph." },
  { id: "integrated-headline", mode: "integrated", grid: "centered-stack", alignment: "left", hero: "headline", offerRatio: 0.5, headlineToBody: 3.1, eye: "F", feel: "integrated", placement: "A two-color headline sits on the open canvas.", summary: "A two-color headline on the open canvas." },
  { id: "full-bleed-offer", mode: "full-bleed", grid: "full-bleed-plus-panel", alignment: "left", hero: "offer", offerRatio: 1.8, headlineToBody: 2.8, eye: "Z", feel: "integrated", placement: "The offer sits on the photograph, larger than the headline.", summary: "A large offer sits on the photograph." },
  { id: "panel-offer", mode: "panel", grid: "thirds", alignment: "left", hero: "offer", offerRatio: 1.8, headlineToBody: 3.4, eye: "Z", feel: "panel", placement: "The offer leads inside one text panel.", summary: "The offer leads inside one panel." },
  { id: "dark-offer-field", mode: "dark-offer-field", grid: "thirds", alignment: "left", hero: "offer", offerRatio: 1.75, headlineToBody: 3.2, eye: "Z", feel: "urgent", placement: "The offer sits on a dark field beside the photograph.", summary: "A dark field holds the offer." },
  { id: "overlapping-card", mode: "overlapping-card", grid: "full-bleed-plus-panel", alignment: "left", hero: "headline", offerRatio: 0.55, headlineToBody: 3, eye: "diagonal", feel: "editorial", placement: "A type card overlaps the photograph.", summary: "A type card overlaps the photograph." },
  { id: "type-led", mode: "type-led", grid: "bands", alignment: "left", hero: "headline", offerRatio: 0.5, headlineToBody: 3.6, eye: "stacked-bands", feel: "editorial", placement: "Type leads, and the photograph is a band above it.", summary: "Type leads under a photo band." },
  { id: "calm-column", mode: "calm-column", grid: "thirds", alignment: "left", hero: "headline", offerRatio: 0.48, headlineToBody: 3.1, eye: "F", feel: "calm", placement: "A narrow calm column holds a short headline.", summary: "A narrow column holds the headline." },
  { id: "integrated-calm", mode: "integrated", grid: "centered-stack", alignment: "center", hero: "headline", offerRatio: 0.45, headlineToBody: 2.8, eye: "F", feel: "calm", placement: "A short calm line sits on the open canvas.", summary: "A calm line on the open canvas." },
  { id: "full-bleed-calm", mode: "full-bleed", grid: "full-bleed-plus-panel", alignment: "center", hero: "headline", offerRatio: 0.42, headlineToBody: 2.7, eye: "F", feel: "calm", placement: "A short line sits on a calm area of the photograph.", summary: "A short line on the photograph." },
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
  /** The single biggest weakness the vision critic named, when it ran. */
  weakness?: string
  /** Set when this candidate was rebuilt from a mailer blueprint. */
  blueprint?: { sourceId: string; tone: string; similarity: number; offerType?: string; copyPattern?: string }
}

export interface BoardResult {
  surfaced: ScoredCandidate[]
  retrieved: TastePick[]
  considered: number
  /** How many of the considered candidates were rebuilt from a blueprint. */
  blueprintCount: number
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
  return applyBoard(result, board, brief)
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
  blueprints?: MailerBlueprint[]
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
  const blueprints = input.blueprints ?? await safeBlueprints(records, env)
  const blueprintSlots = Math.ceil(families.length / 2)
  const briefText = [input.brief.offer, input.brief.goal, input.brief.desiredRecipientAction, input.brief.emotionalTone].filter(Boolean).join(" ")
  const offerType = offerTypeFromText(briefText)
  const inferredPattern = copyPatternFromText(briefText)
  const pickedBlueprints = selectBlueprints({
    blueprints,
    vertical: normalizeVerticalTag(selection.vertical),
    tone: normalizeToneTag(input.brief.emotionalTone ?? input.brief.goal),
    offerType,
    copyPattern: inferredPattern && patternFitsOffer(inferredPattern, offerType) ? inferredPattern : undefined,
    favorites: ownerFavoriteIds(env),
    limit: Math.max(1, blueprintSlots),
  })
  const built = await Promise.all(families.map((family, index) => {
    const directionIndex = index % input.directions.length
    const spec = input.directions[directionIndex]?.spec ?? {}
    const blueprint = index < blueprintSlots && pickedBlueprints.length > 0
      ? pickedBlueprints[index % pickedBlueprints.length]
      : undefined
    const stamped = blueprint ? { ...family, id: `bp-${blueprint.id}-${family.id}` } : family
    return scoreFamily({
      family: stamped,
      brief: input.brief,
      selection,
      trim: input.trim,
      base,
      spec,
      directionIndex,
      costs,
      retrieved,
      blueprint,
      env,
    })
  }))
  const revised: ScoredCandidate[] = []
  for (const candidate of built) {
    if (candidate.grade.cleared) {
      revised.push(candidate)
      continue
    }
    const redesigned = await redesignOnce(candidate, input, selection, base, retrieved)
    revised.push(candidate)
    if (redesigned.familyId !== candidate.familyId) revised.push(redesigned)
  }
  const visioned = await maybeVision(revised, retrieved, records, input.brief, env)
  const improved = visioned.map((candidate) =>
    applyVisionImprovement(candidate, input.brief.businessInfo?.name)
  )
  const surfaced = chooseDiverse(improved, input.directions.length).slice(0, SURFACE)
  return {
    surfaced,
    retrieved,
    considered: families.length,
    blueprintCount: built.filter((candidate) => candidate.blueprint).length,
  }
}

async function scoreFamily(input: {
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
  blueprint?: MailerBlueprint
  env?: NodeJS.ProcessEnv
}): Promise<ScoredCandidate> {
  const family = input.family.mode === "type-led"
    ? COMPOSITION_FAMILIES.find((item) => item.id === "integrated-headline") ?? input.family
    : input.family
  const role = roleForDirection(input.directionIndex, input.brief.primaryEmotion)
  let rationale = rationaleForFamily(input.base, family, input)
  let spec = input.spec
  let blueprintMeta: ScoredCandidate["blueprint"]
  if (input.blueprint) {
    const rebuilt = await rebuildFromBlueprint({
      rationale,
      blueprint: input.blueprint,
      spec,
      brief: input.brief,
      env: input.env,
    })
    if (rebuilt) {
      rationale = rebuilt.rationale
      spec = rebuilt.spec
      blueprintMeta = {
        sourceId: input.blueprint.sourceId,
        tone: rebuilt.tone,
        similarity: rebuilt.similarity,
        offerType: rebuilt.spec.blueprint?.offerType,
        copyPattern: rebuilt.spec.blueprint?.copyPattern,
      }
    }
  }
  spec = {
    ...spec,
    headline: applyOutcomeHeadline({
      headline: spec.headline ?? "",
      offer: spec.offer ?? input.brief.offer ?? "",
      brief: input.brief,
      vertical: rationale.vertical,
      role,
    }),
  }
  rationale = {
    ...rationale,
    persuasion: selectPersuasion({
      brief: input.brief,
      vertical: rationale.vertical,
      role,
      blueprint: input.blueprint
        ? {
            tone: input.blueprint.tones[0]?.tag,
            offerType: spec.blueprint?.offerType ?? input.blueprint.offerTypes[0]?.tag,
            copyPattern: spec.blueprint?.copyPattern ?? input.blueprint.copyPatterns[0]?.tag,
          }
        : undefined,
    }),
  }
  const presentation = rolePresentation(role)
  const figure = offerIsFigure(spec.offer ?? input.brief.offer ?? "")
  const offerHero = figure && rationale.vertical !== "medicare_insurance" && role !== "trust"
  rationale = {
    ...rationale,
    grid: { name: presentation.grid, alignment: "left", intentional_break: presentation.mode },
    scale_ratios: {
      ...rationale.scale_ratios,
      hero: offerHero ? "offer" : "headline",
      offer_to_headline_cap: offerHero ? 1.9 : 0.8,
      offer_to_body: offerHero ? 5.2 : 1.8,
    },
    offer_treatment: {
      ...rationale.offer_treatment,
      kind: offerHero
        ? "numeral_hero"
        : rationale.vertical === "medicare_insurance"
          ? "concrete_step_no_discount"
          : "headline_is_the_offer",
      placement: offerHero
        ? "The offer is the largest type. The headline is the result or the risk, and it does not repeat the offer."
        : presentation.placement,
    },
    focal_element: {
      ...rationale.focal_element,
      kind: offerHero ? "offer_numeral" : "headline",
      description: offerHero ? "One figure leads. The headline stays shorter." : presentation.placement,
      lead_modality: offerHero ? "offer_field" : presentation.mode === "full-bleed" ? "image" : "type",
    },
    type_seat: presentation.mode === "full-bleed" && !offerHero
      ? { side: "left", ink: "dark", scrim: true, shadow: false, rect: { x: 0.05, y: 0.08, w: 0.5, h: 0.7 } }
      : rationale.type_seat,
    photo_brief: {
      ...rationale.photo_brief,
      mode: presentation.photoMode,
      subject: presentation.subject,
      crop: presentation.crop,
      placement: presentation.mode === "panel" ? "panel_bleed_two_edges" : "full_bleed",
    },
  }
  spec = {
    ...spec,
    visualDirection: presentation.visualDirection,
    imageryRole: presentation.imageryRole,
    leadJob: presentation.leadJob,
    layoutVariant: "image_grounded",
    imagePresence: "field",
  }
  const facts = clientFactText(input.brief, spec.offer)
  const complianceMark = attorneyAdMark(facts)
  const card = composeGridCard({
    rationale,
    spec,
    businessName: input.brief.businessInfo?.name,
    disclaimer: isMedicareAgentBrief(input.brief) ? MEDICARE_AGENT_DISCLAIMER : null,
    complianceMark,
  })
  const copy = [spec.headline, spec.offer, spec.body, spec.phone, input.brief.businessInfo?.name, complianceMark]
    .filter(Boolean)
    .join(" ")
  const critique = critiqueCard(card, rationale, copy, undefined, clientFactText(input.brief, spec.offer))
  const sampled = gradeComposition({
    card,
    rationale,
    autoFails: critique.autoFails,
    worstContrast: critique.autoFails.includes("AF1") ? 3 : 7,
  })
  return {
    familyId: family.id,
    grid: rationale.grid.name,
    feel: family.feel,
    summary: presentation.summary,
    directionIndex: input.directionIndex,
    rationale,
    card,
    grade: sampled,
    spec,
    costs: input.costs,
    redesigned: Boolean(input.redesigned),
    blueprint: blueprintMeta,
  }
}

async function redesignOnce(
  candidate: ScoredCandidate,
  input: { brief: CampaignBrief; trim: TrimSize },
  selection: ReferenceSelection,
  base: DesignRationale,
  retrieved: TastePick[]
): Promise<ScoredCandidate> {
  const separated = usesSeparatedPanel(candidate.rationale.grid.intentional_break)
  const next = (separated
    ? COMPOSITION_FAMILIES.find((family) => family.mode === "integrated" && family.hero === "offer" && family.id !== candidate.familyId)
    : undefined)
    ?? COMPOSITION_FAMILIES.find((family) => family.mode === "full-bleed" && family.id !== candidate.familyId)
    ?? COMPOSITION_FAMILIES.find((family) => family.id !== candidate.familyId)
    ?? COMPOSITION_FAMILIES[0]!
  const revised = await scoreFamily({
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
  const usedModes = new Set<string>()
  const usedIds = new Set<string>()
  const chosen: ScoredCandidate[] = []
  for (let index = 0; index < directionCount; index += 1) {
    const options = candidates
      .filter((candidate) => candidate.directionIndex === index)
      .filter((candidate) => candidate.rationale.grid.intentional_break !== "type-led")
      .sort((a, b) => Number(b.grade.cleared) - Number(a.grade.cleared) || b.grade.score - a.grade.score)
    const pick = options.find((candidate) => !usedModes.has(candidate.rationale.grid.intentional_break) && !usedIds.has(candidate.familyId))
      ?? options.find((candidate) => !usedIds.has(candidate.familyId))
      ?? options[0]
    if (!pick) continue
    usedModes.add(pick.rationale.grid.intentional_break)
    usedIds.add(pick.familyId)
    chosen[index] = pick
  }
  return chosen.filter((candidate): candidate is ScoredCandidate => Boolean(candidate))
}

function applyBoard(result: GenerateDirectionsResult, board: BoardResult, brief: CampaignBrief): GenerateDirectionsResult {
  const facts = clientFactText(brief)
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
    const lesson = winner.rationale.persuasion?.lesson
    const researchId = winner.blueprint ? `Research id ${winner.blueprint.sourceId}.` : ""
    const role = winner.rationale.persuasion?.role
    return {
      ...direction,
      name: role ? strategyName(role) : scrubUnstatedName(direction.name, facts, statedNameFallback(brief.offer, brief.goal)),
      rationale: scrubUnstatedAudience(direction.rationale, facts) || `Offers ${brief.offer?.trim() || brief.goal?.trim() || "the stated offer"}.`,
      recommended: best ? winner === best : false,
      oneLineDifference: role ? customerWhyLine(role) : winner.summary,
      spec: {
        ...direction.spec,
        ...winner.spec,
        designRationale: winner.rationale,
        palette: [
          winner.rationale.palette.neutral_hex[0] ?? "#F4F1EA",
          winner.rationale.palette.neutral_hex[1] ?? "#1A1A1A",
          winner.rationale.palette.accent_hex,
        ],
        blueprint: winner.blueprint
          ? {
              sourceId: winner.blueprint.sourceId,
              tone: winner.blueprint.tone,
              offerType: winner.blueprint.offerType,
              copyPattern: winner.blueprint.copyPattern,
            }
          : undefined,
      },
      research: {
        sources,
        layoutSummary: [winner.summary, winner.rationale.persuasion?.line, lesson, researchId].filter(Boolean).join(" "),
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
  const medicare = input.selection.vertical === "medicare_insurance"
  const numeral = briefHasNumeralOffer(input.brief) && !medicare
  const hero = medicare || !numeral ? "headline" : family.hero
  const offerHero = hero === "offer"
  const separated = usesSeparatedPanel(family.mode)
  const proposed: DesignRationale = {
    ...base,
    grid: { name: family.grid, alignment: family.alignment, intentional_break: family.mode },
    scale_ratios: {
      hero,
      offer_to_headline_cap: offerHero ? family.offerRatio : 0.5,
      headline_to_body_cap: family.headlineToBody,
      offer_to_body: offerHero ? 5 : 1.6,
      front_type_size_count: 3,
    },
    eye_path: { pattern: family.eye, stops: base.eye_path.stops },
    focal_element: {
      ...base.focal_element,
      kind: offerHero
        ? "offer_numeral"
        : family.mode === "integrated" || family.mode === "type-led"
          ? "headline"
          : base.focal_element.kind === "offer_numeral" ? "photograph_subject" : base.focal_element.kind,
      description: family.placement,
      visual_weight_pct: offerHero ? 46 : 40,
      lead_modality: offerHero ? "offer_field" : family.mode === "full-bleed" ? "image" : separated ? "type" : "image",
      lead_modality_area_pct: family.mode === "full-bleed" ? 74 : family.mode === "panel" ? 64 : 70,
    },
    offer_treatment: {
      ...base.offer_treatment,
      kind: offerHero ? "numeral_hero" : medicare ? "concrete_step_no_discount" : "headline_is_the_offer",
      placement: family.placement,
    },
    photo_brief: {
      ...base.photo_brief,
      placement: family.mode === "integrated" || family.mode === "full-bleed" ? "full_bleed" : "panel_bleed_two_edges",
    },
    principles_invoked: [...base.principles_invoked.slice(0, 4), ...input.retrieved.slice(0, 2).map((pick) => pick.id)].slice(0, 8),
  }
  if (proposed.principles_invoked.length < 3) {
    proposed.principles_invoked = ["P1", "P4", "P7"]
  }
  const checked = validateDesignRationale(proposed)
  if (!checked.ok) {
    throw new Error(`Family ${family.id} rationale failed: ${checked.errors.join(" ")}`)
  }
  return checked.rationale
}

function rolePresentation(role: DirectionRole): {
  mode: CompositionMode
  grid: GridName
  summary: string
  placement: string
  subject: string
  crop: string
  photoMode: DesignRationale["photo_brief"]["mode"]
  visualDirection: string
  imageryRole: ImageryRole
  leadJob: LeadJob
} {
  if (role === "threat") {
    return {
      mode: "full-bleed",
      grid: "full-bleed-plus-panel",
      summary: "The headline sits on the photograph. The offer is a small line.",
      placement: "Headline on a calm area of the photograph. Offer is a small line.",
      subject: "The problem itself, shown honestly and quietly, with no wreckage and no invented damage",
      crop: "Close on the problem, with a calm area left for the headline",
      photoMode: "documentary_job",
      visualDirection: "The problem itself, quiet and honest. No wreckage, no countdown, and no made-up damage.",
      imageryRole: "consequence",
      leadJob: "problem",
    }
  }
  if (role === "trust") {
    return {
      mode: "panel",
      grid: "thirds",
      summary: "A full-height portrait beside the headline.",
      placement: "A full-height portrait. The headline is the proof. The offer is a small line.",
      subject: "One local person from this business, face fully in frame with room above the head, calm daylight",
      crop: "Head and shoulders, the face complete, space above the head",
      photoMode: "advisor_portrait",
      visualDirection: "One local person, face fully in frame, room above the head, calm daylight. Not the same scene as the other cards.",
      imageryRole: "crew",
      leadJob: "trust",
    }
  }
  return {
    mode: "integrated",
    grid: "centered-stack",
    summary: "The headline is the result, on an open canvas.",
    placement: "The result headline sits on the open canvas. The offer is a small line.",
    subject: "The finished result of the job, in daylight, no person in the frame",
    crop: "The finished work, open sky, no person",
    photoMode: "result",
    visualDirection: "The finished result of the job, daylight, no person in the frame. Not a portrait and not the problem.",
    imageryRole: "neighborhood",
    leadJob: "offer",
  }
}

export function strategyName(role: DirectionRole): string {
  if (role === "threat") return "Before it spreads"
  if (role === "trust") return "Local proof"
  return "The outcome"
}

export function customerWhyLine(role: DirectionRole): string {
  if (role === "threat") return "One honest risk, then one easy step. No deadline and no made-up number."
  if (role === "trust") return "A local face and the business name carry the proof."
  return "The headline is the result the homeowner wants. A free, dollar, or percent offer is the largest type."
}

function orderFamilies(feel: string, signals?: TasteSignals): Family[] {
  return COMPOSITION_FAMILIES.map((family, index) => ({ family, index, score: familyRank(family, feel, signals) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.family)
}

function familyRank(family: Family, feel: string, signals?: TasteSignals): number {
  let score = 0
  if (family.mode === "type-led") score -= 12
  if (family.feel === feel) score += 3
  const keys = [family.id, family.mode]
  if (keys.some((key) => signals?.likedFamilies.includes(key))) score += 6
  if (keys.some((key) => signals?.dislikedFamilies.includes(key))) score -= 8
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
  const updates = new Map<string, { grade: CompositionGrade; weakness: string }>()
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
    const weakness = vision.weakness.trim() || vision.redesign.trim()
    const explanation = weakness ? `${vision.explanation} Biggest weakness: ${weakness}` : vision.explanation
    updates.set(candidateKey(candidate), {
      weakness,
      grade: gradeComposition({
        card: candidate.card,
        rationale: candidate.rationale,
        autoFails: critique.autoFails,
        worstContrast: critique.autoFails.includes("AF1") ? 3 : 7,
        vision: { score: vision.score, explanation },
      }),
    })
  })
  if (updates.size === 0) return candidates
  return candidates.map((candidate) => {
    const update = updates.get(candidateKey(candidate))
    return update ? { ...candidate, grade: update.grade, weakness: update.weakness } : candidate
  })
}

/** One layout change from the weakness the critic just named. A lower grade is discarded. */
function applyVisionImprovement(candidate: ScoredCandidate, businessName?: string): ScoredCandidate {
  const weakness = candidate.weakness?.trim()
  if (!weakness) return candidate
  const proposal = improveFromWeakness(candidate.rationale, weakness, { allowSeat: false })
  if (!proposal) return candidate
  const card = composeGridCard({
    rationale: proposal.rationale,
    spec: candidate.spec,
    businessName,
    complianceMark: (proposal.rationale.persuasion?.complianceWarnings.length ?? 0) > 0 ? ATTORNEY_AD_LABEL : null,
  })
  const critique = critiqueCard(card, proposal.rationale, candidate.spec.headline ?? "")
  if (critique.autoFails.includes("AF7") || critique.autoFails.includes("AF6") || critique.autoFails.includes("AF1")) {
    return candidate
  }
  const grade = gradeComposition({
    card,
    rationale: proposal.rationale,
    autoFails: critique.autoFails,
    worstContrast: 7,
  })
  if (grade.score < candidate.grade.score) return candidate
  return {
    ...candidate,
    rationale: proposal.rationale,
    card,
    grade: {
      ...grade,
      explanation: `${grade.explanation} One improvement: ${proposal.explanation}`,
    },
    redesigned: true,
  }
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

async function safeBlueprints(records: LibraryRecord[], env: NodeJS.ProcessEnv): Promise<MailerBlueprint[]> {
  try {
    return await loadBlueprintCorpus({ records, env })
  } catch {
    return []
  }
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
