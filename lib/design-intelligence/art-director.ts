import type { CampaignBrief } from "@/lib/campaign-creator/types"

import { contrastRatio, inkForBackground } from "./contrast"
import {
  DESIGN_RATIONALE_VERSION,
  type DesignRationale,
  type DesignVertical,
  type GridName,
  type TrimSize,
  validateDesignRationale,
} from "./rationale"
import type { ReferenceSelection } from "./select"
import { briefHasNumeralOffer, verticalForBrief } from "./vertical"

/**
 * Art director. The rules path is the default and the fallback: it writes a
 * Design Rationale from the playbook without a model call. A vision model may
 * replace the object when a key is configured. Either way the result is
 * validated, and Medicare stays compliance-calm.
 */

export interface ArtDirectorInput {
  brief: CampaignBrief
  selection: ReferenceSelection
  trim: TrimSize
  /** When set, the caller already asked a model. Invalid output is discarded. */
  proposed?: unknown
  /** 0 is the lead. Each slot is a different composition. */
  slot?: number
}

export type CompositionMode = "dark-offer-field" | "overlapping-card" | "type-led" | "calm-column"

export interface DirectionRecipe {
  grid: GridName
  mode: CompositionMode
  hero: "offer" | "headline"
  offerToHeadline: number
  headlineToBody: number
  offerToBody: number
  alignment: "left" | "center"
}

export interface ArtDirectorResult {
  rationale: DesignRationale
  source: "rules" | "model"
  errors: string[]
}

export function directDesign(input: ArtDirectorInput): ArtDirectorResult {
  const slot = input.slot ?? 0
  let source: "rules" | "model" = "rules"
  let drafted = rulesRationale(input)
  if (slot === 0 && input.proposed) {
    const validated = validateDesignRationale(input.proposed)
    if (validated.ok) {
      drafted = validated.rationale
      source = "model"
    }
  }
  const rationale = enforceHouseRules(applyRecipe(drafted, directionRecipe(input, slot)), input)
  const checked = validateDesignRationale(rationale)
  if (!checked.ok) {
    throw new Error(`Rules rationale failed validation: ${checked.errors.join(" ")}`)
  }
  return { rationale: checked.rationale, source, errors: [] }
}

export function hasConcreteOffer(brief: CampaignBrief): boolean {
  return Boolean(brief.offer?.trim()) && verticalForBrief(brief) !== "medicare_insurance"
}

export function directionRecipe(input: ArtDirectorInput, slot: number): DirectionRecipe {
  const vertical = input.selection.vertical
  const offer = hasConcreteOffer(input.brief)
  if (vertical === "medicare_insurance") {
    const calm: DirectionRecipe[] = [
      { grid: "full-bleed-plus-panel", mode: "overlapping-card", hero: "headline", offerToHeadline: 0.55, headlineToBody: 3, offerToBody: 1.65, alignment: "left" },
      { grid: "thirds", mode: "calm-column", hero: "headline", offerToHeadline: 0.5, headlineToBody: 2.8, offerToBody: 1.6, alignment: "left" },
      { grid: "centered-stack", mode: "type-led", hero: "headline", offerToHeadline: 0.45, headlineToBody: 3.6, offerToBody: 1.62, alignment: "left" },
    ]
    return calm[slot] ?? calm[0]!
  }
  const recipes: DirectionRecipe[] = [
    {
      grid: "thirds",
      mode: "dark-offer-field",
      hero: offer ? "offer" : "headline",
      offerToHeadline: offer ? 1.8 : 0.55,
      headlineToBody: 3.2,
      offerToBody: offer ? 5.7 : 1.8,
      alignment: "left",
    },
    {
      grid: "full-bleed-plus-panel",
      mode: "overlapping-card",
      hero: "headline",
      offerToHeadline: 0.62,
      headlineToBody: 3.4,
      offerToBody: 2.1,
      alignment: "left",
    },
    {
      grid: "centered-stack",
      mode: "type-led",
      hero: "headline",
      offerToHeadline: 0.48,
      headlineToBody: 4,
      offerToBody: 1.9,
      alignment: "left",
    },
  ]
  return recipes[slot] ?? recipes[0]!
}

/** True when two directions would paint the same grid at the same scale. */
export function sameComposition(a: DesignRationale, b: DesignRationale): boolean {
  if (a.grid.name !== b.grid.name || a.grid.intentional_break !== b.grid.intentional_break) return false
  if (a.scale_ratios.hero !== b.scale_ratios.hero) return false
  return (
    Math.abs(a.scale_ratios.offer_to_headline_cap - b.scale_ratios.offer_to_headline_cap) < 0.12 &&
    Math.abs(a.scale_ratios.headline_to_body_cap - b.scale_ratios.headline_to_body_cap) < 0.15
  )
}

function applyRecipe(rationale: DesignRationale, recipe: DirectionRecipe): DesignRationale {
  const offerHero = recipe.hero === "offer"
  return {
    ...rationale,
    focal_element: {
      ...rationale.focal_element,
      kind: offerHero ? "offer_numeral" : recipe.mode === "type-led" ? "headline" : rationale.focal_element.kind,
      lead_modality: offerHero ? "offer_field" : recipe.mode === "type-led" ? "type" : "image",
      lead_modality_area_pct: recipe.mode === "dark-offer-field" ? 62 : recipe.mode === "type-led" ? 66 : recipe.mode === "calm-column" ? 64 : 74,
      visual_weight_pct: offerHero ? 46 : 40,
      description: offerHero
        ? "One offer word, large enough to survive a blur, on a dark field beside the work."
        : recipe.mode === "overlapping-card"
          ? "A full-bleed photograph with one overlapping card. The offer is a tile, not the headline."
          : recipe.mode === "type-led"
            ? "The headline is the largest type, on a wide field under a photograph."
            : rationale.focal_element.description,
    },
    grid: { name: recipe.grid, alignment: recipe.alignment, intentional_break: recipe.mode },
    scale_ratios: {
      hero: recipe.hero,
      offer_to_headline_cap: recipe.offerToHeadline,
      headline_to_body_cap: recipe.headlineToBody,
      offer_to_body: recipe.offerToBody,
      front_type_size_count: 3,
    },
    offer_treatment: {
      ...rationale.offer_treatment,
      kind: offerHero ? "numeral_hero" : rationale.vertical === "medicare_insurance" ? "concrete_step_no_discount" : "headline_is_the_offer",
      placement: offerHero
        ? "One offer lockup on the dark field, larger than the headline"
        : recipe.mode === "overlapping-card" || recipe.mode === "type-led"
          ? "A distinct offer tile, smaller than the headline"
          : rationale.offer_treatment.placement,
    },
  }
}

export function rulesRationale(input: ArtDirectorInput): DesignRationale {
  const vertical = input.selection.vertical
  const numeral = briefHasNumeralOffer(input.brief) && vertical !== "medicare_insurance"
  const moment = audienceMoment(input.brief, vertical)
  const palette = paletteFor(vertical)
  const hero = numeral ? "offer" : "headline"
  return {
    version: DESIGN_RATIONALE_VERSION,
    vertical,
    format: { trim: input.trim, orientation: "landscape" },
    audience_moment: moment,
    focal_element: {
      kind: numeral ? "offer_numeral" : vertical === "medicare_insurance" ? "face" : "photograph_subject",
      description: focalDescription(vertical, numeral),
      visual_weight_pct: numeral ? 42 : 40,
      lead_modality: "image",
      lead_modality_area_pct: 70,
    },
    eye_path: {
      pattern: "Z",
      stops: eyeStops(vertical, numeral),
    },
    grid: { name: "thirds", alignment: "left", intentional_break: "dark-offer-field" },
    scale_ratios: {
      hero,
      offer_to_headline_cap: hero === "offer" ? 1.8 : 0.55,
      headline_to_body_cap: 3.2,
      offer_to_body: hero === "offer" ? 5.7 : 1.8,
      front_type_size_count: 3,
    },
    palette,
    type_pairing: {
      family_count: 1,
      display: vertical === "medicare_insurance"
        ? "Heavy text face for a short plain headline"
        : "Heavy grotesque for the figure and a four-word headline",
      body: "Same family at regular weight for one qualifier",
      script_role: "none",
    },
    photo_brief: photoFor(vertical),
    offer_treatment: {
      kind: numeral ? "numeral_hero" : vertical === "medicare_insurance" ? "concrete_step_no_discount" : "headline_is_the_offer",
      placement: "On the solid panel, not across the photograph",
      qualifier: numeral ? "What the figure includes, in one line" : "none",
      expiry: "none",
    },
    density_targets: {
      calm_field_pct_min: vertical === "medicare_insurance" ? 40 : 30,
      front_fact_budget: ["headline", "offer", "response lockup", "one trust line"],
      boxed_modules_max: 3,
      starbursts_max: 1,
    },
    response: {
      primary: "phone",
      secondary: "qr",
      lockup: "Phone in bold beside a labeled code, with the website in the same group",
    },
    trust: {
      front_line: vertical === "medicare_insurance"
        ? "The local name, smaller than the phone"
        : "One license or local line, smaller than the phone",
      back_only: vertical === "medicare_insurance"
        ? ["required plan disclaimer", "the same phone"]
        : ["one proof line", "the same phone"],
    },
    principles_invoked: ["P1", "P4", "P7", "TP-04", "AF5", "AF8"],
  }
}

export function siblingGrid(vertical: DesignVertical, index: number, lead: GridName): GridName {
  // Left panel and a narrow right column stay clear of the benchmark fingerprints
  // (bottom band, centered card, right half).
  const cycle: GridName[] =
    vertical === "medicare_insurance"
      ? ["full-bleed-plus-panel", "thirds"]
      : ["full-bleed-plus-panel", "thirds", "centered-stack"]
  const rest = cycle.filter((name) => name !== lead)
  return rest[index] ?? rest[0] ?? lead
}

function enforceHouseRules(rationale: DesignRationale, input: ArtDirectorInput): DesignRationale {
  const next: DesignRationale = {
    ...rationale,
    version: DESIGN_RATIONALE_VERSION,
    vertical: input.selection.vertical,
    format: { ...rationale.format, trim: input.trim, orientation: "landscape" },
    palette: { ...rationale.palette, banned: [...rationale.palette.banned] },
    offer_treatment: { ...rationale.offer_treatment },
    scale_ratios: { ...rationale.scale_ratios },
  }
  if (next.vertical === "medicare_insurance") {
    next.palette.emotion = "compliance_calm"
    next.palette.neutral_hex = ["#F3F0E8", "#1E2A3A"]
    next.palette.accent_hex = "#3E6B8A"
    next.palette.second_accent_hex = null
    next.offer_treatment.expiry = "none"
    next.offer_treatment.kind = "concrete_step_no_discount"
    next.scale_ratios.hero = "headline"
    next.scale_ratios.offer_to_headline_cap = Math.min(next.scale_ratios.offer_to_headline_cap, 0.6)
    if (next.scale_ratios.offer_to_headline_cap <= 0) next.scale_ratios.offer_to_headline_cap = 0.5
    next.scale_ratios.headline_to_body_cap = Math.max(next.scale_ratios.headline_to_body_cap, 2.5)
    next.scale_ratios.offer_to_body = Math.max(next.scale_ratios.offer_to_body, 1.5)
    const banned = new Set(next.palette.banned.map((item) => item.toLowerCase()))
    for (const item of ["eagle or seal", "official-notice folio", "fake response window", "treasury engraving"]) {
      if (!banned.has(item)) next.palette.banned.push(item)
    }
    if (next.grid.name === "centered-stack" || next.grid.name === "split-40-60" || next.grid.name === "bands") {
      next.grid = { ...next.grid, name: "full-bleed-plus-panel" }
    }
  }
  if (next.scale_ratios.hero === "offer" && next.scale_ratios.offer_to_headline_cap < 1.6) {
    next.scale_ratios.offer_to_headline_cap = 1.7
  }
  if (next.scale_ratios.headline_to_body_cap < 2.5) next.scale_ratios.headline_to_body_cap = 2.8
  if (next.offer_treatment.expiry.trim().length === 0) next.offer_treatment.expiry = "none"
  if (/respond within|hours only|act now|final notice/i.test(next.offer_treatment.expiry)) {
    next.offer_treatment.expiry = "none"
  }
  const accentOnPaper = contrastRatio(next.palette.accent_hex, lightNeutral(next))
  if (accentOnPaper < 3) {
    next.palette.accent_hex = inkForBackground(lightNeutral(next)) === "#161616" ? "#1A1A1A" : "#F4F1EA"
  }
  return next
}

function lightNeutral(rationale: DesignRationale): string {
  const [first, second] = rationale.palette.neutral_hex
  if (!second) return first ?? "#F4F1EA"
  return contrastRatio(first!, "#000000") > contrastRatio(second, "#000000") ? first! : second
}

function paletteFor(vertical: DesignVertical): DesignRationale["palette"] {
  if (vertical === "medicare_insurance") {
    return {
      neutral_hex: ["#F3F0E8", "#1E2A3A"],
      accent_hex: "#3E6B8A",
      second_accent_hex: null,
      emotion: "compliance_calm",
      banned: ["eagle or seal", "official-notice folio", "fake response window", "treasury engraving"],
    }
  }
  if (vertical === "plumbing") {
    return {
      neutral_hex: ["#F7F4EE", "#1C1C1C"],
      accent_hex: "#0E6B6B",
      second_accent_hex: null,
      emotion: "trust",
      banned: ["full-bleed coupon yellow", "cartoon water drops", "scalloped triple-price rail"],
    }
  }
  if (vertical === "hvac") {
    return {
      neutral_hex: ["#F4F6F5", "#1C2428"],
      accent_hex: "#C4552A",
      second_accent_hex: null,
      emotion: "trust",
      banned: ["snowflake and sun on the same face", "stock family on a sofa"],
    }
  }
  if (vertical === "real_estate") {
    return {
      neutral_hex: ["#F7F4EE", "#1A1A1A"],
      accent_hex: "#1A1A1A",
      second_accent_hex: null,
      emotion: "craft",
      banned: ["gold script", "marble texture", "just listed burst"],
    }
  }
  if (vertical === "roofing") {
    return {
      neutral_hex: ["#F4F1EA", "#1A1A1A"],
      accent_hex: "#C4371C",
      second_accent_hex: null,
      emotion: "craft",
      banned: ["government seal colors", "stock lightning glow", "gold script"],
    }
  }
  return {
    neutral_hex: ["#F6F3EC", "#1A1A1A"],
    accent_hex: "#C4371C",
    second_accent_hex: null,
    emotion: "trust",
    banned: ["rainbow icon row", "gold script", "official notice"],
  }
}

function photoFor(vertical: DesignVertical): DesignRationale["photo_brief"] {
  if (vertical === "medicare_insurance") {
    return {
      mode: "advisor_portrait",
      subject: "A real local advisor, named from the brief, photographed simply and looking at the reader",
      crop: "Head and shoulders, open paper beside the face",
      gaze: "At the reader",
      lighting: "Soft daylight, no dramatic rim light",
      placement: "panel_bleed_two_edges",
    }
  }
  if (vertical === "plumbing") {
    return {
      mode: "documentary_job",
      subject: "Gloved hands and one tool at a fixture, the person looking at the work",
      crop: "Tight on the work, two edges running to the trim",
      gaze: "At the work",
      lighting: "Ordinary indoor light, one direction",
      placement: "panel_bleed_two_edges",
    }
  }
  if (vertical === "hvac") {
    return {
      mode: "documentary_job",
      subject: "The equipment in the house, or a technician at the machine, one subject",
      crop: "The machine large, quiet wall left for type",
      gaze: "At the work",
      lighting: "Daylight from one side",
      placement: "full_bleed",
    }
  }
  if (vertical === "real_estate") {
    return {
      mode: "result",
      subject: "One house, photographed straight, with sky or a solid band for type",
      crop: "Full front elevation, horizon on a third",
      gaze: "None",
      lighting: "Open shade or late day, no HDR",
      placement: "full_bleed",
    }
  }
  if (vertical === "roofing") {
    return {
      mode: "documentary_job",
      subject: "A completed roof on a local house, one person small in frame looking at the ridge",
      crop: "Full bleed, ridge on a third, open sky for the panel",
      gaze: "At the work",
      lighting: "Late-day side light, no HDR",
      placement: "full_bleed",
    }
  }
  return {
    mode: "result",
    subject: "The finished work this company wants this month, one subject, no stock family",
    crop: "Full bleed with a quiet area for the panel",
    gaze: "At the work",
    lighting: "Natural, one direction",
    placement: "full_bleed",
  }
}

function focalDescription(vertical: DesignVertical, numeral: boolean): string {
  if (vertical === "medicare_insurance") {
    return "The advisor's face is the one thing left when the card is blurred, with a short headline beside it."
  }
  if (numeral) return "One price figure on a flat panel, large enough to survive a blur, beside the work."
  return "One photograph of the work, with a short headline as the only type event on the panel."
}

function eyeStops(vertical: DesignVertical, numeral: boolean): [string, string, string] {
  if (vertical === "medicare_insurance") {
    return ["the advisor's face", "a short plain headline", "one phone beside a labeled code"]
  }
  if (numeral) return ["the work in the photograph", "the single figure on the panel", "the phone and the labeled code"]
  return ["the photograph of the work", "the short headline", "the phone and the labeled code"]
}

function audienceMoment(brief: CampaignBrief, vertical: DesignVertical): string {
  const audience = brief.audience?.description?.trim()
  if (audience && audience.length >= 8) return audience.length > 140 ? `${audience.slice(0, 137)}...` : audience
  if (vertical === "medicare_insurance") {
    return "A person who wants a local human to explain plan choices, not a government notice."
  }
  if (vertical === "roofing") return "A homeowner who has not yet had anyone up on the roof."
  if (vertical === "plumbing") return "A household with one plumbing problem and no one called yet."
  if (vertical === "hvac") return "A household facing the season with equipment that needs one service."
  if (vertical === "real_estate") return "A neighbor who should see one house, not a portal."
  return "A neighbor who needs one job done and one way to start."
}
