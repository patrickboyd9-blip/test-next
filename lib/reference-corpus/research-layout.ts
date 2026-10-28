import type { CampaignBrief, CreativeDirection, CreativeSpec } from "@/lib/campaign-creator/types"
import {
  LAYOUT_VARIANTS,
  normalizeLayoutVariant,
  type LayoutHints,
  type LayoutVariant,
  type PhotoToTypeBalance,
  type ResearchLayoutParameters,
  type ResearchSource,
} from "@/lib/campaign-creator/types"

import { assignTemplateToSpec, assignTemplates } from "@/lib/postcard-layouts/assign"
import type { PostcardTemplateId } from "@/lib/postcard-layouts/ids"

import type { ReferenceCard } from "./reference-card"
import {
  referenceVerticalsForBrief,
  selectReferenceCards,
} from "./select-reference-cards"
import { RESEARCH_TASTE_PACK } from "./taste-pack"

/**
 * Layout policy read from Reference Card composition notes.
 * A matched vertical restricts layouts. A brief with no cards stays open.
 */

const NEIGHBORS: Record<LayoutVariant, readonly LayoutVariant[]> = {
  peer_split: ["image_grounded", "type_primary_split"],
  image_grounded: ["peer_split", "type_primary_split"],
  type_primary_split: ["peer_split", "image_grounded"],
  banded_split: ["type_primary_split", "peer_split"],
  type_only: ["type_primary_split", "peer_split"],
}

const DISPLAY_ORDER: readonly LayoutVariant[] = [
  "peer_split",
  "image_grounded",
  "type_primary_split",
  "banded_split",
  "type_only",
]

const LAYOUT_COPY: Record<LayoutVariant, string> = {
  peer_split: "The photograph and the words share the card.",
  image_grounded: "The photograph fills the card, and the words sit in a quiet area.",
  type_primary_split: "The words lead, and the photograph sits beside them.",
  banded_split: "A band carries the message, with the photograph in support.",
  type_only: "The words carry the card.",
}

export interface CardLayoutReading {
  mmrId: string
  allowed: LayoutVariant[]
  preferred: LayoutVariant
  balance: PhotoToTypeBalance
  offerLeads: boolean
  colorField: boolean
}

export interface VerticalLayoutPolicy {
  /** research: notes restrict layouts. open: no vertical cards, keep today's freedom. */
  mode: "research" | "open"
  allowed: LayoutVariant[]
  preferred: LayoutVariant
  balance: PhotoToTypeBalance
  parameters: ResearchLayoutParameters
  offerLeads: boolean
  colorField: boolean
  /** Sentence for the model, tied to the notes. Empty when mode is open. */
  promptWhy: string
  sources: ResearchSource[]
}

type ScoreMap = Record<LayoutVariant, number>

export function referenceCardTitle(card: Pick<ReferenceCard, "whyItWorks">): string {
  const sentence = firstSentence(card.whyItWorks)
  const clause = sentence.split(",")[0]?.trim() || sentence
  if (clause.split(/\s+/).length >= 3 && clause.length <= 72) {
    return clause.replace(/[.!?]$/, "")
  }
  return trimLength(sentence, 72)
}

export function referenceCardWhy(card: Pick<ReferenceCard, "whyItWorks">): string {
  return trimLength(firstSentence(card.whyItWorks), 140)
}

export function readCardLayout(card: ReferenceCard): CardLayoutReading {
  const composition = card.compositionNotes
  const imagery = card.imageryNotes
  const scores = blankScores()

  const photo = /\b(photograph|photos?|imagery|images?|headshot|person|worker|food|before-and-after|threat)\b/i.test(
    composition
  )
  const headline = /\b(headline|large type|large offer|large light)\b/i.test(composition)
  const bothCarry = /carry the face/i.test(composition)
  const personAndOffer = /person and the offer/i.test(composition)
  const offerLeads = /lead offer|carries the lead|promotional offer|offer type/i.test(composition)
  const colorField = /bright field|strong color|color field/i.test(composition)
  const band = /\b(band|banner)\b/i.test(composition)
  const photoGround =
    /as the ground|food imagery|food photography|before-and-after|consequence photograph|work photos|threat image|relief imagery/i.test(
      composition
    )
  const personLed =
    /agent-led|the person|headshot|worker image|photos of the location|product photo/i.test(composition)
  const imageryPhoto =
    /\b(photograph|photos?|headshot|worker|couple|food|before-and-after)\b/i.test(imagery)
  const explicitNoPhoto =
    /say there is no photograph|do not fill the card with generic|do not fill the extra space with stock/i.test(
      `${composition}\n${imagery}`
    )

  if (bothCarry) {
    scores.peer_split += 4
    scores.image_grounded += 2
    scores.type_primary_split += 2
  }
  if (personAndOffer) {
    scores.peer_split += 4
    scores.image_grounded += 2
  }
  if (photoGround) {
    scores.image_grounded += 4
    scores.peer_split += 2
  }
  if (offerLeads) {
    scores.type_primary_split += 3
    scores.banded_split += 2
  }
  if (headline && !bothCarry) scores.type_primary_split += 2
  if (colorField) {
    scores.type_primary_split += 3
    scores.type_only += 1
  }
  if (band) scores.banded_split += 4
  if (personLed && photo) {
    scores.peer_split += 2
    scores.image_grounded += 1
  }
  if (explicitNoPhoto && !photo && !personLed) scores.type_only += 3
  if (imageryPhoto && scores.image_grounded === 0 && scores.peer_split === 0) {
    scores.peer_split += 1
  }
  if (imageryPhoto || photo || personLed) scores.type_only = Math.min(scores.type_only, 0)

  if (Object.values(scores).every((score) => score <= 0)) {
    scores.type_primary_split = 2
    scores.peer_split = 1
  }

  const preferred = preferredLayout(scores, composition)
  const allowed = allowedLayouts(scores, preferred)
  const balance: PhotoToTypeBalance =
    preferred === "image_grounded"
      ? "photo_led"
      : preferred === "peer_split" || bothCarry || personAndOffer
        ? "balanced"
        : "type_led"

  return {
    mmrId: card.mmrId,
    allowed,
    preferred,
    balance,
    offerLeads,
    colorField,
  }
}

export function layoutPolicyForBrief(
  brief: CampaignBrief,
  pack: readonly ReferenceCard[] = RESEARCH_TASTE_PACK
): VerticalLayoutPolicy {
  const verticals = referenceVerticalsForBrief(brief)
  const own = pack.filter((card) => verticals.includes(card.vertical))
  const nonCraft = own.filter(
    (card) => card.packGroup !== "craft_exemplar" && card.guidesLayout !== false
  )
  const cards = nonCraft.length > 0 ? nonCraft : own

  if (verticals.length === 0 || cards.length === 0) {
    return openPolicy(brief, pack)
  }

  const readings = cards.map(readCardLayout)
  const allowed = new Set<LayoutVariant>()
  const votes = new Map<LayoutVariant, number>()
  const balanceVotes = new Map<PhotoToTypeBalance, number>()
  for (const reading of readings) {
    votes.set(reading.preferred, (votes.get(reading.preferred) ?? 0) + 1)
    balanceVotes.set(reading.balance, (balanceVotes.get(reading.balance) ?? 0) + 1)
    for (const layout of reading.allowed) allowed.add(layout)
  }

  const preferred = winningLayout(votes)
  allowed.add(preferred)
  while (allowed.size < 2) {
    const next = NEIGHBORS[preferred].find((layout) => !allowed.has(layout))
    if (!next) break
    allowed.add(next)
  }

  const offerLeads = readings.some((reading) => reading.offerLeads)
  const colorField = readings.some((reading) => reading.colorField)
  const balance = winningBalance(balanceVotes)
  const ordered = orderAllowed(preferred, allowed)
  const parameters = parametersForLayout(preferred, { offerLeads, colorField })
  const anchor =
    cards.find((card) => readCardLayout(card).preferred === preferred) ?? cards[0]

  return {
    mode: "research",
    allowed: ordered,
    preferred,
    balance,
    parameters,
    offerLeads,
    colorField,
    promptWhy: anchor
      ? `The notes say: ${firstSentence(anchor.compositionNotes)} That supports ${LAYOUT_COPY[preferred].charAt(0).toLowerCase()}${LAYOUT_COPY[preferred].slice(1)}`
      : LAYOUT_COPY[preferred],
    sources: sourcesFrom(cards),
  }
}

export function parametersForLayout(
  layout: LayoutVariant,
  flags: { offerLeads: boolean; colorField: boolean }
): ResearchLayoutParameters {
  switch (layout) {
    case "image_grounded":
      return {
        headlineScale: 1,
        headlinePosition: "over_quiet_area",
        photoShare: 0.72,
        photoCrop: "space_for_type",
        offerBadge: "inline",
        colorBlock: "none",
      }
    case "peer_split":
      return {
        headlineScale: 1.04,
        headlinePosition: "beside_photo",
        photoShare: 0.56,
        photoCrop: "open",
        offerBadge: "inline",
        colorBlock: "none",
      }
    case "banded_split":
      return {
        headlineScale: 1.08,
        headlinePosition: "in_band",
        photoShare: 0.48,
        photoCrop: "tight",
        offerBadge: "band",
        colorBlock: "band",
      }
    case "type_only":
      return {
        headlineScale: 1.12,
        headlinePosition: "on_color_field",
        photoShare: 0,
        photoCrop: "tight",
        offerBadge: flags.offerLeads ? "band" : "inline",
        colorBlock: "field",
      }
    default:
      return {
        headlineScale: 1.1,
        headlinePosition: flags.colorField ? "on_color_field" : "beside_photo",
        photoShare: 0.4,
        photoCrop: "tight",
        offerBadge: flags.offerLeads ? "band" : "inline",
        colorBlock: flags.colorField ? "field" : "none",
      }
  }
}

export function formatResearchLayoutGuidance(policy: VerticalLayoutPolicy): string {
  if (policy.mode !== "research") return ""
  const parameters = policy.parameters
  const share = Math.round(parameters.photoShare * 100)
  return `Layouts the matched research supports — choose only these layoutVariant values: ${policy.allowed.join(", ")}.
Preferred layout: ${policy.preferred}. ${policy.promptWhy}
Photo-to-type balance: ${policy.balance.replace(/_/g, " ")}.
Concrete layout from those composition notes. Execute it. Do not copy a brand, slogan, logo, or piece of artwork.
- Headline: ${parameters.headlinePosition.replace(/_/g, " ")}, relative scale ${parameters.headlineScale}.
- Photograph: about ${share}% of the front, crop ${parameters.photoCrop.replace(/_/g, " ")}.
- Offer: ${parameters.offerBadge}. One offer. Not a row of badges.
- Color blocking: ${parameters.colorBlock}.
Spend the supported layouts across the three directions so the directions still differ. Do not use a layout that is not in the list. When this list is present it overrides the general preference for image_grounded or type_only.
These cards choose the layout family. They do not choose the physical mail piece, the canvas, bleed, safe area, or a vendor option.`
}

export function layoutSummaryFor(layout: LayoutVariant, mode: "research" | "open"): string {
  if (mode === "open") {
    return "We don't have mailers for this kind of business yet, so this layout follows your campaign. The notes below are from strong postcards in general."
  }
  return `${LAYOUT_COPY[layout]} It matches the mailers we studied for this kind of business.`
}

/**
 * Keep an allowed layout. A disallowed layout becomes the preferred one,
 * then the set is spread across the allowed layouts so the directions differ.
 */
export function applyResearchLayouts(
  brief: CampaignBrief,
  directions: CreativeDirection[]
): CreativeDirection[] {
  const policy = layoutPolicyForBrief(brief)
  if (policy.mode === "open") {
    return citeByTemplate(
      brief,
      assignTemplates(
        brief,
        directions.map((direction) => ({
          ...direction,
          research: {
            sources: policy.sources,
            layoutSummary: layoutSummaryFor(
              normalizeLayoutVariant(direction.spec.layoutVariant) ?? "peer_split",
              "open"
            ),
            parameters: parametersForLayout(
              normalizeLayoutVariant(direction.spec.layoutVariant) ?? "peer_split",
              policy
            ),
          },
        }))
      )
    )
  }

  const ranked = directions
    .map((direction, index) => ({ direction, index }))
    .sort((a, b) => Number(b.direction.recommended) - Number(a.direction.recommended))
  const used = new Set<LayoutVariant>()
  const assigned = new Map<number, { layout: LayoutVariant; adjusted: boolean }>()

  for (const item of ranked) {
    const current = normalizeLayoutVariant(item.direction.spec.layoutVariant)
    const choice = chooseLayout(current, policy, used)
    used.add(choice.layout)
    assigned.set(item.index, choice)
  }

  return citeByTemplate(
    brief,
    assignTemplates(
      brief,
      directions.map((direction, index) => {
        const choice = assigned.get(index) ?? { layout: policy.preferred, adjusted: true }
        const spec = specWithLayout(direction.spec, choice.layout, policy, choice.adjusted)
        return {
          ...direction,
          spec,
          research: {
            sources: policy.sources,
            layoutSummary: layoutSummaryFor(choice.layout, "research"),
            parameters: parametersForLayout(choice.layout, policy),
          },
        }
      })
    )
  )
}

const TEMPLATE_PATTERN: Partial<Record<PostcardTemplateId, string>> = {
  storm_alert: "storm",
  financing_first: "financing",
  before_after: "before_after",
  local_pride: "local",
  commercial_restore: "commercial",
  offer_starburst: "offer",
  hero_scrim: "offer",
  service_band: "offer",
  deadline_coupon: "offer",
  roof_full_bleed: "offer",
  roof_split: "local",
  roof_coupon: "financing",
  roof_before_after: "before_after",
  roof_trust: "local",
  roof_storm: "storm",
  roof_neighborhood: "local",
  roof_seasonal: "offer",
  roof_minimal: "commercial",
  roof_premium: "commercial",
}

/**
 * When the vertical has pattern notes, each direction cites the unused
 * record that matches its composition. One shared record is kept only when
 * the vertical has a single card.
 */
function citeByTemplate(brief: CampaignBrief, directions: CreativeDirection[]): CreativeDirection[] {
  const verticals = referenceVerticalsForBrief(brief)
  const cards = RESEARCH_TASTE_PACK.filter(
    (card) =>
      verticals.includes(card.vertical) &&
      card.packGroup !== "craft_exemplar" &&
      (card.patterns?.length ?? 0) > 0
  )
  if (cards.length === 0) return directions
  const used = new Set<string>()
  return directions.map((direction) => {
    const template = direction.spec.layoutHints?.templateId
    const pattern = template ? TEMPLATE_PATTERN[template] : undefined
    const unused = cards.filter((card) => !used.has(card.mmrId))
    const matched = pattern ? unused.filter((card) => card.patterns?.includes(pattern)) : []
    const chosen = matched[0] ?? unused[0]
    if (!chosen || !direction.research) return direction
    used.add(chosen.mmrId)
    return {
      ...direction,
      research: {
        ...direction.research,
        sources: [
          {
            mmrId: chosen.mmrId,
            title: referenceCardTitle(chosen),
            whyItWorks: referenceCardWhy(chosen),
          },
        ],
      },
    }
  })
}

/** One spec, used when a refinement picks a layout the research does not support. */
export function applyResearchLayoutToSpec(brief: CampaignBrief, spec: CreativeSpec): CreativeSpec {
  const policy = layoutPolicyForBrief(brief)
  if (policy.mode !== "research") return spec
  const current = normalizeLayoutVariant(spec.layoutVariant)
  if (current && policy.allowed.includes(current)) {
    return assignTemplateToSpec(brief, specWithLayout(spec, current, policy, false))
  }
  return assignTemplateToSpec(brief, specWithLayout(spec, policy.preferred, policy, true))
}

export function hintsForParameters(parameters: ResearchLayoutParameters): LayoutHints {
  return {
    headlineScale: parameters.headlineScale,
    headlinePosition: parameters.headlinePosition,
    photoCrop: parameters.photoCrop,
    offerBadge: parameters.offerBadge,
    colorBlock: parameters.colorBlock,
  }
}

function specWithLayout(
  spec: CreativeSpec,
  layout: LayoutVariant,
  policy: VerticalLayoutPolicy,
  adjusted: boolean
): CreativeSpec {
  const next: CreativeSpec = {
    ...spec,
    layoutVariant: layout,
    layoutHints: {
      ...spec.layoutHints,
      ...hintsForParameters(parametersForLayout(layout, policy)),
      qrProminence: spec.layoutHints?.qrProminence,
      phonePosition: spec.layoutHints?.phonePosition,
    },
  }
  if (!adjusted) return next
  return reconcileSpec(next, layout)
}

function reconcileSpec(spec: CreativeSpec, layout: LayoutVariant): CreativeSpec {
  const next: CreativeSpec = { ...spec, layoutHints: { ...spec.layoutHints } }
  if (layout === "type_only") {
    delete next.imagePresence
    return next
  }
  if (next.imageryRole === "none" || next.imageryRole === "logo" || !next.imageryRole) {
    next.imageryRole = layout === "image_grounded" ? "consequence" : "neighborhood"
  }
  if (!next.imagery || next.imagery === "none" || next.imagery === "logo_primary") {
    next.imagery = "stock_generic_local"
  }
  if (
    next.imagePresence === "accent" &&
    (layout === "peer_split" || layout === "image_grounded")
  ) {
    delete next.imagePresence
  }
  if (layout === "image_grounded" && next.typeRole === "subject") {
    delete next.typeRole
  }
  return next
}

function chooseLayout(
  current: LayoutVariant | undefined,
  policy: VerticalLayoutPolicy,
  used: Set<LayoutVariant>
): { layout: LayoutVariant; adjusted: boolean } {
  if (current && policy.allowed.includes(current) && !used.has(current)) {
    return { layout: current, adjusted: false }
  }
  if (current && policy.allowed.includes(current) && used.has(current)) {
    const next = policy.allowed.find((layout) => !used.has(layout))
    if (next) return { layout: next, adjusted: true }
    return { layout: current, adjusted: false }
  }
  if (!used.has(policy.preferred)) return { layout: policy.preferred, adjusted: true }
  const next = policy.allowed.find((layout) => !used.has(layout))
  return { layout: next ?? policy.preferred, adjusted: true }
}

function openPolicy(brief: CampaignBrief, pack: readonly ReferenceCard[]): VerticalLayoutPolicy {
  const selection = selectReferenceCards(brief, pack)
  return {
    mode: "open",
    allowed: [...LAYOUT_VARIANTS],
    preferred: "peer_split",
    balance: "balanced",
    parameters: parametersForLayout("peer_split", { offerLeads: false, colorField: false }),
    offerLeads: false,
    colorField: false,
    promptWhy: "",
    sources: sourcesFrom(selection.cards),
  }
}

function sourcesFrom(cards: readonly ReferenceCard[]): ResearchSource[] {
  return cards.slice(0, 4).map((card) => ({
    mmrId: card.mmrId,
    title: referenceCardTitle(card),
    whyItWorks: referenceCardWhy(card),
  }))
}

function preferredLayout(scores: ScoreMap, composition: string): LayoutVariant {
  if (/carry the face/i.test(composition) && scores.peer_split >= scores.image_grounded && scores.peer_split > 0) {
    return "peer_split"
  }
  return [...LAYOUT_VARIANTS].sort((a, b) => {
    const delta = scores[b] - scores[a]
    if (delta !== 0) return delta
    return DISPLAY_ORDER.indexOf(a) - DISPLAY_ORDER.indexOf(b)
  })[0]
}

function allowedLayouts(scores: ScoreMap, preferred: LayoutVariant): LayoutVariant[] {
  const allowed = new Set<LayoutVariant>(
    LAYOUT_VARIANTS.filter((layout) => scores[layout] > 0)
  )
  allowed.add(preferred)
  for (const layout of NEIGHBORS[preferred]) {
    if (allowed.size >= 2) break
    allowed.add(layout)
  }
  return orderAllowed(preferred, allowed)
}

function orderAllowed(preferred: LayoutVariant, allowed: Set<LayoutVariant>): LayoutVariant[] {
  return [preferred, ...DISPLAY_ORDER.filter((layout) => allowed.has(layout) && layout !== preferred)]
}

function winningLayout(votes: Map<LayoutVariant, number>): LayoutVariant {
  return [...votes.entries()].sort((a, b) => {
    const delta = b[1] - a[1]
    if (delta !== 0) return delta
    return DISPLAY_ORDER.indexOf(a[0]) - DISPLAY_ORDER.indexOf(b[0])
  })[0][0]
}

function winningBalance(votes: Map<PhotoToTypeBalance, number>): PhotoToTypeBalance {
  const order: PhotoToTypeBalance[] = ["balanced", "photo_led", "type_led"]
  return [...votes.entries()].sort((a, b) => {
    const delta = b[1] - a[1]
    if (delta !== 0) return delta
    return order.indexOf(a[0]) - order.indexOf(b[0])
  })[0][0]
}

function blankScores(): ScoreMap {
  return {
    type_primary_split: 0,
    peer_split: 0,
    banded_split: 0,
    image_grounded: 0,
    type_only: 0,
  }
}

function firstSentence(value: string): string {
  const sentence = value.split(/(?<=[.!?])\s+/)[0]?.trim() || value.trim()
  return sentence.replace(/[.!?]$/, "")
}

function trimLength(value: string, max: number): string {
  const clean = value.replace(/[.!?]$/, "").trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).replace(/\s+\S*$/, "")}…`
}
