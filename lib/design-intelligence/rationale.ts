/**
 * Design Rationale, the art-director decision that layout is allowed to follow.
 * Shape matches schemas/design-rationale.schema.json. Principles and targets
 * only: no copied mailer wording and no reference artwork.
 */

export const DESIGN_RATIONALE_VERSION = "1.0.0" as const

export const DESIGN_VERTICALS = [
  "roofing",
  "plumbing",
  "hvac",
  "medicare_insurance",
  "real_estate",
  "general_local_service",
] as const
export type DesignVertical = (typeof DESIGN_VERTICALS)[number]

export const GRID_NAMES = [
  "thirds",
  "split-40-60",
  "bands",
  "full-bleed-plus-panel",
  "centered-stack",
] as const
export type GridName = (typeof GRID_NAMES)[number]

export const EYE_PATHS = ["Z", "F", "diagonal", "stacked-bands"] as const
export const TRIM_SIZES = ["5x8", "6x9"] as const
export type TrimSize = (typeof TRIM_SIZES)[number]

export interface DesignRationale {
  version: typeof DESIGN_RATIONALE_VERSION
  vertical: DesignVertical
  format: { trim: TrimSize; orientation: "landscape" | "portrait" }
  audience_moment: string
  focal_element: {
    kind: "offer_numeral" | "headline" | "photograph_subject" | "face" | "product"
    description: string
    visual_weight_pct: number
    lead_modality: "image" | "type" | "offer_field"
    lead_modality_area_pct: number
  }
  eye_path: {
    pattern: (typeof EYE_PATHS)[number]
    stops: [string, string, string]
  }
  grid: {
    name: GridName
    alignment: "left" | "center"
    intentional_break: string
  }
  scale_ratios: {
    hero: "offer" | "headline"
    offer_to_headline_cap: number
    headline_to_body_cap: number
    offer_to_body: number
    front_type_size_count: 2 | 3
  }
  palette: {
    neutral_hex: string[]
    accent_hex: string
    second_accent_hex: string | null
    emotion: "trust" | "urgency_real" | "craft" | "compliance_calm" | "appetite"
    banned: string[]
  }
  type_pairing: {
    family_count: 1 | 2
    display: string
    body: string
    script_role: "none" | "logo_only"
  }
  photo_brief: {
    mode: "documentary_job" | "result" | "advisor_portrait" | "none"
    subject: string
    crop: string
    gaze: string
    lighting: string
    placement: "full_bleed" | "panel_bleed_two_edges" | "none"
  }
  offer_treatment: {
    kind: "numeral_hero" | "concrete_step_no_discount" | "headline_is_the_offer"
    placement: string
    qualifier: string
    expiry: string
  }
  density_targets: {
    calm_field_pct_min: number
    front_fact_budget: string[]
    boxed_modules_max: 3
    starbursts_max: 1
  }
  response: {
    primary: "phone" | "qr" | "mail_back"
    secondary: "phone" | "qr" | "none"
    lockup: string
  }
  trust: {
    front_line: string
    back_only: string[]
  }
  principles_invoked: string[]
}

const HEX = /^#[0-9A-Fa-f]{6}$/

export function isDesignRationale(value: unknown): value is DesignRationale {
  return validateDesignRationale(value).ok
}

export function validateDesignRationale(
  value: unknown
): { ok: true; rationale: DesignRationale } | { ok: false; errors: string[] } {
  const errors: string[] = []
  if (!value || typeof value !== "object") {
    return { ok: false, errors: ["Design Rationale must be an object."] }
  }
  const raw = value as Record<string, unknown>
  if (raw.version !== DESIGN_RATIONALE_VERSION) errors.push("version must be 1.0.0.")
  if (!includes(DESIGN_VERTICALS, raw.vertical)) errors.push("vertical is not a known trade.")
  const format = record(raw.format)
  if (!format || !includes(TRIM_SIZES, format.trim) || (format.orientation !== "landscape" && format.orientation !== "portrait")) {
    errors.push("format must be a 5x8 or 6x9 landscape or portrait card.")
  }
  if (typeof raw.audience_moment !== "string" || raw.audience_moment.trim().length < 8) {
    errors.push("audience_moment must name one situation.")
  }

  const focal = record(raw.focal_element)
  if (!focal) errors.push("focal_element is required.")
  else {
    if (!includes(["offer_numeral", "headline", "photograph_subject", "face", "product"], focal.kind)) {
      errors.push("focal_element.kind is invalid.")
    }
    if (typeof focal.description !== "string" || focal.description.trim().length < 8) {
      errors.push("focal_element.description is required.")
    }
    if (!inRange(focal.visual_weight_pct, 35, 50)) {
      errors.push("focal_element.visual_weight_pct must be 35–50.")
    }
    if (!includes(["image", "type", "offer_field"], focal.lead_modality)) {
      errors.push("focal_element.lead_modality is invalid.")
    }
    if (!inRange(focal.lead_modality_area_pct, 60, 80)) {
      errors.push("focal_element.lead_modality_area_pct must be 60–80.")
    }
  }

  const eye = record(raw.eye_path)
  if (!eye || !includes(EYE_PATHS, eye.pattern) || !isStringTrio(eye.stops)) {
    errors.push("eye_path needs a pattern and exactly three stops.")
  }

  const grid = record(raw.grid)
  if (!grid || !includes(GRID_NAMES, grid.name) || (grid.alignment !== "left" && grid.alignment !== "center")) {
    errors.push("grid name or alignment is invalid.")
  } else if (typeof grid.intentional_break !== "string" || !grid.intentional_break.trim()) {
    errors.push("grid.intentional_break is required.")
  }

  const scale = record(raw.scale_ratios)
  if (!scale) errors.push("scale_ratios is required.")
  else {
    if (scale.hero !== "offer" && scale.hero !== "headline") errors.push("scale_ratios.hero is invalid.")
    if (typeof scale.offer_to_headline_cap !== "number" || scale.offer_to_headline_cap <= 0) {
      errors.push("offer_to_headline_cap must be a positive number.")
    } else if (scale.hero === "offer" && scale.offer_to_headline_cap < 1.6) {
      errors.push("When the offer is the hero it must be at least 1.6× the headline.")
    } else if (scale.hero === "headline" && scale.offer_to_headline_cap >= 1) {
      errors.push("When the headline is the hero the offer stays smaller than the headline.")
    }
    if (typeof scale.headline_to_body_cap !== "number" || scale.headline_to_body_cap < 2.5) {
      errors.push("headline_to_body_cap must be at least 2.5.")
    }
    if (typeof scale.offer_to_body !== "number" || scale.offer_to_body < 1.5) {
      errors.push("offer_to_body must be at least 1.5.")
    }
    if (scale.front_type_size_count !== 2 && scale.front_type_size_count !== 3) {
      errors.push("The front uses two or three type sizes.")
    }
  }

  const palette = record(raw.palette)
  if (!palette) errors.push("palette is required.")
  else {
    const neutrals = Array.isArray(palette.neutral_hex) ? palette.neutral_hex : []
    if (neutrals.length < 1 || neutrals.length > 2 || neutrals.some((hex) => typeof hex !== "string" || !HEX.test(hex))) {
      errors.push("palette.neutral_hex needs one or two hex colors.")
    }
    if (typeof palette.accent_hex !== "string" || !HEX.test(palette.accent_hex)) {
      errors.push("palette.accent_hex must be a hex color.")
    }
    if (palette.second_accent_hex !== null && (typeof palette.second_accent_hex !== "string" || !HEX.test(palette.second_accent_hex))) {
      errors.push("second_accent_hex must be null or a hex color.")
    }
    if (!includes(["trust", "urgency_real", "craft", "compliance_calm", "appetite"], palette.emotion)) {
      errors.push("palette.emotion is invalid.")
    }
    if (!Array.isArray(palette.banned)) errors.push("palette.banned must be a list.")
  }

  const type = record(raw.type_pairing)
  if (!type || (type.family_count !== 1 && type.family_count !== 2)) {
    errors.push("type_pairing.family_count must be 1 or 2.")
  } else if (typeof type.display !== "string" || typeof type.body !== "string" || (type.script_role !== "none" && type.script_role !== "logo_only")) {
    errors.push("type_pairing is incomplete.")
  }

  const photo = record(raw.photo_brief)
  if (!photo || !includes(["documentary_job", "result", "advisor_portrait", "none"], photo.mode)) {
    errors.push("photo_brief.mode is invalid.")
  } else if (
    typeof photo.subject !== "string" ||
    typeof photo.crop !== "string" ||
    typeof photo.gaze !== "string" ||
    typeof photo.lighting !== "string" ||
    !includes(["full_bleed", "panel_bleed_two_edges", "none"], photo.placement)
  ) {
    errors.push("photo_brief is incomplete.")
  }

  const offer = record(raw.offer_treatment)
  if (!offer || !includes(["numeral_hero", "concrete_step_no_discount", "headline_is_the_offer"], offer.kind)) {
    errors.push("offer_treatment.kind is invalid.")
  } else if (typeof offer.placement !== "string" || typeof offer.qualifier !== "string" || typeof offer.expiry !== "string") {
    errors.push("offer_treatment is incomplete.")
  }

  const density = record(raw.density_targets)
  if (!density) errors.push("density_targets is required.")
  else {
    if (!inRange(density.calm_field_pct_min, 25, 50)) errors.push("calm_field_pct_min must be 25–50.")
    const facts = Array.isArray(density.front_fact_budget) ? density.front_fact_budget : []
    if (facts.length < 3 || facts.length > 5 || facts.some((fact) => typeof fact !== "string")) {
      errors.push("front_fact_budget needs three to five facts.")
    }
    if (density.boxed_modules_max !== 3) errors.push("boxed_modules_max is 3.")
    if (density.starbursts_max !== 1) errors.push("starbursts_max is 1.")
  }

  const response = record(raw.response)
  if (!response || !includes(["phone", "qr", "mail_back"], response.primary) || !includes(["phone", "qr", "none"], response.secondary)) {
    errors.push("response devices are invalid.")
  } else if (typeof response.lockup !== "string" || !response.lockup.trim()) {
    errors.push("response.lockup is required.")
  }

  const trust = record(raw.trust)
  if (!trust || typeof trust.front_line !== "string" || !Array.isArray(trust.back_only)) {
    errors.push("trust is incomplete.")
  }

  if (!Array.isArray(raw.principles_invoked) || raw.principles_invoked.length < 3 || raw.principles_invoked.some((item) => typeof item !== "string")) {
    errors.push("principles_invoked needs at least three ids.")
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, rationale: value as DesignRationale }
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value)
}

function inRange(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
}

function isStringTrio(value: unknown): value is [string, string, string] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === "string" && item.trim().length >= 3)
  )
}
