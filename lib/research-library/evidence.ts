import type { CampaignBrief, CreativeDirection, DirectionResearch, ResearchLayoutParameters } from "@/lib/campaign-creator/types"
import type { PostcardTemplateId } from "@/lib/postcard-layouts/ids"
import { verticalPaletteForBrief } from "@/lib/postcard-layouts/assign"
import { templatesForPalette } from "@/lib/postcard-layouts/templates"

import type { GoldExpectation, LayoutTune, ResearchEntry, RetrievalHit } from "./types"

const COMPLIANCE = `Research evidence for this campaign. Use it to choose the structure, the offer pattern, the photograph description, and the layout. Do not print a response rate, a statistic, a count, or a deadline on the card unless that exact fact is already in the customer brief. Do not copy another company's name, slogan, phone number, or artwork.`

export function formatCopyEvidence(hits: readonly RetrievalHit[]): string {
  if (hits.length === 0) return ""
  const lines = hits.slice(0, 6).map((hit) => evidenceLine(hit))
  return `${COMPLIANCE}\n\n${lines.join("\n")}`
}

export function formatArtDirectorEvidence(hits: readonly RetrievalHit[]): string {
  const tune = layoutTuneFromHits(hits)
  if (!tune) return formatCopyEvidence(hits)
  const lines = [
    formatCopyEvidence(hits),
    `Layout recipe from ${tune.sourceId}: photograph about ${tune.photoShare !== undefined ? `${Math.round(tune.photoShare * 100)}%` : "a large share"} of the card. Offer ${tune.offerProminent ? "is the prominent line" : "stays quieter than the headline"}.`,
  ]
  if (tune.colors.length > 0) lines.push(`Colors seen on that mailer: ${tune.colors.slice(0, 3).join(", ")}. Use the roles, not a copied brand palette, unless the customer supplied colors.`)
  if (tune.photoStyle) lines.push(`Photograph description to borrow as words only: ${tune.photoStyle}`)
  return lines.filter(Boolean).join("\n")
}

export function formatStrategyEvidence(hits: readonly RetrievalHit[]): string {
  if (hits.length === 0) return ""
  return `\nLibrary evidence (internal — do not quote response numbers back to the customer):\n${formatCopyEvidence(hits)}\n`
}

export function layoutTuneFromHits(hits: readonly RetrievalHit[]): LayoutTune | null {
  const source = hits.find((hit) => hit.entry.gold) ?? hits.find((hit) => hit.entry.evidence === "visual") ?? hits[0]
  if (!source) return null
  const layout = source.entry.layout
  return {
    photoShare: layout.photoShare,
    offerProminent: offerIsProminent(source.entry),
    colors: hexColors(source.entry.colors),
    templateBias: templateBias(source.entry),
    headlineWords: layout.headlineWords,
    photoStyle: source.entry.photoStyle,
    sourceId: source.entry.id,
  }
}

export function goldExpectationFromHits(hits: readonly RetrievalHit[]): GoldExpectation | null {
  const gold = hits.find((hit) => hit.entry.gold) ?? hits.find((hit) => hit.entry.layout.photoShare !== undefined)
  if (!gold) return null
  return {
    id: gold.entry.id,
    photoShare: gold.entry.layout.photoShare,
    offerProminent: offerIsProminent(gold.entry),
    colors: hexColors(gold.entry.colors),
  }
}

export function goldComparisonNotes(input: {
  photoAreaPct?: number
  offerFont?: number
  headlineFont?: number
  palette?: string[]
  gold: GoldExpectation | null
}): string[] {
  const gold = input.gold
  if (!gold) return []
  const notes: string[] = []
  if (gold.photoShare !== undefined && input.photoAreaPct !== undefined) {
    const target = Math.round(gold.photoShare * 100)
    const actual = Math.round(input.photoAreaPct)
    if (Math.abs(target - actual) >= 15) {
      notes.push(`Gold ${gold.id} keeps the photograph near ${target}% of the card. This card is at ${actual}%.`)
    }
  }
  if (gold.offerProminent && input.offerFont !== undefined && input.headlineFont !== undefined && input.offerFont < input.headlineFont) {
    notes.push(`Gold ${gold.id} makes the offer the prominent line. This card's offer is smaller than the headline.`)
  }
  if (gold.colors.length > 0 && input.palette && input.palette.length > 0) {
    const close = gold.colors.some((color) => input.palette!.some((ink) => colorDistance(color, ink) < 80))
    if (!close) notes.push(`Gold ${gold.id} uses ${gold.colors.slice(0, 3).join(", ")}. This card's inks are far from that recipe.`)
  }
  return notes
}

export function photoNoteFromHits(hits: readonly RetrievalHit[]): string | undefined {
  const styles = hits.map((hit) => hit.entry.photoStyle).filter((style): style is string => Boolean(style?.trim()))
  if (styles.length === 0) return undefined
  return clip(styles.slice(0, 2).join(" "), 240)
}

export function stampLibraryResearch<T extends { directions: CreativeDirection[] }>(
  result: T,
  hits: readonly RetrievalHit[],
  brief?: CampaignBrief
): T {
  if (hits.length === 0 || result.directions.length === 0) return result
  const tune = layoutTuneFromHits(hits)
  const gold = goldExpectationFromHits(hits)
  const photo = photoNoteFromHits(hits)
  const sources = hits.slice(0, 6).map((hit) => ({
    mmrId: hit.entry.id,
    title: sourceTitle(hit.entry),
    whyItWorks: sourceWhy(hit.entry),
  }))
  const influencedBy = hits.map((hit) => hit.entry.id)
  const directions = result.directions.map((direction) => {
    const research = direction.research
    const parameters = parametersFrom(tune, research?.parameters)
    const next: CreativeDirection = {
      ...direction,
      research: {
        sources,
        layoutSummary: research?.layoutSummary || layoutSentence(tune),
        parameters,
        quality: research?.quality
          ? {
              ...research.quality,
              notes: uniqueNotes(research.quality.notes, [
                ...goldComparisonNotes({
                  photoAreaPct: (research.parameters.photoShare ?? parameters.photoShare) * 100,
                  offerFont: research.parameters.offerBadge === "band" ? 2 : 1,
                  headlineFont: research.parameters.offerBadge === "band" ? 1 : 2,
                  gold,
                }),
                gold ? `Compared with ${gold.id} before the layout was tuned.` : "",
              ].filter((note) => note.length > 0)),
            }
          : research?.quality,
        influencedBy,
        photoDirection: photo,
      },
    }
    return next
  })
  const tuned = tuneLead(directions, tune, brief)
  return { ...result, directions: tuned }
}

function tuneLead(directions: CreativeDirection[], tune: LayoutTune | null, brief?: CampaignBrief): CreativeDirection[] {
  if (!tune?.templateBias || !brief) return directions
  const leadIndex = Math.max(0, directions.findIndex((direction) => direction.recommended))
  const lead = directions[leadIndex]
  if (!lead) return directions
  const bias = tune.templateBias as PostcardTemplateId
  const allowed = templatesForPalette(verticalPaletteForBrief(brief))
  if (!allowed.includes(bias)) return directions
  const taken = new Set(directions.filter((_, index) => index !== leadIndex).map((direction) => direction.spec.layoutHints?.templateId))
  if (taken.has(bias)) return directions
  return directions.map((direction, index) => {
    if (index !== leadIndex) return direction
    const palette = hexColors(tune.colors)
    const nextPalette = palette.length >= 3 ? palette.slice(0, 3) : direction.spec.palette
    return {
      ...direction,
      spec: {
        ...direction.spec,
        palette: nextPalette && nextPalette.length === 3 ? nextPalette : direction.spec.palette,
        layoutHints: {
          ...direction.spec.layoutHints,
          templateId: bias,
        },
      },
    }
  })
}

function parametersFrom(tune: LayoutTune | null, current: ResearchLayoutParameters | undefined): ResearchLayoutParameters {
  const photoShare = tune?.photoShare ?? current?.photoShare ?? 0.55
  const prominent = tune?.offerProminent ?? false
  return {
    headlineScale: tune?.headlineWords !== undefined && tune.headlineWords <= 4 ? 1.8 : current?.headlineScale ?? 1.4,
    headlinePosition: prominent ? "in_band" : current?.headlinePosition ?? "beside_photo",
    photoShare,
    photoCrop: photoShare >= 0.6 ? "open" : current?.photoCrop ?? "space_for_type",
    offerBadge: prominent ? "band" : current?.offerBadge ?? "inline",
    colorBlock: prominent ? "band" : current?.colorBlock ?? "field",
  }
}

function layoutSentence(tune: LayoutTune | null): string {
  if (!tune) return "One photograph and one offer, with the phone and the scan mark together."
  const photo = tune.photoShare !== undefined ? `The photograph covers about ${Math.round(tune.photoShare * 100)}% of the card.` : "The photograph leads."
  const offer = tune.offerProminent ? "The offer is the prominent line." : "The headline leads and the offer stays secondary."
  return `${photo} ${offer}`
}

function evidenceLine(hit: RetrievalHit): string {
  const entry = hit.entry
  const bits = [
    `${entry.id} (${entry.industry}, ${entry.gold ? "gold recipe" : entry.evidence === "visual" ? "image-backed" : "text-only"}, ${hit.band})`,
  ]
  if (entry.headlines[0]) bits.push(`headline pattern: “${clip(entry.headlines[0], 80)}”`)
  if (entry.offers[0]) bits.push(`offer pattern: ${clip(entry.offers[0], 80)}`)
  if (entry.layout.photoShare !== undefined) bits.push(`photo about ${Math.round(entry.layout.photoShare * 100)}%`)
  if (entry.layout.offerPosition) bits.push(`offer ${entry.layout.offerPosition}`)
  if (entry.layout.headlineWords) bits.push(`headline about ${entry.layout.headlineWords} words`)
  if (entry.photoStyle) bits.push(`photo: ${clip(entry.photoStyle, 140)}`)
  if (entry.whyItWorks) bits.push(`why it works: ${clip(entry.whyItWorks, 160)}`)
  if (entry.favoriteOf && entry.favoriteSimilarity) bits.push(`similarity ${entry.favoriteSimilarity}/5 to ${entry.favoriteOf}`)
  if (entry.responseEvidence) bits.push(`internal response note, do not print: ${clip(entry.responseEvidence, 160)}`)
  return `- ${bits.join("; ")}`
}

function offerIsProminent(entry: ResearchEntry): boolean {
  const size = `${entry.layout.offerSize ?? ""} ${entry.structures.join(" ")}`.toLowerCase()
  const position = (entry.layout.offerPosition ?? "").toLowerCase()
  return /dominant|large|hero|primary|biggest|largest/.test(size) || /band|strip|banner/.test(position)
}

function templateBias(entry: ResearchEntry): string | undefined {
  const share = entry.layout.photoShare ?? 0
  const prominent = offerIsProminent(entry)
  if (entry.industry === "roofing" || entry.industry === "hvac" || entry.industry === "plumbing") {
    if (prominent && share >= 0.45) return entry.industry === "roofing" ? "roof_coupon" : "service_band"
    if (share >= 0.6) return entry.industry === "roofing" ? "roof_full_bleed" : "hero_scrim"
  }
  if (entry.industry === "auto_insurance" || entry.industry === "medicare" || entry.industry === "insurance") return "medicare_calm"
  if (share >= 0.6) return "hero_scrim"
  if (prominent) return "service_band"
  return undefined
}

function sourceTitle(entry: ResearchEntry): string {
  const kind = entry.gold ? "Gold recipe" : entry.evidence === "visual" ? "Image-backed mailer" : "Written mailer"
  return clip(`${kind}, ${entry.industry.replace(/_/g, " ")}`, 72)
}

function sourceWhy(entry: ResearchEntry): string {
  const parts = [entry.whyItWorks, entry.structures[0], entry.photoStyle ? `Photograph: ${entry.photoStyle}` : ""].filter(Boolean)
  return clip(parts.join(" ") || "One subject and one response.", 180)
}

function hexColors(colors: readonly string[]): string[] {
  return colors.filter((color) => /^#[0-9A-Fa-f]{6}$/.test(color))
}

function colorDistance(left: string, right: string): number {
  const a = rgb(left)
  const b = rgb(right)
  if (!a || !b) return 999
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
}

function rgb(hex: string): [number, number, number] | null {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(hex.trim())
  if (!match) return null
  const value = match[1]!
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)]
}

function uniqueNotes(current: string[], extra: string[]): string[] {
  const seen = new Set(current)
  const next = [...current]
  for (const note of extra) {
    if (seen.has(note)) continue
    seen.add(note)
    next.push(note)
  }
  return next
}

function clip(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim()
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trim()}…`
}

export function researchParameters(tune: LayoutTune | null): ResearchLayoutParameters | undefined {
  if (!tune) return undefined
  return parametersFrom(tune, undefined)
}

export type { DirectionResearch }
