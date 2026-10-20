/**
 * How a campaign uses the persuasion principles.
 * The art director picks two or three, one emotion, and one core need.
 * The copywriter keeps a sell-the-outcome version whatever the emotion.
 * The critic rejects false claims and a threat that has no easy action.
 */

import type { CampaignBrief } from "@/lib/campaign-creator/types"

import { attorneyWarnings, isAttorneyMatter } from "./attorney-compliance"
import {
  coreNeed,
  emotionsFor,
  headlineFor,
  resolveAwareness,
  resolveEmotion,
  type CampaignEmotion,
} from "./persuasion-emotions"
import { headlineRepeatsOffer } from "./offer-copy"
import {
  persuasionPrinciple,
  PERSUASION_PRINCIPLES,
  type PersuasionPrinciple,
  type PersuasionTone,
  type PersuasionVertical,
} from "./persuasion-principles"
import type { DesignVertical } from "./rationale"

export interface PersuasionPick {
  id: string
  why: string
}

export interface PersuasionPlan {
  picks: PersuasionPick[]
  line: string
  primaryEmotion: { id: string; label: string; source: "client" | "recommended" }
  coreNeed: { id: string; label: string }
  awareness: { id: string; label: string }
  outcomeGuidance: string
  /** Two headlines to test. Markets do not agree on which one wins. */
  angles: Array<{ id: "A" | "B"; label: string; line: string }>
  complianceWarnings: string[]
}

export interface PersuasionContext {
  brief: CampaignBrief
  vertical?: DesignVertical
  blueprint?: {
    tone?: string
    offerType?: string
    copyPattern?: string
  }
}

const DATE = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:,\s*\d{4})?\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/i
const CLAIM = /\b(\d[\d,]*)\s*(%|percent|neighbors|homes|customers|families|reviews|years|households|stars)\b/gi
const SOFT_CLAIM = /\b(?:over|more than|nearly|almost)\s+(\d[\d,]*)\b/gi
const URGENCY_WORDS = /\b(?:act now|limited time|today only|expires soon|hurry|while supplies last|last chance|don'?t wait|hours only|final hours)\b/i
const SCARCITY_WORDS = /\b(?:only\s+\d+\s+(?:left|spots?|slots?|seats?)|while supplies last|limited quantities|today only)\b/i
const THREAT = /\b(?:leak(?:s|ing)?|water damage|storm damage|wind damage|foreclos\w*|coverage gap|collapse|disaster|nightmare|ruin(?:ed)?|too late|infestation|breakdown|flood(?:ing)?|mold)\b/i
const EASY_ACTION = /\b(?:call|scan|text|book|visit|tap)\b|\bfree (?:inspection|quote|estimate|review|check)\b|\$\s*0\b|\binspection\b|\(\d{3}\)|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/i
const FAKE_CHECK = /\b(?:pay to the order of|this is a check|treasury check|government check|stimulus check|non-negotiable instrument)\b/i
const FAIR_HOUSING = /\b(?:whites only|blacks only|no children|no kids|adults only|christian neighborhood|exclusive neighborhood|changing neighborhood|the right kind of people|no section 8)\b/i
const UNSUPPLIED_PERSON = /\bwe know you(?:'re| are)\b|\byour (?:illness|diagnosis|foreclosure|income)\b|\bbehind on (?:payments|rent)\b/i
const PLACEHOLDER = /\b(?:lorem ipsum|lorem|tbd|xxx+|\[(?:address|name|phone|date|number)\]|123 main(?: street)?)\b/i
const GOVERNMENT = /\bofficial notice\b|\bfinal notice\b|\bofficial business\b|\bgreat seal\b|\beagle\b/i

const OUTCOME: Record<string, string> = {
  roofing: "A safe, dry home.",
  plumbing: "Water you can trust.",
  hvac: "A house that feels right.",
  we_buy: "A fresh start.",
  real_estate: "The right house, clearly.",
  medicare: "Confidence in the choice.",
  food: "A night worth remembering.",
  retail: "The good buy, kept.",
  dental: "A smile you trust.",
  pest: "A house that feels settled.",
  landscaping: "A yard you enjoy.",
  solar: "Power that stays quiet.",
  legal: "A clear next step.",
  general: "The result you wanted.",
}

export function selectPersuasion(input: PersuasionContext): PersuasionPlan {
  const facts = clientFactText(input.brief)
  const kind = persuasionVertical(input.brief, input.vertical)
  const tone = normalizeTone(input.brief.emotionalTone ?? input.blueprint?.tone ?? "")
  const freeGive = /\bfree\b|\$\s*0\b|\bvaluation\b|\bcomplimentary\b/i.test(facts)
  const medicare = kind === "medicare" || input.vertical === "medicare_insurance"
  const realDate = DATE.test(facts)
  const canLose = !freeGive && (/\benroll|\byour current coverage\b|\byour plan\b/i.test(facts) || input.blueprint?.offerType === "enrollment_window")
  const flags = {
    kind,
    tone,
    medicare,
    freeGive,
    realDate,
    canLose,
    realCount: /\b\d+\s+(?:neighbors|homes|customers|families|reviews|years|households)\b/i.test(facts),
    trueCredential: /\b(?:licensed|license|certified|certification)\b/i.test(facts) || /\b\d+\s+years\b/i.test(facts),
    genuineScarcity: /\bonly\s+\d+\s+(?:left|spots?|slots?|seats?|openings?)\b/i.test(facts),
    reserved: /\breserved for\b/i.test(facts) || /\b\d{1,6}\s+[A-Za-z]+\s+(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd)\b/i.test(facts),
    geography: /\b(?:neighborhood|neighbours|neighbors|zip code|local|city|street)\b/i.test(facts),
    question: /\?/.test(facts) || input.blueprint?.copyPattern === "question_headline",
    smallStep: /\b(?:scan|storm map|quiz|checklist)\b/i.test(facts),
    tiers: /\b(?:tiers?|plans|options)\b/i.test(facts),
    priceEnding: /\b\d*99\b/.test(input.brief.offer ?? "") || /\$\s?\d+\s*off|\d+\s*%/i.test(facts),
    offerType: input.blueprint?.offerType ?? "",
    copyPattern: input.blueprint?.copyPattern ?? "",
  }

  const ranked = PERSUASION_PRINCIPLES
    .filter((principle) => principle.id !== "sell_the_outcome" && allowed(principle.id, flags))
    .map((principle) => ({ principle, score: scorePrinciple(principle, flags) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.principle.id.localeCompare(b.principle.id))

  const chosen = [must("sell_the_outcome"), ...ranked.slice(0, 2).map((item) => item.principle)]
  const resolved = resolveEmotion(kind, facts, input.brief.primaryEmotion)
  const awareness = resolveAwareness(input.brief.audienceAwareness)
  const need = coreNeed(resolved.emotion.need)
  const picks = chosen.map((principle) => ({ id: principle.id, why: whyFor(principle.id, { ...flags, emotion: resolved.emotion }) }))
  return {
    picks,
    line: usesLine(picks.map((pick) => pick.id)),
    primaryEmotion: { id: resolved.emotion.id, label: resolved.emotion.label, source: resolved.source },
    coreNeed: { id: need.id, label: need.label },
    awareness: { id: awareness.id, label: awareness.label },
    outcomeGuidance: outcomeGuidance(kind),
    angles: abAngles(kind, input.brief.offer ?? ""),
    complianceWarnings: attorneyWarnings(facts),
  }
}

export function outcomeGuidance(kind: string): string {
  return OUTCOME[kind] ?? OUTCOME.general!
}

function abAngles(kind: string, offer: string): PersuasionPlan["angles"] {
  const fear = emotionsFor(kind).find((emotion) => emotion.fear)
  const threat = (fear?.problem ?? "A small problem gets larger.").replace(/\.+$/, "")
  return [
    { id: "A", label: "Outcome / benefit", line: outcomeGuidance(kind) },
    { id: "B", label: "Threat plus action", line: `${threat}. ${actionFor(offer)}` },
  ]
}

function actionFor(offer: string): string {
  if (/\binspection\b|\bcheck\b/i.test(offer)) return "Call for the inspection."
  if (/\bscan\b|\bmap\b/i.test(offer)) return "Scan to see it."
  if (/\bfree\b|\$\s*0/i.test(offer)) return "Call for the free step."
  const short = offer.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).slice(0, 4).join(" ")
  return short ? `Call about ${short}.` : "Call or scan."
}

export function usesLine(ids: readonly string[]): string {
  const labels = ids.map((id) => persuasionPrinciple(id)?.label ?? id)
  return `Uses: ${labels.join(", ")}`
}

export function persuasionUsesLine(rationale: unknown): string | null {
  if (!rationale || typeof rationale !== "object") return null
  const line = (rationale as { persuasion?: { line?: unknown } }).persuasion?.line
  return typeof line === "string" && line.startsWith("Uses:") ? line : null
}

export function persuasionRecordLine(rationale: unknown): string | null {
  if (!rationale || typeof rationale !== "object") return null
  const persuasion = (rationale as { persuasion?: PersuasionPlan }).persuasion
  if (!persuasion?.primaryEmotion || !persuasion.coreNeed || !persuasion.awareness || !persuasion.outcomeGuidance) return null
  const source = persuasion.primaryEmotion.source === "client" ? "chosen" : "recommended"
  const lead = persuasion.awareness.id === "past_customer"
    ? "so this leads with the offer"
    : persuasion.awareness.id === "solution_aware"
      ? "so this leads with the kind of fix"
      : persuasion.awareness.id === "product_aware"
        ? "so this leads with the company"
        : "so this leads with the problem"
  return `Emotion: ${persuasion.primaryEmotion.label} (${source}). Need: ${persuasion.coreNeed.label}. Audience: ${persuasion.awareness.label}, ${lead}. Outcome version: ${persuasion.outcomeGuidance}`
}

export function persuasionAngles(rationale: unknown): Array<{ id: "A" | "B"; label: string; line: string }> | null {
  if (!rationale || typeof rationale !== "object") return null
  const angles = (rationale as { persuasion?: PersuasionPlan }).persuasion?.angles
  if (!angles || angles.length < 2) return null
  return angles
}

export function persuasionWarnings(rationale: unknown): string[] {
  if (!rationale || typeof rationale !== "object") return []
  const warnings = (rationale as { persuasion?: PersuasionPlan }).persuasion?.complianceWarnings
  return Array.isArray(warnings) ? warnings.filter((warning) => typeof warning === "string" && warning.trim()) : []
}

export function applyOutcomeHeadline(input: {
  headline: string
  offer: string
  brief: CampaignBrief
  vertical?: DesignVertical
}): string {
  const headline = input.headline.replace(/\s+/g, " ").trim()
  const kind = persuasionVertical(input.brief, input.vertical)
  if (headline && !headlineIsFeature(headline, input.offer, kind)) return headline
  const resolved = resolveEmotion(kind, clientFactText(input.brief), input.brief.primaryEmotion)
  return headlineFor({
    emotion: resolved.emotion,
    awareness: input.brief.audienceAwareness,
    offer: input.offer,
  })
}

export interface PersuasionFinding {
  id: "benefit" | "standout" | "urgency" | "invented" | "efficacy" | "placeholder" | "scarcity" | "medicare_free" | "testimonial" | "false_personal" | "fair_housing" | "fake_check" | "government"
  ok: boolean
  detail: string
}

export function checkPersuasion(input: {
  headline: string
  copy: string
  clientText: string
  vertical: string
  standoutCount: number
}): PersuasionFinding[] {
  const headline = input.headline.replace(/\s+/g, " ").trim()
  const copy = input.copy.replace(/\s+/g, " ").trim()
  const client = input.clientText.replace(/\s+/g, " ").trim()
  const words = headline.split(/\s+/).filter(Boolean)
  const benefitOk = words.length >= 2 && words.length <= 8 && !/^(?:act now|call today|don'?t wait)[.!]?$/i.test(headline)
  const findings: PersuasionFinding[] = [
    {
      id: "benefit",
      ok: benefitOk,
      detail: benefitOk ? "The benefit is readable at a glance." : "The benefit is not clear in a glance.",
    },
    {
      id: "standout",
      ok: input.standoutCount <= 1,
      detail: input.standoutCount <= 1 ? "One element stands out." : "More than one element is trying to stand out.",
    },
    urgencyFinding(copy, client),
    inventedFinding(copy, client),
    efficacyFinding(copy),
    {
      id: "placeholder",
      ok: !PLACEHOLDER.test(copy),
      detail: PLACEHOLDER.test(copy) ? "A placeholder is printed as if it were a fact." : "No placeholder number.",
    },
    scarcityFinding(copy, client),
    {
      id: "medicare_free",
      ok: input.vertical !== "medicare_insurance" || !/\bfree\b/i.test(copy),
      detail: input.vertical === "medicare_insurance" && /\bfree\b/i.test(copy)
        ? "Medicare must not say free for a $0 premium."
        : "Medicare does not say free.",
    },
    testimonialFinding(copy, client),
    falsePersonalFinding(copy, client),
    fairHousingFinding(copy, input.vertical),
    {
      id: "fake_check",
      ok: !FAKE_CHECK.test(copy),
      detail: FAKE_CHECK.test(copy) ? "The card looks like a check." : "No fake check.",
    },
    {
      id: "government",
      ok: !GOVERNMENT.test(copy),
      detail: GOVERNMENT.test(copy) ? "The card mimics a government notice." : "No government costume.",
    },
  ]
  return findings
}

export function clientFactText(brief: CampaignBrief, extra?: string): string {
  return [
    brief.goal,
    brief.offer,
    brief.audience?.description,
    brief.businessInfo?.name,
    brief.emotionalTone,
    brief.otherRequirements,
    brief.desiredRecipientAction,
    extra,
  ].filter((value): value is string => Boolean(value?.trim())).join(" ")
}

export function persuasionVertical(brief: CampaignBrief, vertical?: DesignVertical): string {
  const text = clientFactText(brief)
  if (isAttorneyMatter(text)) return "legal"
  if (vertical === "medicare_insurance" || /\bmedicare\b|\bmedicaid\b|\bsupplement\b/i.test(text)) return "medicare"
  if (/\bwe buy\b|\brather sell\b|\bsell (?:the|your) house\b/i.test(text)) return "we_buy"
  if (/\brestaurant\b|\bsupper\b|\bmenu\b|\bdining\b|\bfood\b/i.test(text)) return "food"
  if (/\bcoupon\b|\bretail\b/i.test(text)) return "retail"
  if (/\bsolar\b/i.test(text)) return "solar"
  if (vertical === "roofing" || /\broof(?:ing|er)?\b|\bshingle\b/i.test(text)) return "roofing"
  if (vertical === "plumbing" || /\bplumb|drain\b/i.test(text)) return "plumbing"
  if (vertical === "hvac" || /\bhvac\b|\btune-?up\b|\bair condition/i.test(text)) return "hvac"
  if (vertical === "real_estate") return "real_estate"
  if (/\bdental|dentist\b/i.test(text)) return "dental"
  if (/\bpest\b|\bants\b/i.test(text)) return "pest"
  if (/\blandscap|yard\b/i.test(text)) return "landscaping"
  return "general"
}

function headlineIsFeature(headline: string, offer: string, kind: string): boolean {
  if (outcomeAlready(headline, kind)) return false
  if (headlineRepeatsOffer(headline, offer)) return true
  if (/^(?:a\s+)?free\b/i.test(headline)) return true
  if (/\b(?:inspection|tune-?up|treatment|cleanup|check|quote|estimate)\b/i.test(headline)) return true
  if (kind === "we_buy" && /\bsell (?:the|your) house\b/i.test(headline)) return true
  if (kind === "dental" && /\bvisit\b/i.test(headline)) return true
  return false
}

function outcomeAlready(headline: string, kind: string): boolean {
  const line = OUTCOME[kind]
  if (!line) return false
  return headline.toLowerCase() === line.toLowerCase()
}

function allowed(id: string, flags: Flags): boolean {
  if (id === "scarcity") return flags.genuineScarcity
  if (id === "loss_framing") return flags.canLose && !flags.freeGive
  if (id === "social_proof") return flags.realCount
  if (id === "authority") return flags.trueCredential
  if (id === "urgency") return flags.realDate
  if (id === "endowment") return flags.reserved
  if (id === "personalization") return flags.geography
  if (id === "reciprocity") return flags.freeGive && !flags.medicare
  if (flags.medicare && (id === "scarcity" || id === "reciprocity")) return false
  return true
}

function scorePrinciple(principle: PersuasionPrinciple, flags: Flags): number {
  let score = principle.verticals.includes(flags.kind as PersuasionVertical) ? 3 : 0
  if (flags.tone && principle.tones.includes(flags.tone)) score += 2
  if (principle.evidence === "strong") score += 2
  else if (principle.evidence === "mixed" || principle.evidence === "mixed-test") score += 1
  if (principle.id === "isolation_effect") score += 3
  if (principle.id === "attention_capture") score += 1
  if (principle.id === "reciprocity" && flags.freeGive) score += 4
  if (principle.id === "urgency" && flags.realDate) score += 5
  if (principle.id === "emotion_by_vertical" && ["roofing", "we_buy", "medicare", "food", "retail"].includes(flags.kind)) score += 3
  if (principle.id === "commitment" && flags.question) score += 2
  if (principle.id === "specificity" && flags.priceEnding) score += 2
  if (principle.id === "contrast" && flags.medicare) score += 2
  if (principle.id === "foot_in_the_door" && flags.smallStep) score += 2
  if (principle.id === "choice_architecture" && flags.tiers) score += 2
  if (principle.id === "curiosity_gap" && (flags.question || flags.copyPattern === "question_headline")) score += 1
  if ((flags.offerType === "dollar_off" || flags.offerType === "percent_off") && (principle.id === "isolation_effect" || principle.id === "specificity")) {
    score += 2
  }
  return score
}

function whyFor(id: string, flags: Flags & { emotion: CampaignEmotion }): string {
  if (id === "sell_the_outcome") return `The headline sells the result for ${flags.kind.replaceAll("_", " ")}, not the service feature.`
  if (id === "isolation_effect") return "One offer is the only element that should look different."
  if (id === "reciprocity") return "The brief gives something before it asks, so the card can lead with that gift."
  if (id === "urgency") return "The brief names a real date, so the deadline can be that date."
  if (id === "emotion_by_vertical") return `The card uses one emotion, ${flags.emotion.label}, and one need, ${coreNeed(flags.emotion.need).label}.`
  if (id === "attention_capture") return "One photograph and one headline are enough to stop the reader."
  if (id === "commitment") return "A small yes-question fits this brief better than a demand."
  if (id === "specificity") return "The price or claim is one the client already stated."
  if (id === "contrast") return "The action needs to be the high-contrast element, in large type."
  if (id === "social_proof") return "The brief includes a real count, so that count may be used."
  if (id === "authority") return "The brief states a credential, so one credential line is enough."
  if (id === "personalization") return "The mail can name the neighborhood the client named."
  if (id === "loss_framing") return "The reader can lose something they already have, so loss framing can be tested against a gain."
  if (id === "foot_in_the_door") return "The first ask is a small step, not the whole job."
  const principle = persuasionPrinciple(id)
  return principle ? principle.postcard : "This principle fits the brief."
}

function efficacyFinding(copy: string): PersuasionFinding {
  const threat = THREAT.test(copy)
  const action = EASY_ACTION.test(copy)
  const ok = !threat || action
  return {
    id: "efficacy",
    ok,
    detail: ok ? "A threat is paired with an easy action, or there is no threat." : "The threat has no call, scan, or free inspection.",
  }
}

function testimonialFinding(copy: string, client: string): PersuasionFinding {
  const quotes = [...copy.matchAll(/[“"]([^”"]{8,})[”"]/g)].map((match) => match[1] ?? "")
  const missing = quotes.filter((quote) => !client.toLowerCase().includes(quote.toLowerCase()))
  const marked = /\b(?:testimonial|customer said|homeowner said|five stars)\b/i.test(copy)
  const supplied = /\b(?:testimonial|said|review)\b/i.test(client)
  const ok = missing.length === 0 && (!marked || supplied)
  return {
    id: "testimonial",
    ok,
    detail: ok ? "No unsupplied testimonial." : "The card quotes someone the client did not supply.",
  }
}

function falsePersonalFinding(copy: string, client: string): PersuasionFinding {
  const match = copy.match(UNSUPPLIED_PERSON)
  const ok = !match || client.toLowerCase().includes(match[0].toLowerCase())
  return {
    id: "false_personal",
    ok,
    detail: ok ? "No unsupplied fact about this person." : "The card states a personal fact the client did not supply.",
  }
}

function fairHousingFinding(copy: string, vertical: string): PersuasionFinding {
  const housing = vertical === "real_estate" || vertical === "we_buy"
  const ok = !housing || !FAIR_HOUSING.test(copy)
  return {
    id: "fair_housing",
    ok,
    detail: ok ? "No steering or discriminatory line." : "The housing line steers or discriminates.",
  }
}

function urgencyFinding(copy: string, client: string): PersuasionFinding {
  const pushed = URGENCY_WORDS.test(copy)
  const dated = datesIn(copy)
  const inventedDate = dated.some((date) => !client.toLowerCase().includes(date.toLowerCase()))
  const ok = !inventedDate && (!pushed || DATE.test(client))
  return {
    id: "urgency",
    ok,
    detail: ok ? "Urgency is a real date, or it is absent." : "The urgency is not a real date from the client.",
  }
}

function scarcityFinding(copy: string, client: string): PersuasionFinding {
  const match = copy.match(SCARCITY_WORDS)
  if (!match) return { id: "scarcity", ok: true, detail: "No scarcity claim." }
  const number = match[0].match(/\d+/)
  const ok = number ? client.includes(number[0]) : client.toLowerCase().includes(match[0].toLowerCase())
  return {
    id: "scarcity",
    ok,
    detail: ok ? "The limit is one the client stated." : "The scarcity is not genuine.",
  }
}

function inventedFinding(copy: string, client: string): PersuasionFinding {
  const numbers = [...claimedNumbers(copy)]
  const missing = numbers.filter((number) => !client.includes(number))
  return {
    id: "invented",
    ok: missing.length === 0,
    detail: missing.length === 0 ? "Every count is in the brief." : `The card states ${missing.join(", ")} and the client did not.`,
  }
}

function* claimedNumbers(copy: string): Generator<string> {
  for (const match of copy.matchAll(new RegExp(CLAIM.source, "gi"))) yield digits(match[1] ?? "")
  for (const match of copy.matchAll(new RegExp(SOFT_CLAIM.source, "gi"))) yield digits(match[1] ?? "")
}

function datesIn(copy: string): string[] {
  return copy.match(new RegExp(DATE.source, "gi")) ?? []
}

function digits(value: string): string {
  return value.replace(/,/g, "")
}

function normalizeTone(value: string): PersuasionTone | null {
  const text = value.toLowerCase()
  if (/urgent|fear/.test(text)) return "urgent"
  if (/calm|compliance/.test(text)) return "calm"
  if (/playful|joy/.test(text)) return "playful"
  if (/empath/.test(text)) return "empathetic"
  if (/appetite|luxury|supper/.test(text)) return "appetite"
  if (/friend/.test(text)) return "friendly"
  if (/professional/.test(text)) return "professional"
  return null
}

function must(id: string): PersuasionPrinciple {
  const principle = persuasionPrinciple(id)
  if (!principle) throw new Error(`Missing persuasion principle ${id}.`)
  return principle
}

interface Flags {
  kind: string
  tone: PersuasionTone | null
  medicare: boolean
  freeGive: boolean
  realDate: boolean
  canLose: boolean
  realCount: boolean
  trueCredential: boolean
  genuineScarcity: boolean
  reserved: boolean
  geography: boolean
  question: boolean
  smallStep: boolean
  tiers: boolean
  priceEnding: boolean
  offerType: string
  copyPattern: string
}
