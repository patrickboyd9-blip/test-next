/**
 * The only blueprint tag vocabulary.
 * Add a tone, vertical, offer type, or copy pattern here.
 * A copy pattern stores an abstract template with slots, never a mailer's words.
 * Vision may propose a new snake_case tag when none of these fit.
 * Proposals are stored on the blueprint. They are not written into this file.
 */

export const BLUEPRINT_TAG_CONFIG = {
  tones: [
    { id: "urgent", label: "Urgent", match: /urgent|storm|leak|now|deadline|emergency|today/gi },
    { id: "fearful", label: "Fearful", match: /fear|damage|worry|problem|before it|risk|ants|slow drain/gi },
    { id: "joyful", label: "Joyful", match: /joy|smile|spring|celebrat|fresh|lifestyle|appetite|supper/gi },
    { id: "luxury", label: "Luxury", match: /luxury|premium|studio|quiet black|gold/gi },
    { id: "friendly", label: "Friendly", match: /friendly|neighbor|local|kitchen|yard/gi },
    { id: "scarcity", label: "Scarcity", match: /scarcity|only \d|last chance|limited|two for one/gi },
    { id: "calm", label: "Calm", match: /calm|medicare|invitation|advisor/gi },
    { id: "professional", label: "Professional", match: /professional|licensed|trust|proof|inspection/gi },
  ],
  verticals: [
    { id: "medicare", label: "Medicare", match: /\bmedicare\b|\bmedicaid\b/gi, aliases: ["medicare_insurance"] },
    { id: "health_insurance", label: "Health insurance", match: /\binsurance\b|\bsupplement\b/gi },
    { id: "real_estate", label: "Real estate", match: /real estate|realtor|listing|we buy/gi },
    { id: "skincare", label: "Skincare", match: /skin|beauty|serum|hair/gi },
    { id: "roofing", label: "Roofing", match: /\broof/gi },
    { id: "hvac", label: "HVAC", match: /\bhvac\b|air condition|furnace|tune-up/gi },
    { id: "solar", label: "Solar", match: /\bsolar\b/gi },
    { id: "dental", label: "Dental", match: /\bdental\b|\bdentist\b/gi },
    { id: "plumbing", label: "Plumbing", match: /\bplumb|\bdrain\b/gi },
    { id: "pest_control", label: "Pest control", match: /\bpest\b|\bmosquito\b|\btick\b|\bant\b/gi, aliases: ["pest"] },
    { id: "landscaping", label: "Landscaping", match: /landscap|lawn|yard|cleanup/gi },
    { id: "restaurant", label: "Restaurant", match: /restaurant|supper|table|menu/gi },
    { id: "financial", label: "Financial", match: /mortgage|loan|financial|tax/gi },
    { id: "retail", label: "Retail", match: /\bretail\b|\bstore\b|\bshop\b/gi },
    { id: "home_services", label: "Home services", match: /home service|local service|cleanup/gi, aliases: ["general_local_service"] },
    { id: "general", label: "General", match: /(?!)/ },
  ],
  offerTypes: [
    { id: "enrollment_window", label: "Enrollment or deadline window", match: /\baep\b|open enrollment|annual enrollment|enrollment window|deadline window|\benroll/gi },
    { id: "free_consultation", label: "Free consultation", match: /free consultation|complimentary consult/gi },
    { id: "free_inspection", label: "Free inspection", match: /free inspection|\$0 inspection|no[- ]cost inspection|complimentary inspection/gi },
    { id: "percent_off", label: "Percent off", match: /\b\d+\s*%|%\s*off|\bpercent(?:age)?\s+off\b|\bpercent\s+offer\b/gi },
    { id: "dollar_off", label: "Dollar off", match: /\$\s?(?:[1-9]\d*)|\b\d+\s+dollars?\s+off\b|dollar off/gi },
    { id: "see_if_you_qualify", label: "See if you qualify", match: /see if you qualify|you may qualify|find out if you qualify|\bqualif/gi },
    { id: "free_quote", label: "Free quote", match: /free quote|free estimate|no[- ]cost estimate/gi },
    { id: "financing", label: "Financing", match: /\bfinanc|0%\s*apr|monthly payment|no interest/gi },
    { id: "bonus_gift", label: "Bonus or gift", match: /\bbonus\b|free gift|gift with|gift card/gi },
    { id: "cash_offer", label: "Cash offer", match: /cash offer|we buy|cash for your|get a cash/gi },
  ],
  copyPatterns: [
    { id: "deadline_warning", label: "Deadline warning", match: /\bdeadline\b|don't miss|do not miss|last day|last chance|before .+ ends|\bis coming\b/gi, template: "[Deadline] is coming. Don't lose [benefit]." },
    { id: "question_headline", label: "Question headline", match: /\?/g, template: "[Problem]?" },
    { id: "eligible_opener", label: "You may be eligible", match: /you may be eligible|you may qualify|see if you qualify|\beligib/gi, template: "You may be eligible for [benefit]." },
    { id: "benefit_checklist", label: "Benefit checklist", match: /benefit checklist|benefit grid|icon grid|\bchecklist\b|2\s*[×x]\s*2/gi, template: "[Benefit]. [Benefit]. [Benefit]." },
    { id: "proof_led", label: "Testimonial or proof-led", match: /testimonial|\breview\b|\bstars?\b|proof-led|as seen|customers say/gi, template: "[Proof]. Then [offer]." },
    { id: "problem_agitate_solve", label: "Problem-agitate-solve", match: /\bproblem\b|agitate|\bleak\b|\bdamage\b|\bworry\b|before it/gi, template: "[Problem]. It gets worse if you wait. [Offer] fixes it." },
    { id: "two_line_headline", label: "Two-line headline", match: /two-line|two line/gi, template: "[Problem]. [Offer]." },
    { id: "direct_offer", label: "Direct offer", match: /direct offer|offer-led|special offer/gi, template: "[Offer]. [Next step]." },
  ],
} as const

export type ToneTag = (typeof BLUEPRINT_TAG_CONFIG.tones)[number]["id"]
export type VerticalTag = (typeof BLUEPRINT_TAG_CONFIG.verticals)[number]["id"]
export type OfferType = (typeof BLUEPRINT_TAG_CONFIG.offerTypes)[number]["id"]
export type CopyPattern = (typeof BLUEPRINT_TAG_CONFIG.copyPatterns)[number]["id"]
export type TagKind = "tones" | "verticals" | "offerTypes" | "copyPatterns"
export type ProposedTagKind = "tone" | "vertical" | "offer_type" | "copy_pattern"

export interface ProposedTag {
  kind: ProposedTagKind
  tag: string
  reason: string
  /** An abstract slot template, only when a proposed copy pattern passed the word check. */
  template?: string
}

export interface OfferCopyTags {
  offerTypes: { tag: OfferType; confidence: number }[]
  copyPatterns: { tag: CopyPattern; confidence: number }[]
  /** Pattern used to write. Falls back to direct_offer when nothing matched. */
  copyPattern: CopyPattern
  /** Slot template from this file, or an accepted proposal. Never source wording. */
  copyTemplate: string
  proposedTags: ProposedTag[]
}

export const TONE_TAGS = BLUEPRINT_TAG_CONFIG.tones.map((rule) => rule.id) as readonly ToneTag[]
export const VERTICAL_TAGS = BLUEPRINT_TAG_CONFIG.verticals.map((rule) => rule.id) as readonly VerticalTag[]
export const OFFER_TYPES = BLUEPRINT_TAG_CONFIG.offerTypes.map((rule) => rule.id) as readonly OfferType[]
export const COPY_PATTERNS = BLUEPRINT_TAG_CONFIG.copyPatterns.map((rule) => rule.id) as readonly CopyPattern[]

const LEGACY_COPY: Record<string, CopyPattern> = {
  "problem-led": "problem_agitate_solve",
  question: "question_headline",
  "two-line-headline": "two_line_headline",
  "offer-led": "direct_offer",
  invitation: "eligible_opener",
}

const CONNECTIVES = new Set([
  "a", "an", "the", "is", "are", "coming", "dont", "don't", "lose", "then", "if", "you", "your",
  "wait", "for", "and", "or", "to", "of", "with", "get", "call", "today", "may", "be", "eligible",
  "it", "gets", "worse", "fixes", "this", "before", "after", "now", "one", "next", "step",
])

const NEEDS_REVIEW = "needs_review"

export function tagLabel(kind: TagKind, id: string): string {
  const rule = BLUEPRINT_TAG_CONFIG[kind].find((item) => item.id === id)
  return rule?.label ?? id.replaceAll("_", " ")
}

export function templateFor(id: string): string {
  const rule = BLUEPRINT_TAG_CONFIG.copyPatterns.find((item) => item.id === id)
  return rule?.template ?? BLUEPRINT_TAG_CONFIG.copyPatterns.find((item) => item.id === "direct_offer")!.template
}

export function matchTagRules<T extends string>(
  text: string,
  rules: readonly { id: T; match: RegExp }[],
): { tag: T; confidence: number }[] {
  const found: { tag: T; confidence: number }[] = []
  for (const rule of rules) {
    const flags = rule.match.flags.includes("g") ? rule.match.flags : `${rule.match.flags}g`
    const matches = text.match(new RegExp(rule.match.source, flags))
    if (!matches) continue
    found.push({ tag: rule.id, confidence: Math.min(0.95, 0.45 + (matches.length - 1) * 0.15) })
  }
  return found.sort((a, b) => b.confidence - a.confidence)
}

export function verticalFromAnalysis(value: string | undefined): VerticalTag | undefined {
  if (!value) return undefined
  const key = value.toLowerCase().replace(/[\s-]+/g, "_")
  for (const rule of BLUEPRINT_TAG_CONFIG.verticals) {
    if (rule.id === key) return rule.id
    const aliases = "aliases" in rule ? rule.aliases : undefined
    if (aliases?.some((alias) => alias === key)) return rule.id
  }
  return undefined
}

export function offerTypeFromText(text: string): OfferType | undefined {
  return matchTagRules(text, BLUEPRINT_TAG_CONFIG.offerTypes)[0]?.tag
}

export function copyPatternFromText(text: string): CopyPattern | undefined {
  return matchTagRules(text, BLUEPRINT_TAG_CONFIG.copyPatterns)[0]?.tag
}

export function normalizeOfferType(value: string | undefined): OfferType | undefined {
  if (!value?.trim()) return undefined
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_")
  if ((OFFER_TYPES as readonly string[]).includes(key)) return key as OfferType
  return offerTypeFromText(value)
}

export function normalizeCopyPattern(value: string | undefined): CopyPattern | undefined {
  if (!value?.trim()) return undefined
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_")
  const legacy = LEGACY_COPY[value.trim().toLowerCase()] ?? LEGACY_COPY[key]
  if (legacy) return legacy
  if ((COPY_PATTERNS as readonly string[]).includes(key)) return key as CopyPattern
  return copyPatternFromText(value)
}

export function classifyOfferAndCopy(text: string): OfferCopyTags {
  const offerTypes = matchTagRules(text, BLUEPRINT_TAG_CONFIG.offerTypes).slice(0, 4)
  const copyPatterns = matchTagRules(text, BLUEPRINT_TAG_CONFIG.copyPatterns).slice(0, 4)
  return finishTags(offerTypes, copyPatterns, [])
}

export function classifyVisionTags(input: {
  offerTypes: unknown
  copyPatterns: unknown
  copyPattern: unknown
  proposedTags: unknown
  sourcePhrases: readonly string[]
}): OfferCopyTags {
  const offerTypes = knownTags(input.offerTypes, OFFER_TYPES)
  const copyPatterns = knownTags(input.copyPatterns, COPY_PATTERNS)
  const single = normalizeCopyPattern(typeof input.copyPattern === "string" ? input.copyPattern : undefined)
  if (single && !copyPatterns.some((tag) => tag.tag === single)) {
    copyPatterns.unshift({ tag: single, confidence: 0.7 })
  }
  const proposed = [
    ...proposalsFromUnknown(input.offerTypes, "offer_type", OFFER_TYPES, input.sourcePhrases),
    ...proposalsFromUnknown(input.copyPatterns, "copy_pattern", COPY_PATTERNS, input.sourcePhrases),
    ...parseProposedTags(input.proposedTags, input.sourcePhrases),
  ]
  return finishTags(offerTypes.slice(0, 4), copyPatterns.slice(0, 4), proposed)
}

export function freshCopy(input: {
  template: string
  offerType?: string
  goal?: string
  offer?: string
  businessName?: string
}): { headline: string; subheadline?: string } {
  const offer = clean(input.offer) || "a clear next step"
  const slots: Record<string, string[]> = {
    deadline: [input.offerType === "enrollment_window" ? "Annual enrollment" : "The deadline"],
    benefit: benefitsFrom(offer),
    offer: [offer],
    problem: [problemFrom(input.goal, offer)],
    proof: [input.businessName?.trim() ? `${input.businessName.trim()} nearby` : "Neighbors nearby"],
    "next step": ["Call today"],
  }
  const filled = tidy(fillCopyTemplate(input.template || templateFor("direct_offer"), slots))
  const sentences = filled.split(/(?<=[.!?])\s+/).filter(Boolean)
  if (sentences.length >= 2 && (sentences[0]?.length ?? 0) <= 72) {
    return { headline: sentences[0], subheadline: sentences.slice(1).join(" ") }
  }
  return { headline: filled }
}

export function fillCopyTemplate(template: string, slots: Record<string, string[]>): string {
  const used: Record<string, number> = {}
  return template.replace(/\[([A-Za-z][A-Za-z ]*)\]/g, (raw, name: string) => {
    const key = name.trim().toLowerCase()
    const values = slots[key]
    if (!values || values.length === 0) return raw
    const index = used[key] ?? 0
    used[key] = index + 1
    if (index >= values.length) return ""
    return shape(values[index] ?? "", name)
  })
}

export function isAbstractTemplate(template: string): boolean {
  if (!/\[[A-Za-z][A-Za-z ]*\]/.test(template) || template.length > 160) return false
  const words = template.replace(/\[[^\]]+\]/g, " ").replace(/[^A-Za-z'\s]/g, " ").split(/\s+/).filter(Boolean)
  return words.every((word) => CONNECTIVES.has(word.toLowerCase()))
}

export function blueprintMatchLine(blueprint: {
  sourceId: string
  tone: string
  offerType?: string
  copyPattern?: string
}): string {
  const parts = [blueprint.sourceId, blueprint.tone]
  if (blueprint.offerType) parts.push(tagLabel("offerTypes", blueprint.offerType))
  if (blueprint.copyPattern) parts.push(tagLabel("copyPatterns", blueprint.copyPattern))
  return parts.join(" · ")
}

function finishTags(
  offerTypes: { tag: OfferType; confidence: number }[],
  copyPatterns: { tag: CopyPattern; confidence: number }[],
  proposedTags: ProposedTag[],
): OfferCopyTags {
  const proposed = dedupeProposed(proposedTags)
  if (offerTypes.length === 0 && !proposed.some((tag) => tag.kind === "offer_type")) {
    proposed.push({ kind: "offer_type", tag: NEEDS_REVIEW, reason: "No configured offer type matched." })
  }
  if (copyPatterns.length === 0 && !proposed.some((tag) => tag.kind === "copy_pattern")) {
    proposed.push({ kind: "copy_pattern", tag: NEEDS_REVIEW, reason: "No configured copy pattern matched." })
  }
  const copyPattern = copyPatterns[0]?.tag ?? "direct_offer"
  const proposedTemplate = proposed.find((tag) => tag.kind === "copy_pattern" && tag.template)?.template
  const copyTemplate = copyPatterns.length > 0 ? templateFor(copyPattern) : (proposedTemplate ?? templateFor("direct_offer"))
  return { offerTypes, copyPatterns, copyPattern, copyTemplate, proposedTags: proposed }
}

function knownTags<T extends string>(value: unknown, allowed: readonly T[]): { tag: T; confidence: number }[] {
  if (!Array.isArray(value)) return []
  const tags: { tag: T; confidence: number }[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as { tag?: unknown; confidence?: unknown }
    if (typeof row.tag !== "string" || !(allowed as readonly string[]).includes(row.tag)) continue
    tags.push({ tag: row.tag as T, confidence: clamp(row.confidence) })
  }
  return tags
}

function proposalsFromUnknown<T extends string>(
  value: unknown,
  kind: ProposedTagKind,
  allowed: readonly T[],
  phrases: readonly string[],
): ProposedTag[] {
  if (!Array.isArray(value)) return []
  const proposed: ProposedTag[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const tag = (item as { tag?: unknown }).tag
    if (typeof tag !== "string" || (allowed as readonly string[]).includes(tag)) continue
    const parsed = acceptProposal({ kind, tag, reason: "No configured tag fit." }, phrases)
    if (parsed) proposed.push(parsed)
  }
  return proposed
}

function parseProposedTags(value: unknown, phrases: readonly string[]): ProposedTag[] {
  if (!Array.isArray(value)) return []
  const proposed: ProposedTag[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as { kind?: unknown; tag?: unknown; reason?: unknown; template?: unknown }
    const kind = proposedKind(row.kind)
    if (!kind || typeof row.tag !== "string") continue
    const reason = typeof row.reason === "string" && row.reason.trim() && !repeatsSource(row.reason, phrases)
      ? clip(row.reason)
      : "No configured tag fit."
    const template = typeof row.template === "string" ? row.template : undefined
    const parsed = acceptProposal({ kind, tag: row.tag, reason, template }, phrases)
    if (parsed) proposed.push(parsed)
  }
  return proposed
}

function acceptProposal(input: ProposedTag, phrases: readonly string[]): ProposedTag | null {
  const tag = input.tag.trim().toLowerCase().replace(/[\s-]+/g, "_")
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(tag)) return null
  if (isKnownTag(input.kind, tag) || echoesSource(tag, phrases)) return null
  const template = input.kind === "copy_pattern" && input.template && isAbstractTemplate(input.template) && !repeatsSource(input.template, phrases)
    ? input.template.replace(/\s+/g, " ").trim()
    : undefined
  return { kind: input.kind, tag, reason: input.reason, template }
}

function isKnownTag(kind: ProposedTagKind, tag: string): boolean {
  if (kind === "tone") return (TONE_TAGS as readonly string[]).includes(tag)
  if (kind === "vertical") return (VERTICAL_TAGS as readonly string[]).includes(tag)
  if (kind === "offer_type") return (OFFER_TYPES as readonly string[]).includes(tag)
  return (COPY_PATTERNS as readonly string[]).includes(tag)
}

function proposedKind(value: unknown): ProposedTagKind | null {
  if (value === "tone" || value === "vertical" || value === "offer_type" || value === "copy_pattern") return value
  return null
}

function dedupeProposed(tags: ProposedTag[]): ProposedTag[] {
  const seen = new Set<string>()
  const unique: ProposedTag[] = []
  for (const tag of tags) {
    const key = `${tag.kind}:${tag.tag}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(tag)
  }
  return unique.slice(0, 8)
}

function echoesSource(tag: string, phrases: readonly string[]): boolean {
  const words = new Set(phrases.join(" ").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2))
  return tag.split("_").some((part) => part.length > 2 && words.has(part))
}

function repeatsSource(template: string, phrases: readonly string[]): boolean {
  const normalized = template.toLowerCase().replace(/\s+/g, " ")
  for (const phrase of phrases) {
    const clean = phrase.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
    if (clean.length >= 12 && normalized.includes(clean)) return true
    const words = clean.split(" ").filter((word) => word.length > 2)
    for (let index = 0; index <= words.length - 4; index += 1) {
      if (normalized.includes(words.slice(index, index + 4).join(" "))) return true
    }
  }
  return false
}

function benefitsFrom(offer: string): string[] {
  const parts = offer.split(/\s*(?:,|;|\band\b)\s*/i).map((part) => part.trim()).filter((part) => part.length > 1)
  return (parts.length > 1 ? parts : [offer]).slice(0, 3)
}

function problemFrom(goal: string | undefined, fallback: string): string {
  const text = (goal ?? "").replace(/\s+/g, " ").trim()
  if (!text) return fallback
  return text.split(" ").slice(0, 8).join(" ")
}

function shape(value: string, slot: string): string {
  const trimmed = value.trim()
  if (!/^[A-Z]/.test(slot.trim())) return trimmed
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([?.!,])/g, "$1")
    .replace(/([?.!])(?:\s*[?.!])+/g, "$1")
    .trim()
}

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function clip(value: string): string {
  const text = value.replace(/\s+/g, " ").trim()
  return text.length > 140 ? `${text.slice(0, 137)}...` : text
}

function clamp(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return 0.5
  return Math.min(1, Math.max(0, parsed))
}
