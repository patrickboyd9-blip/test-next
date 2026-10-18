import { gradeRank, isAntiExample, type LibraryRecord, type MailerAnalysis } from "./library"
import { isForbiddenResearchPath } from "./images"
import { ownerFavoriteIds } from "./owner-favorites"
import {
  BLUEPRINT_TAG_CONFIG,
  classifyOfferAndCopy,
  classifyVisionTags,
  COPY_PATTERNS,
  matchTagRules,
  TONE_TAGS,
  VERTICAL_TAGS,
  verticalFromAnalysis,
  type CopyPattern,
  type OfferType,
  type ProposedTag,
  type ToneTag,
  type VerticalTag,
} from "./blueprint-tags"

export {
  BLUEPRINT_TAG_CONFIG,
  COPY_PATTERNS,
  TONE_TAGS,
  VERTICAL_TAGS,
}
export type { CopyPattern, OfferType, ProposedTag, ToneTag, VerticalTag }

/**
 * A mailer's structure, separated from its art and its words.
 * Boxes are fractions of the card. Palette values are roles.
 * Source photographs, marks, and slogans are not part of the blueprint a customer sees.
 */

export const BLUEPRINT_VERSION = "1.1.0" as const

export const BLUEPRINT_ROLES = [
  "photo",
  "headline",
  "subhead",
  "offer",
  "badge",
  "benefits",
  "proof",
  "response",
  "logo",
] as const
export type BlueprintRole = (typeof BLUEPRINT_ROLES)[number]

export const BLUEPRINT_DEVICES = [
  "pill-code",
  "burst-badge",
  "icon-grid",
  "color-blocked-offer",
  "thumbnail-strip",
  "cut-out-subject",
  "full-bleed",
] as const
export type BlueprintDevice = (typeof BLUEPRINT_DEVICES)[number]

export const TYPE_CLASSES = ["condensed-display", "humanist-sans", "serif"] as const
export type TypeClass = (typeof TYPE_CLASSES)[number]

export interface NormBox {
  role: BlueprintRole
  face: "front" | "back"
  x: number
  y: number
  w: number
  h: number
}

export interface ConfidenceTag<T extends string> {
  tag: T
  confidence: number
}

/** Kept for the too-close check. Never sent to the customer or the art director. */
export interface BlueprintGuard {
  sourcePhrases: string[]
  paletteHex: string[]
  imageHash: string | null
}

export interface MailerBlueprint {
  version: typeof BLUEPRINT_VERSION
  id: string
  sourceId: string
  origin: "vision" | "structural"
  grade: string
  boxes: NormBox[]
  scale: {
    offerToHeadline: number
    headlineToBody: number
    photoShare: number
  }
  paletteRoles: {
    dominant: "dark" | "light" | "saturated"
    accent: "saturated" | "muted"
    neutral: "light" | "dark"
  }
  typeClass: TypeClass
  devices: BlueprintDevice[]
  copyPattern: CopyPattern
  /** Confident offer tags. Empty when the piece needs a new tag. */
  offerTypes: ConfidenceTag<OfferType>[]
  /** Confident wording patterns. Empty when the piece needs a new tag. */
  copyPatterns: ConfidenceTag<CopyPattern>[]
  /** Abstract slots only. Never the source headline. */
  copyTemplate: string
  /** New tags the extractor suggested. Not merged into the vocabulary. */
  proposedTags: ProposedTag[]
  front: string
  back: string
  tones: ConfidenceTag<ToneTag>[]
  verticals: ConfidenceTag<VerticalTag>[]
  guard: BlueprintGuard
  extractedAt: string
  model: string
}

export interface BlueprintCard {
  id: string
  grade: string
  tone: string
  vertical: string
  offerType: string
  copyPattern: string
  devices: BlueprintDevice[]
  boxes: NormBox[]
  /** Set only for an internal owner, and only when a source photograph is on file. */
  thumb: { mediaType: string; base64: string } | null
}

export function isInternalOwner(ownerId: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  const configured = env.DESIGN_INTERNAL_OWNERS?.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean) ?? []
  if (!ownerId || configured.length === 0) return false
  return configured.includes(ownerId.trim().toLowerCase())
}

export function structuralBlueprint(record: LibraryRecord, extractedAt = "1970-01-01T00:00:00.000Z"): MailerBlueprint | null {
  if (!eligibleRecord(record)) return null
  const analysis = record.analysis
  const text = analysisText(analysis)
  const devices = devicesFrom(text)
  const faces = (analysis?.faces ?? ["front"]).filter((face): face is "front" | "back" => face === "front" || face === "back")
  const verticals = verticalTags(analysis?.vertical, text)
  const tones = toneTags(text)
  const tagged = classifyOfferAndCopy(text)
  return {
    version: BLUEPRINT_VERSION,
    id: record.id,
    sourceId: record.id,
    origin: "structural",
    grade: record.grade || analysis?.grade || "B",
    boxes: boxesFor(devices, faces.length > 0 ? faces : ["front"]),
    scale: scaleFrom(text, devices),
    paletteRoles: rolesFrom(text),
    typeClass: typeClassFrom(text),
    devices,
    copyPattern: tagged.copyPattern,
    offerTypes: tagged.offerTypes,
    copyPatterns: tagged.copyPatterns,
    copyTemplate: tagged.copyTemplate,
    proposedTags: tagged.proposedTags,
    front: frontLine(devices),
    back: backLine(devices),
    tones: tones.length > 0 ? tones : [{ tag: "professional", confidence: 0.35 }],
    verticals,
    guard: {
      sourcePhrases: quotedPhrases(text),
      paletteHex: (analysis?.palette_hex ?? []).filter((hex) => /^#[0-9A-Fa-f]{6}$/.test(hex)).slice(0, 4),
      imageHash: null,
    },
    extractedAt,
    model: "structural",
  }
}

export function structuralBlueprints(records: readonly LibraryRecord[], extractedAt?: string): MailerBlueprint[] {
  return records.flatMap((record) => {
    const blueprint = structuralBlueprint(record, extractedAt)
    return blueprint ? [blueprint] : []
  })
}

export function parseVisionBlueprint(raw: unknown, id: string): MailerBlueprint | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const boxes = parseBoxes(row.boxes)
  if (boxes.length < 2) return null
  const devices = parseDevices(row.devices)
  const typeClass = includes(TYPE_CLASSES, row.typeClass) ? row.typeClass : "humanist-sans"
  const grade = typeof row.grade === "string" && row.grade.trim() ? row.grade.trim() : "B"
  const guard = record(row.guard)
  const phrases = Array.isArray(guard?.sourcePhrases)
    ? guard.sourcePhrases.filter((item): item is string => typeof item === "string").slice(0, 8)
    : []
  const paletteHex = Array.isArray(guard?.paletteHex)
    ? guard.paletteHex.filter((item): item is string => typeof item === "string" && /^#[0-9A-Fa-f]{6}$/.test(item)).slice(0, 4)
    : []
  const tagged = classifyVisionTags({
    offerTypes: row.offerTypes,
    copyPatterns: row.copyPatterns,
    copyPattern: row.copyPattern,
    proposedTags: row.proposedTags,
    sourcePhrases: phrases,
  })
  return {
    version: BLUEPRINT_VERSION,
    id,
    sourceId: id,
    origin: "vision",
    grade,
    boxes,
    scale: {
      offerToHeadline: clampNumber(record(row.scale)?.offerToHeadline, 0.4, 2.4, 1.6),
      headlineToBody: clampNumber(record(row.scale)?.headlineToBody, 2.5, 4, 3),
      photoShare: clampNumber(record(row.scale)?.photoShare, 0.2, 0.9, 0.6),
    },
    paletteRoles: {
      dominant: includes(["dark", "light", "saturated"] as const, record(row.paletteRoles)?.dominant) ? record(row.paletteRoles)?.dominant as "dark" | "light" | "saturated" : "light",
      accent: record(row.paletteRoles)?.accent === "muted" ? "muted" : "saturated",
      neutral: record(row.paletteRoles)?.neutral === "dark" ? "dark" : "light",
    },
    typeClass,
    devices: devices.length > 0 ? devices : ["full-bleed"],
    copyPattern: tagged.copyPattern,
    offerTypes: tagged.offerTypes,
    copyPatterns: tagged.copyPatterns,
    copyTemplate: tagged.copyTemplate,
    proposedTags: tagged.proposedTags,
    front: clip(stringField(row, "front") || frontLine(devices)),
    back: clip(stringField(row, "back") || backLine(devices)),
    tones: parseTags(row.tones, TONE_TAGS),
    verticals: parseTags(row.verticals, VERTICAL_TAGS),
    guard: {
      sourcePhrases: phrases,
      paletteHex,
      imageHash: typeof guard?.imageHash === "string" ? guard.imageHash : null,
    },
    extractedAt: "",
    model: "",
  }
}

export function selectBlueprints(input: {
  blueprints: readonly MailerBlueprint[]
  vertical: string
  tone: string
  /** Omit when the brief does not name an offer. Matching then skips this dimension. */
  offerType?: string
  /** Omit when the brief does not name a wording pattern. */
  copyPattern?: string
  favorites?: readonly string[]
  limit?: number
}): MailerBlueprint[] {
  const favorites = new Set(input.favorites ?? ownerFavoriteIds())
  const vertical = normalizeVerticalTag(input.vertical)
  const tone = normalizeToneTag(input.tone)
  const offer = normalizeOffer(input.offerType)
  const pattern = normalizePattern(input.copyPattern)
  const ranked = input.blueprints.map((blueprint) => {
    const verticalHit = tagConfidence(blueprint.verticals, vertical)
    const toneHit = tagConfidence(blueprint.tones, tone)
    const offerHit = offer ? tagConfidence(blueprint.offerTypes, offer) : 0
    const patternHit = pattern ? tagConfidence(blueprint.copyPatterns, pattern) : 0
    return {
      blueprint,
      vertical: verticalHit,
      tone: toneHit,
      offer: offerHit,
      pattern: patternHit,
      score: blueprintScore(blueprint, favorites) + verticalHit * 10 + toneHit * 10 + (offer ? offerHit * 8 : 0) + (pattern ? patternHit * 8 : 0),
      band: matchBand({ vertical: verticalHit, tone: toneHit, offer: offerHit, pattern: patternHit, wantOffer: Boolean(offer), wantPattern: Boolean(pattern) }),
    }
  })
  const ordered = [...ranked].sort((a, b) => a.band - b.band || b.score - a.score || a.blueprint.id.localeCompare(b.blueprint.id))
  const limit = Math.max(1, Math.min(12, input.limit ?? 6))
  const seen = new Set<string>()
  const chosen: MailerBlueprint[] = []
  for (const item of ordered) {
    if (seen.has(item.blueprint.id)) continue
    seen.add(item.blueprint.id)
    chosen.push(item.blueprint)
    if (chosen.length >= limit) break
  }
  return chosen
}

export function blueprintCard(blueprint: MailerBlueprint, thumb: BlueprintCard["thumb"] = null): BlueprintCard {
  return {
    id: blueprint.id,
    grade: blueprint.grade,
    tone: blueprint.tones[0]?.tag ?? "professional",
    vertical: blueprint.verticals[0]?.tag ?? "general",
    offerType: blueprint.offerTypes[0]?.tag ?? "",
    copyPattern: blueprint.copyPatterns[0]?.tag ?? "",
    devices: blueprint.devices,
    boxes: blueprint.boxes,
    thumb,
  }
}

export function topTone(blueprint: MailerBlueprint): ToneTag {
  return blueprint.tones[0]?.tag ?? "professional"
}

export function toneFromText(text: string): ToneTag {
  return toneTags(text)[0]?.tag ?? "professional"
}

export function verticalTagFromText(text: string, fallback = "general"): VerticalTag {
  return verticalTags(undefined, text)[0]?.tag ?? normalizeVerticalTag(fallback)
}

export function normalizeToneTag(value: string | undefined): ToneTag {
  const text = (value ?? "").toLowerCase()
  const known = TONE_TAGS.find((tag) => text.includes(tag))
  if (known) return known
  return toneFromText(text)
}

export function normalizeVerticalTag(value: string | undefined): VerticalTag {
  return verticalFromAnalysis(value) ?? "general"
}

export function eligibleRecord(record: Pick<LibraryRecord, "id" | "analysis" | "images">): boolean {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(record.id)) return false
  if (record.id.toLowerCase().includes("private")) return false
  if (isAntiExample(record)) return false
  if (record.images.some((image) => isForbiddenResearchPath(image.path))) return false
  return true
}

function blueprintScore(blueprint: MailerBlueprint, favorites: ReadonlySet<string>): number {
  let score = 1
  if (favorites.has(blueprint.id)) score += 16
  const rank = gradeRank(blueprint.grade)
  if (rank === 0) score += 12
  else if (rank === 1) score += 10
  else if (rank === 2) score += 7
  else if (rank === 3) score += 4
  else if (rank <= 5) score += 2
  return score
}

const MATCH_FLOOR = 0.35

function matchBand(input: {
  vertical: number
  tone: number
  offer: number
  pattern: number
  wantOffer: boolean
  wantPattern: boolean
}): number {
  const vertical = input.vertical >= MATCH_FLOOR
  const tone = input.tone >= MATCH_FLOOR
  const offer = input.offer >= MATCH_FLOOR
  const pattern = input.pattern >= MATCH_FLOOR
  if (input.wantOffer && input.wantPattern && vertical && tone && offer && pattern) return 0
  if (input.wantOffer && vertical && tone && offer) return 1
  if (vertical && tone) return 2
  if (input.wantOffer && tone && offer && !vertical) return 3
  if (input.wantPattern && tone && pattern && !vertical) return 4
  if (tone) return 5
  return 6
}

function normalizeOffer(value: string | undefined): OfferType | undefined {
  if (!value) return undefined
  return (BLUEPRINT_TAG_CONFIG.offerTypes.some((rule) => rule.id === value) ? value : undefined) as OfferType | undefined
}

function normalizePattern(value: string | undefined): CopyPattern | undefined {
  if (!value) return undefined
  return (COPY_PATTERNS.includes(value as CopyPattern) ? value : undefined) as CopyPattern | undefined
}

function tagConfidence<T extends string>(tags: readonly ConfidenceTag<T>[] | undefined, wanted: T): number {
  return tags?.find((tag) => tag.tag === wanted)?.confidence ?? 0
}

function analysisText(analysis: MailerAnalysis | undefined): string {
  if (!analysis) return ""
  return [
    analysis.focal_point,
    analysis.eye_path,
    analysis.grid,
    analysis.scale_ratios,
    analysis.summary,
    analysis.offer_placement,
    analysis.photo_art_direction,
    analysis.trust_and_cta,
    analysis.type_choices,
    ...(analysis.emulate ?? []),
  ].filter(Boolean).join(" ")
}

function devicesFrom(text: string): BlueprintDevice[] {
  const devices: BlueprintDevice[] = []
  if (/pill/i.test(text)) devices.push("pill-code")
  if (/burst|starburst|badge/i.test(text)) devices.push("burst-badge")
  if (/2\s*[×x]\s*2|icon grid|icon benefit/i.test(text)) devices.push("icon-grid")
  if (/color-blocked|color blocked|offer panel|offer block/i.test(text)) devices.push("color-blocked-offer")
  if (/thumbnail/i.test(text)) devices.push("thumbnail-strip")
  if (/cut-?out|product hero/i.test(text)) devices.push("cut-out-subject")
  if (/full-bleed|full bleed/i.test(text)) devices.push("full-bleed")
  if (devices.length === 0 && /photograph|photo/i.test(text)) devices.push("full-bleed")
  return devices
}

function typeClassFrom(text: string): TypeClass {
  if (/condensed/i.test(text)) return "condensed-display"
  if (/serif/i.test(text)) return "serif"
  return "humanist-sans"
}

function scaleFrom(text: string, devices: readonly BlueprintDevice[]): MailerBlueprint["scale"] {
  const loud = /1\.6|larger than|numeral|loud/i.test(text)
  return {
    offerToHeadline: loud ? 1.8 : 0.55,
    headlineToBody: 3,
    photoShare: devices.includes("full-bleed") ? 0.78 : devices.includes("cut-out-subject") ? 0.46 : 0.58,
  }
}

function rolesFrom(text: string): MailerBlueprint["paletteRoles"] {
  const dark = /black|dark field|navy/i.test(text)
  const light = /white|light ground|paper/i.test(text)
  return {
    dominant: dark && !light ? "dark" : light ? "light" : "saturated",
    accent: /lime|bold|saturated|accent/i.test(text) ? "saturated" : "muted",
    neutral: dark && !light ? "dark" : "light",
  }
}

function toneTags(text: string): ConfidenceTag<ToneTag>[] {
  return matchTagRules(text, BLUEPRINT_TAG_CONFIG.tones)
}

function verticalTags(vertical: string | undefined, text: string): ConfidenceTag<VerticalTag>[] {
  const fromField = verticalFromAnalysis(vertical)
  const matched = matchTagRules(text, BLUEPRINT_TAG_CONFIG.verticals)
  if (fromField && !matched.some((tag) => tag.tag === fromField)) {
    matched.unshift({ tag: fromField, confidence: 0.9 })
  }
  if (matched.length === 0) return [{ tag: "general", confidence: 0.4 }]
  return matched.slice(0, 4)
}

function boxesFor(devices: readonly BlueprintDevice[], faces: readonly ("front" | "back")[]): NormBox[] {
  const front: NormBox[] = []
  if (devices.includes("full-bleed")) {
    front.push(box("photo", "front", 0, 0, 1, 1), box("headline", "front", 0.06, 0.08, 0.46, 0.26), box("offer", "front", 0.06, 0.4, 0.38, 0.2))
  } else if (devices.includes("cut-out-subject")) {
    front.push(box("photo", "front", 0.46, 0.06, 0.48, 0.86), box("headline", "front", 0.06, 0.1, 0.36, 0.22), box("offer", "front", 0.06, 0.38, 0.34, 0.24))
  } else if (devices.includes("color-blocked-offer")) {
    front.push(box("photo", "front", 0, 0, 0.58, 1), box("offer", "front", 0.62, 0.1, 0.32, 0.34), box("headline", "front", 0.62, 0.5, 0.32, 0.2))
  } else {
    front.push(box("photo", "front", 0, 0, 0.52, 1), box("headline", "front", 0.56, 0.12, 0.38, 0.22), box("offer", "front", 0.56, 0.4, 0.36, 0.2))
  }
  if (devices.includes("pill-code") || devices.includes("burst-badge")) {
    front.push(box("badge", "front", 0.62, 0.7, 0.26, 0.1))
  }
  if (devices.includes("thumbnail-strip")) front.push(box("benefits", "front", 0.06, 0.68, 0.5, 0.1))
  front.push(box("subhead", "front", 0.06, 0.62, 0.4, 0.08), box("response", "front", 0.06, 0.82, 0.48, 0.12), box("logo", "front", 0.72, 0.84, 0.22, 0.1))
  const back: NormBox[] = []
  if (faces.includes("back") || devices.includes("icon-grid")) {
    if (devices.includes("icon-grid")) back.push(box("benefits", "back", 0.08, 0.1, 0.84, 0.46))
    back.push(box("proof", "back", 0.08, 0.64, 0.38, 0.2), box("response", "back", 0.52, 0.64, 0.4, 0.2))
  }
  return [...front, ...back]
}

function box(role: BlueprintRole, face: "front" | "back", x: number, y: number, w: number, h: number): NormBox {
  return { role, face, x, y, w, h }
}

function frontLine(devices: readonly BlueprintDevice[]): string {
  if (devices.includes("full-bleed")) return "A full-bleed photograph with type on the open picture."
  if (devices.includes("cut-out-subject")) return "A cut-out subject beside the type, with one offer."
  if (devices.includes("color-blocked-offer")) return "A photograph beside one color-blocked offer."
  return "A photograph and one offer, with the response kept together."
}

function backLine(devices: readonly BlueprintDevice[]): string {
  if (devices.includes("icon-grid")) return "A benefit grid on the back, then one response cluster."
  return "Proof and one response cluster."
}

function quotedPhrases(text: string): string[] {
  const found: string[] = []
  const pattern = /"([^"]{8,80})"|'([^']{8,80})'/g
  for (const match of text.matchAll(pattern)) {
    const phrase = (match[1] ?? match[2] ?? "").trim()
    if (phrase) found.push(phrase)
  }
  return found.slice(0, 6)
}

function parseBoxes(value: unknown): NormBox[] {
  if (!Array.isArray(value)) return []
  const boxes: NormBox[] = []
  for (const item of value) {
    const row = record(item)
    if (!row || !includes(BLUEPRINT_ROLES, row.role)) continue
    const face = row.face === "back" ? "back" : "front"
    boxes.push({
      role: row.role,
      face,
      x: clampNumber(row.x, 0, 1, 0),
      y: clampNumber(row.y, 0, 1, 0),
      w: clampNumber(row.w, 0.04, 1, 0.2),
      h: clampNumber(row.h, 0.04, 1, 0.12),
    })
  }
  return boxes.slice(0, 16)
}

function parseDevices(value: unknown): BlueprintDevice[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is BlueprintDevice => includes(BLUEPRINT_DEVICES, item))
}

function parseTags<T extends string>(value: unknown, allowed: readonly T[]): ConfidenceTag<T>[] {
  if (!Array.isArray(value)) return []
  const tags: ConfidenceTag<T>[] = []
  for (const item of value) {
    const row = record(item)
    if (!row || !includes(allowed, row.tag)) continue
    const confidence = clampNumber(row.confidence, 0, 1, 0.5)
    tags.push({ tag: row.tag, confidence })
  }
  return tags.slice(0, 4)
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function stringField(row: object, key: string): string {
  const value = (row as Record<string, unknown>)[key]
  return typeof value === "string" ? value : ""
}

function clip(value: string): string {
  const text = value.replace(/\s+/g, " ").trim()
  return text.length > 180 ? `${text.slice(0, 177)}...` : text
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value)
}
