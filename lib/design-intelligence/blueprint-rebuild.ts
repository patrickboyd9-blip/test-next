import type { CampaignBrief, CreativeSpec } from "@/lib/campaign-creator/types"

import type { CompositionMode } from "./art-director"
import {
  topTone,
  type BlueprintDevice,
  type MailerBlueprint,
  type TypeClass,
} from "./blueprint"
import { freshCopy } from "./blueprint-tags"
import { guardRebuild } from "./blueprint-guard"
import { validateDesignRationale, type DesignRationale, type GridName } from "./rationale"

/**
 * Rebuilds a blueprint with the campaign's words, photographs, and colors.
 * The font class is an OFL face already in the painter: Barlow Condensed,
 * Archivo, or Fraunces. Source art and source wording stay off the card.
 */

const FONT_CLASS: Record<TypeClass, { pairing: "trade" | "signal" | "letter"; display: string }> = {
  "condensed-display": { pairing: "signal", display: "Barlow Condensed, an OFL condensed display face" },
  "humanist-sans": { pairing: "trade", display: "Archivo, an OFL humanist grotesque" },
  serif: { pairing: "letter", display: "Fraunces, an OFL serif" },
}

export interface RebuiltBlueprint {
  rationale: DesignRationale
  spec: CreativeSpec
  mode: CompositionMode
  tone: string
  similarity: number
  perturbed: boolean
}

export function rebuildFromBlueprint(input: {
  rationale: DesignRationale
  blueprint: MailerBlueprint
  spec: CreativeSpec
  brief: CampaignBrief
}): RebuiltBlueprint | null {
  const medicare = input.rationale.vertical === "medicare_insurance"
  const mode = medicare ? "calm-column" : modeFor(input.blueprint.devices)
  const grid = gridFor(mode)
  const hero = medicare || input.blueprint.scale.offerToHeadline < 1.6 ? "headline" : "offer"
  const mapped = mapClientColors(clientColors(input.spec, input.rationale), input.blueprint.paletteRoles)
  const offerType = input.blueprint.offerTypes[0]?.tag
  const copyPattern = input.blueprint.copyPatterns[0]?.tag
  const written = freshCopy({
    template: input.blueprint.copyTemplate,
    offerType,
    goal: input.brief.goal,
    offer: input.spec.offer || input.brief.offer,
    businessName: input.brief.businessInfo?.name,
  })
  const guarded = guardRebuild({
    sourceId: input.blueprint.sourceId,
    boxes: input.blueprint.boxes,
    devices: input.blueprint.devices,
    guard: input.blueprint.guard,
    neutrals: mapped.neutrals,
    accent: mapped.accent,
    spec: {
      ...input.spec,
      headline: written.headline,
      subheadline: written.subheadline,
    },
  })
  const font = medicare ? FONT_CLASS.serif : FONT_CLASS[input.blueprint.typeClass]
  const tone = topTone(input.blueprint)
  const proposed: DesignRationale = {
    ...input.rationale,
    grid: { name: grid, alignment: input.rationale.grid.alignment, intentional_break: mode },
    scale_ratios: {
      hero,
      offer_to_headline_cap: hero === "offer" ? Math.max(1.6, Math.min(2.4, input.blueprint.scale.offerToHeadline)) : 0.48,
      headline_to_body_cap: Math.max(2.5, Math.min(4, input.blueprint.scale.headlineToBody)),
      offer_to_body: hero === "offer" ? 5 : 1.6,
      front_type_size_count: 3,
    },
    palette: {
      ...input.rationale.palette,
      neutral_hex: guarded.neutrals.slice(0, 2),
      accent_hex: guarded.accent,
      second_accent_hex: null,
      emotion: emotionFor(tone, medicare),
    },
    font_pairing: font.pairing,
    type_pairing: {
      ...input.rationale.type_pairing,
      display: font.display,
      body: "Source Sans 3, an OFL text face, at regular weight",
    },
    focal_element: {
      ...input.rationale.focal_element,
      kind: hero === "offer" ? "offer_numeral" : "headline",
      description: input.blueprint.front,
      visual_weight_pct: hero === "offer" ? 46 : 40,
      lead_modality: hero === "offer" ? "offer_field" : mode === "full-bleed" ? "image" : "type",
      lead_modality_area_pct: mode === "full-bleed" ? 74 : 68,
    },
    photo_brief: {
      ...input.rationale.photo_brief,
      placement: mode === "integrated" || mode === "full-bleed" ? "full_bleed" : "panel_bleed_two_edges",
      subject: "A new photograph for this campaign. Not the reference photograph.",
    },
    offer_treatment: {
      ...input.rationale.offer_treatment,
      kind: hero === "offer" ? "numeral_hero" : medicare ? "concrete_step_no_discount" : "headline_is_the_offer",
      placement: input.blueprint.front,
    },
    principles_invoked: ["P1", "P4", "P7", input.blueprint.sourceId].slice(0, 8),
  }
  const checked = validateDesignRationale(proposed)
  if (!checked.ok) return null
  const spec: CreativeSpec = {
    ...guarded.spec,
    tone,
    palette: [guarded.neutrals[0] ?? "#F4F1EA", guarded.neutrals[1] ?? "#1A1A1A", guarded.accent],
    blueprint: {
      sourceId: input.blueprint.sourceId,
      tone,
      offerType,
      copyPattern,
    },
    visualDirection: "A new photograph for this business. Do not reuse a reference photograph, illustration, logo, or icon.",
  }
  return {
    rationale: checked.rationale,
    spec,
    mode,
    tone,
    similarity: guarded.similarity.score,
    perturbed: guarded.similarity.perturbed,
  }
}

export function modeFor(devices: readonly BlueprintDevice[]): CompositionMode {
  if (devices.includes("full-bleed")) return "full-bleed"
  if (devices.includes("cut-out-subject")) return "integrated"
  if (devices.includes("color-blocked-offer")) return "dark-offer-field"
  if (devices.includes("thumbnail-strip")) return "full-bleed"
  if (devices.includes("icon-grid")) return "type-led"
  return "overlapping-card"
}

function gridFor(mode: CompositionMode): GridName {
  if (mode === "integrated" || mode === "calm-column") return "centered-stack"
  if (mode === "type-led") return "bands"
  if (mode === "full-bleed" || mode === "overlapping-card") return "full-bleed-plus-panel"
  return "thirds"
}

function emotionFor(tone: string, medicare: boolean): DesignRationale["palette"]["emotion"] {
  if (medicare || tone === "calm") return "compliance_calm"
  if (tone === "urgent" || tone === "fearful" || tone === "scarcity") return "urgency_real"
  if (tone === "joyful") return "appetite"
  if (tone === "luxury") return "craft"
  return "trust"
}

export function mapClientColors(
  client: readonly string[],
  roles: MailerBlueprint["paletteRoles"]
): { neutrals: string[]; accent: string } {
  const pool = client.filter((hex) => /^#[0-9A-Fa-f]{6}$/.test(hex)).slice(0, 3)
  const colors = pool.length > 0 ? pool : ["#F4F1EA", "#1C1C1C", "#2F6FED"]
  const sorted = [...colors].sort((a, b) => luminance(a) - luminance(b))
  const darkest = sorted[0] ?? "#1C1C1C"
  const lightest = sorted[sorted.length - 1] ?? "#F4F1EA"
  const accent = mostSaturated(colors)
  const dominant = roles.dominant === "light" ? lightest : darkest
  const accentHex = accent.toLowerCase() === dominant.toLowerCase()
    ? (colors.find((hex) => hex.toLowerCase() !== dominant.toLowerCase()) ?? "#2F6FED")
    : accent
  const neutrals = roles.neutral === "dark" ? [darkest, lightest] : [lightest, darkest]
  return { neutrals, accent: accentHex }
}

function clientColors(spec: CreativeSpec, rationale: DesignRationale): string[] {
  const fromSpec = (spec.palette ?? []).filter((hex) => /^#[0-9A-Fa-f]{6}$/.test(hex))
  if (fromSpec.length > 0) return fromSpec
  return [...rationale.palette.neutral_hex, rationale.palette.accent_hex]
}

function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16)
  const r = ((value >> 16) & 255) / 255
  const g = ((value >> 8) & 255) / 255
  const b = (value & 255) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function mostSaturated(colors: readonly string[]): string {
  return [...colors].sort((a, b) => saturation(b) - saturation(a))[0] ?? "#2F6FED"
}

function saturation(hex: string): number {
  const value = parseInt(hex.slice(1), 16)
  const r = ((value >> 16) & 255) / 255
  const g = ((value >> 8) & 255) / 255
  const b = (value & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const light = (max + min) / 2
  if (max === min) return 0
  return (max - min) / (1 - Math.abs(2 * light - 1))
}
