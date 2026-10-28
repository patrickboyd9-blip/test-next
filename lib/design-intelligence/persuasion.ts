/**
 * How a campaign uses the persuasion principles.
 * The art director picks two or three, one emotion, and one core need.
 * The copywriter keeps a sell-the-outcome version whatever the emotion.
 * The critic rejects false claims and a threat that has no easy action.
 */

import { headlinePasses, sameHeadline } from "@/lib/research-library/guard"
import type { CampaignBrief } from "@/lib/campaign-creator/types"

import { headlineCopiesCampaign, lessonFor, textHasAgencyResult, type DirectionRole } from "./ad-psych/lessons-data"
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
  /** Which psychology this direction is testing. */
  role: DirectionRole
  /** A client-safe lesson from the research. Never a slogan or a result figure. */
  lesson: string
  /** Two headlines to test. Markets do not agree on which one wins. */
  angles: Array<{ id: "A" | "B"; label: string; line: string; onCard?: boolean }>
  complianceWarnings: string[]
}

export interface PersuasionContext {
  brief: CampaignBrief
  vertical?: DesignVertical
  /** Set on the candidate board so the three directions do not share one psychology. */
  role?: DirectionRole
  blueprint?: {
    tone?: string
    offerType?: string
    copyPattern?: string
  }
}

export type { DirectionRole }

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
  hvac: "Cool the house before the heat hits.",
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
  insurance: "A quote you can read.",
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
  const resolved = input.role
    ? emotionForRole(kind, input.role, input.brief.primaryEmotion)
    : resolveEmotion(kind, facts, input.brief.primaryEmotion)
  const role = input.role ?? roleFromEmotion(resolved.emotion)
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
    role,
    lesson: lessonFor(kind, role),
    angles: input.role
      ? roleAngles(kind, input.role, input.brief.businessInfo?.name)
      : abAngles(kind, input.brief.offer ?? ""),
    complianceWarnings: attorneyWarnings(facts),
  }
}

/** Fear chosen by the client leads. The other two directions still use a different psychology. */
export function roleForDirection(index: number, clientEmotion?: string | null): DirectionRole {
  const fear = Boolean(clientEmotion && /fear/i.test(clientEmotion))
  const order: DirectionRole[] = fear ? ["threat", "outcome", "trust"] : ["outcome", "threat", "trust"]
  return order[((index % 3) + 3) % 3]!
}

export function outcomeGuidance(kind: string): string {
  return OUTCOME[kind] ?? OUTCOME.general!
}

const ROLE_COPY: Record<string, Record<DirectionRole, readonly [string, string]>> = {
  roofing: {
    outcome: ["A dry, safe home starts here", "The house stays dry after this"],
    threat: ["Call before a small leak spreads", "Book a look before damage spreads"],
    trust: ["A local crew checks this roof", "A named crew checks this roof"],
  },
  plumbing: {
    outcome: ["Water you can trust again", "The drain runs clear again"],
    threat: ["Call before a slow leak spreads", "Book a look before water spreads"],
    trust: ["A local plumber takes this call", "This plumber takes the call"],
  },
  hvac: {
    outcome: ["Cool the house before the heat hits", "Book the cool-down before the heat"],
    threat: ["Stay cool before the AC quits", "Call before the heat wins"],
    trust: ["Call a local tech before the heat", "A local tech keeps this house cool"],
  },
  medicare: {
    outcome: ["A plan you can check", "The choice can feel clear"],
    threat: ["Call about a coverage gap", "Call about another coverage gap"],
    trust: ["A local agent explains the plan", "This agent explains the plan"],
  },
  we_buy: {
    outcome: ["The sale can be simple", "A fresh start can be simple"],
    threat: ["Call before foreclosure costs grow", "Ask before those costs grow"],
    trust: ["A local buyer makes this offer", "This buyer makes the offer"],
  },
  real_estate: {
    outcome: ["The right house, shown clearly", "See the life in the house"],
    threat: ["Call before the right house goes", "Ask before that house is gone"],
    trust: ["A local showing, in daylight", "See this house in daylight"],
  },
  food: {
    outcome: ["A weeknight can feel special", "Tuesday can feel like an outing"],
    threat: ["Call before the weeknight is gone", "Save the table before Tuesday goes"],
    trust: ["This kitchen saves you a table", "A local table is waiting"],
  },
  retail: {
    outcome: ["The good buy, kept close", "The visit is the good part"],
    threat: ["Call before this offer ends", "Come in before the offer ends"],
    trust: ["A local shop holds this buy", "This shop holds the buy"],
  },
  dental: {
    outcome: ["A smile you can trust", "The visit can feel simple"],
    threat: ["Call before a small issue grows", "Book a visit before it grows"],
    trust: ["A local dentist answers this", "This dentist takes the question"],
  },
  pest: {
    outcome: ["A house that feels settled", "The kitchen can feel settled"],
    threat: ["Call before the infestation spreads", "Book a visit before it spreads"],
    trust: ["A local tech treats this house", "This tech treats the house"],
  },
  landscaping: {
    outcome: ["A yard you can enjoy", "The yard can look cared for"],
    threat: ["Call before the season is lost", "Book a cleanup before it shows"],
    trust: ["A local crew tends this yard", "This crew tends the yard"],
  },
  solar: {
    outcome: ["Quiet power is possible here", "The bill can be explained"],
    threat: ["Call about the climbing bill", "Ask before the bill climbs"],
    trust: ["A local review explains the bill", "This review explains the bill"],
  },
  legal: {
    outcome: ["A clear next step", "The next call can be simple"],
    threat: ["Call before waiting costs the claim", "Ask before the wait costs you"],
    trust: ["A calm talk about the claim", "A local talk about the claim"],
  },
  insurance: {
    outcome: ["A quote you can read", "The cost can be clear"],
    threat: ["Call before the renewal surprises you", "Ask before the bill changes"],
    trust: ["A local agent explains the quote", "This agent explains the quote"],
  },
  general: {
    outcome: ["The result you wanted", "This can be handled"],
    threat: ["Call before a small problem grows", "Book a look before it grows"],
    trust: ["A local crew takes the next step", "This crew takes the next step"],
  },
}

function roleFromEmotion(emotion: { id: string; fear: boolean }): DirectionRole {
  if (emotion.fear) return "threat"
  if (/trust/i.test(emotion.id)) return "trust"
  return "outcome"
}

function emotionForRole(kind: string, role: DirectionRole, chosenId?: string | null) {
  const options = emotionsFor(kind)
  const chosen = chosenId ? options.find((emotion) => emotion.id === chosenId) : undefined
  if (role === "threat") {
    const fear = options.find((emotion) => emotion.fear)
    const client = chosen?.fear ? chosen : undefined
    const fallback = options.find((emotion) => !emotion.recommend) ?? options[options.length - 1] ?? options[0]!
    return { emotion: client ?? fear ?? fallback, source: client ? "client" as const : "recommended" as const }
  }
  if (role === "trust") {
    const trust = options.find((emotion) => /trust/i.test(emotion.id)) ?? options.find((emotion) => !emotion.fear) ?? options[0]!
    const client = chosen && /trust/i.test(chosen.id) ? chosen : undefined
    return { emotion: client ?? trust, source: client ? "client" as const : "recommended" as const }
  }
  const outcome = options.find((emotion) => !emotion.fear && !/trust/i.test(emotion.id)) ?? options.find((emotion) => !emotion.fear) ?? options[0]!
  const client = chosen && !chosen.fear && !/trust/i.test(chosen.id) ? chosen : undefined
  return { emotion: client ?? outcome, source: client ? "client" as const : "recommended" as const }
}

function rolePair(kind: string, role: DirectionRole): readonly [string, string] {
  return (ROLE_COPY[kind] ?? ROLE_COPY.general)![role]
}

export function onCardLine(kind: string, role: DirectionRole): string {
  return finishLine(rolePair(kind, role)[0])
}

/**
 * The line that actually goes on one direction.
 * The psychology stays (result, risk, or the local name). The words follow
 * the offer and the city the client typed. No count and no deadline.
 */
export function headlineForRole(input: {
  kind: string
  role: DirectionRole
  offer: string
  goal?: string
  city?: string
  businessName?: string
}): string {
  if (input.role === "trust") {
    const named = namedTrustLine(input.kind, input.businessName, rolePair(input.kind, "trust")[0])
    if (input.businessName && named.split(/\s+/).length <= 8 && !/^a\b/i.test(named)) return finishLine(named)
    return onCardLine(input.kind, "trust")
  }
  if (input.role === "threat") return finishLine(threatLine(input.kind, `${input.offer} ${input.goal ?? ""}`))
  return finishLine(outcomeLine(input.kind, input.city))
}

function outcomeLine(kind: string, city?: string): string {
  const place = usableCity(city)
  if (kind === "roofing" && place) return `A dry, safe home in ${place}`
  return rolePair(kind, "outcome")[0]
}

function threatLine(kind: string, facts: string): string {
  if (kind === "roofing" && /storm|hail|wind/i.test(facts)) return "Call before the next storm"
  return rolePair(kind, "threat")[0]
}

function usableCity(city: string | undefined): string | null {
  const place = city?.replace(/\s+/g, " ").trim() ?? ""
  if (!place || place.split(/\s+/).length > 3) return null
  if (!/^[A-Za-z][A-Za-z .'-]*$/.test(place)) return null
  return place
}

function finishLine(line: string): string {
  const trimmed = line.replace(/\s+/g, " ").trim()
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function roleAngles(kind: string, role: DirectionRole, businessName?: string): PersuasionPlan["angles"] {
  const [primary, alternate] = rolePair(kind, role)
  const labels: Record<DirectionRole, readonly [string, string]> = {
    outcome: ["Outcome on the card", "Another outcome"],
    threat: ["Threat plus action", "Another threat plus action"],
    trust: ["Local trust", "Named crew"],
  }
  const second = role === "trust" ? namedTrustLine(kind, businessName, alternate) : alternate
  return [
    { id: "A", label: labels[role][0], line: finishLine(primary), onCard: true },
    { id: "B", label: labels[role][1], line: finishLine(second), onCard: false },
  ]
}

function namedTrustLine(kind: string, businessName: string | undefined, generic: string): string {
  const name = businessName?.replace(/\s+/g, " ").trim()
  if (!name) return generic
  const line = kind === "medicare"
    ? `${name} explains the plan`
    : kind === "legal"
      ? `${name} takes the call`
      : kind === "food"
        ? `${name} holds a table`
        : kind === "roofing"
          ? `${name} checks this roof`
          : generic
  return line.split(/\s+/).length <= 8 ? line : generic
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

export function persuasionAngles(rationale: unknown): Array<{ id: "A" | "B"; label: string; line: string; onCard?: boolean }> | null {
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

const WEAK_HEADLINE = /^(?:know your|know who)\b/i

/** The three roofing lines that landed on every card in Rounds 1 and 2. Never printed. */
export const STOCK_HEADLINE =
  /^(?:a dry,? safe home\b|call before a small leak spreads\b|.{1,80}\bchecks this\.?$|a local crew checks this roof\b|a named crew checks this roof\b|the house stays dry after this\b|book a look before damage spreads\b)/i

export function isStockHeadline(line: string): boolean {
  return STOCK_HEADLINE.test(line.replace(/\s+/g, " ").trim())
}

/**
 * A fallback headline built from this business's own offer and city, used only
 * when the copy AI's line is empty, weak, or one of the banned stock lines.
 * The offer itself is never rewritten here.
 */
export function specificHeadline(input: {
  offer: string
  role?: DirectionRole
  city?: string
  businessName?: string
  goal?: string
  variant?: number
}): string {
  const lines = headlineVariants(input)
  const index = input.variant ?? (input.role === "threat" ? 1 : input.role === "trust" ? 2 : 0)
  return lines[index % lines.length]!
}

/**
 * Four distinct fallback headlines for this offer. Only the business's own
 * offer and goal choose the set. The business name never does, so a name
 * like "... Roofing and Gutter Company" does not turn every card into a gutter card.
 */
export function headlineVariants(input: { offer: string; city?: string; goal?: string }): string[] {
  const offer = input.offer.replace(/\s+/g, " ").trim()
  const facts = `${offer} ${input.goal ?? ""}`
  const place = usableCity(input.city)
  const at = place ? ` in ${place}` : ""
  const pick = (lines: string[]) => lines.map((line) => finishLine(line))
  if (/\b(?:0%|financ|no payments?)/i.test(facts)) {
    // Financing never leads: it lives in the offer bar, so the roof does not feel like debt.
    return pick([`A new roof${at}, built for the next 30 years`, "Replace the worn roof before winter does", "A lasting roof, one estimate away", "Fix the roof right, the first time"])
  }
  if (/\bmetal\b/i.test(facts)) {
    return pick([`The last roof your ${place ? place + " " : ""}home will need`, "Tired of moss and leaks? Go metal", "Metal roofs, built for wet winters", "One metal roof. Fifty years of rain"])
  }
  if (/\bgutter/i.test(facts)) {
    return pick(["Roof checked, gutters cleared, one visit", "Clogged gutters rot roofs. Fix both", "Two jobs, one visit, no cost", `Ready for the rain${at}, top to gutter`])
  }
  if (/\b(?:hurricane|storm|hail|wind)\b/i.test(facts)) {
    // Our storm photos show an intact, sunny home, so the lines sell readiness, not damage.
    return pick([`Storm season is coming${at}. Is your roof ready?`, "Get your roof checked before storm season", "Know your roof before the next storm", "Did it hit your roof?"])
  }
  if (/\brepair\b/i.test(facts)) {
    return pick([`Leak or missing shingles${at}? Fix it for less`, "That small leak won't fix itself", "A repair now beats a roof later", "Fix the leak before it finds the ceiling"])
  }
  if (/\binspection\b|\bfree\b|\$\s*0\b/i.test(offer)) {
    return pick([`Is your${at ? " " + place : ""} roof ready for winter?`, "See what your roof is hiding", "A free look, no pressure, no pitch", "Ten minutes on your roof tells a lot"])
  }
  if (/\$\s?\d|%\s*off|\boff\b|\bdiscount\b/i.test(facts)) {
    return pick([`Your new roof${at}, for less`, "Real savings on a new roof", "A full new roof, priced to say yes", "Replace the roof, keep the savings"])
  }
  return pick([`A better roof${at}`, "Get your roof looked at this month", "Your roof, done right", "A roof you never think about"])
}

/**
 * One distinct headline per direction. A copy-AI headline is kept when it
 * passes every check and no earlier direction already uses it; otherwise the
 * next unused fallback for this offer fills in.
 */
/** Spare lines so one business never repeats a headline once its four variants are used. */
function extraHeadlines(input: { offer: string; city?: string }): string[] {
  const place = usableCity(input.city)
  const free = /\binspection\b|\bfree\b|\bcheck\b/i.test(input.offer)
  const lines = free
    ? [`A free roof check${place ? ` for ${place} homes` : ""}`, "Know where your roof stands, free", "One visit, a clear answer on your roof", "Find small roof problems while they are small"]
    : [`Roof work${place ? ` in ${place}` : ""}, priced to save`, "Save on the roof work you need", "Fix it once, pay less for it", "A better price on a lasting roof"]
  return lines.map((line) => finishLine(line))
}

/** A headline that leads with paying or financing. One per business at most. */
export const FINANCING_LED = /\bfinanc\w*|\bpay(?:ing)?\b|\bpaid\b|\bmonthly\b|\bbudget\b|\bpayments?\b|\binterest\b|\b0%/i

export function distinctRoofingHeadlines(input: {
  headlines: readonly string[]
  offer: string
  city?: string
  goal?: string
  businessName?: string
  taken?: readonly string[]
}): string[] {
  const used: string[] = [...(input.taken ?? [])]
  const fallbacks = headlineVariants(input)
  const ok = (line: string) =>
    Boolean(line) && !isStockHeadline(line) && !WEAK_HEADLINE.test(line) && !headlineRepeatsOffer(line, input.offer) &&
    headlinePasses({ headline: line, offer: input.offer, goal: input.goal, businessName: input.businessName }) &&
    !used.some((other) => sameHeadline(other, line)) &&
    !(FINANCING_LED.test(line) && used.some((other) => FINANCING_LED.test(other))) &&
    !(input.businessName && sameHeadline(line.replace(/[.!?]+$/, ""), input.businessName))
  return input.headlines.map((raw, index) => {
    const line = raw.replace(/\s+/g, " ").trim()
    const chosen = ok(line)
      ? line
      : [...fallbacks.slice(index), ...fallbacks.slice(0, index)].find(ok) ??
        extraHeadlines(input).find(ok) ??
        [...fallbacks, ...extraHeadlines(input)].find((item) => !used.some((other) => sameHeadline(other, item))) ?? fallbacks[index % fallbacks.length]!
    used.push(chosen)
    return chosen
  })
}

export function applyOutcomeHeadline(input: {
  headline: string
  offer: string
  brief: CampaignBrief
  vertical?: DesignVertical
  role?: DirectionRole
}): string {
  const headline = input.headline.replace(/\s+/g, " ").trim()
  const kind = persuasionVertical(input.brief, input.vertical)
  if (kind === "roofing") {
    return distinctRoofingHeadlines({
      headlines: [headline],
      offer: input.offer,
      city: input.brief.businessInfo?.city,
      goal: input.brief.goal,
      businessName: input.brief.businessInfo?.name,
    })[0]!
  }
  const roleLine = input.role
    ? headlineForRole({
        kind,
        role: input.role,
        offer: input.offer,
        goal: input.brief.goal,
        city: input.brief.businessInfo?.city,
        businessName: input.brief.businessInfo?.name,
      })
    : ""
  const outcomeLineForKind = onCardLine(kind, "outcome")
  const nameNearby = input.brief.businessInfo?.name
    ? sameHeadline(headline.replace(/[.!?]+$/, ""), `${input.brief.businessInfo.name} nearby`)
    : false
  const repeatsAnotherRole = Boolean(
    input.role && input.role !== "outcome" && sameHeadline(headline, outcomeLineForKind)
  )
  if (
    headline &&
    !nameNearby &&
    !repeatsAnotherRole &&
    !isStockHeadline(headline) &&
    !headlineIsFeature(headline, input.offer, kind) &&
    !headlineNeedsAReason(headline, kind) &&
    !WEAK_HEADLINE.test(headline)
  ) return headline
  if (roleLine) return roleLine
  if (input.brief.audienceAwareness === "past_customer" && headlineIsFeature(headline, input.offer, kind)) {
    const resolved = resolveEmotion(kind, clientFactText(input.brief), input.brief.primaryEmotion)
    return headlineFor({ emotion: resolved.emotion, awareness: input.brief.audienceAwareness, offer: input.offer })
  }
  if (kind === "roofing") {
    return specificHeadline({
      offer: input.offer,
      role: input.role,
      city: input.brief.businessInfo?.city,
      businessName: input.brief.businessInfo?.name,
      goal: input.brief.goal,
    })
  }
  const resolved = resolveEmotion(kind, clientFactText(input.brief), input.brief.primaryEmotion)
  return onCardLine(kind, resolved.emotion.fear ? "threat" : "outcome")
}

export interface PersuasionFinding {
  id: "benefit" | "standout" | "urgency" | "invented" | "efficacy" | "placeholder" | "scarcity" | "medicare_free" | "testimonial" | "false_personal" | "fair_housing" | "fake_check" | "government" | "copied_line" | "agency_result"
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
    {
      id: "copied_line",
      ok: !headlineCopiesCampaign(headline),
      detail: headlineCopiesCampaign(headline) ? "The headline copies a campaign line from the research." : "The headline is not a research slogan.",
    },
    {
      id: "agency_result",
      ok: !textHasAgencyResult(copy),
      detail: textHasAgencyResult(copy) ? "An agency result figure is on the card." : "No agency result figure.",
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

/** Auto, home, and life insurance are not Medicare, even when the design vertical is shared. */
export function isNonMedicareInsurance(text: string): boolean {
  if (/\bmedicare\b|\bmedicaid\b|\bmedigap\b/i.test(text)) return false
  return /\b(?:auto|car|vehicle|homeowners|home|life)\s+insurance\b/i.test(text)
}

export function persuasionVertical(brief: CampaignBrief, vertical?: DesignVertical): string {
  const text = clientFactText(brief)
  if (isAttorneyMatter(text)) return "legal"
  if (isNonMedicareInsurance(text)) return "insurance"
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

/** A description of the result, with no benefit and no reason to call. */
function headlineNeedsAReason(headline: string, kind: string): boolean {
  if (kind !== "hvac") return false
  const benefit = /\b(?:cool|heat|house|home|comfort)\b/i.test(headline)
  const reason = /\b(?:call|book|before)\b/i.test(headline)
  if (benefit && reason) return false
  return /\b(?:cools down|should cool|stays cool|tune-up before|the house cools|ac quits|before it breaks|checks the ac|checks the system)\b/i.test(headline)
}

function headlineIsFeature(headline: string, offer: string, kind: string): boolean {
  if (outcomeAlready(headline, kind)) return false
  if (headlineRepeatsOffer(headline, offer)) return true
  if (/^(?:a\s+)?free\b/i.test(headline)) return true
  if (kind === "insurance" && /\b(?:quote|estimate)\b/i.test(headline) && !/\b(?:inspection|tune-?up|treatment|cleanup|check)\b/i.test(headline)) return false
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


/** A headline that sells a storm or hail angle. */
export const STORM_HEADLINE = /\bstorms?\b|\bhail\b|\bhurricane|\bdamage\w*|\bhit (?:your|the) roof\b|\bwind\b/i
/** A photo brief that asks for visible storm damage. */
export const DAMAGE_SCENE = /\b(?:visible|clear)\b[^.]*\bdamage\b|\bmissing shingles\b|\blifted shingles\b|\btarp\w*\b|\bstorm debris\b/i
export const STORM_DAMAGE_PHOTO = "Visible storm damage on a real home: missing and lifted shingles, a blue tarp on part of the roof, scattered storm debris in the yard, overcast sky clearing; a roofer inspecting from a ladder"

const NON_STORM = ["Know where your roof stands, free", "One visit, a clear answer on your roof", "Find small roof problems while they are small", "A free roof check this season"]

/**
 * A storm headline runs only over a photo that shows storm damage. The storm (threat)
 * direction keeps its storm line and gets a damage photo brief; any other direction whose
 * photo is not a damage scene moves to a non-storm angle.
 */
export function alignStormHeadlines<T extends { headline?: string; visualDirection?: string }>(specs: Array<{ spec?: T; role?: string }>): void {
  const used = new Set(specs.map((d) => (d.spec?.headline ?? "").toLowerCase()))
  let stormKept = false
  const order = [...specs].sort((a, b) => Number(b.role === "threat") - Number(a.role === "threat"))
  for (const d of order) {
    const spec = d.spec
    if (!spec?.headline || !STORM_HEADLINE.test(spec.headline)) continue
    if (DAMAGE_SCENE.test(spec.visualDirection ?? "")) { stormKept = true; continue }
    if (!stormKept && d.role === "threat") {
      d.spec = { ...spec, visualDirection: `${STORM_DAMAGE_PHOTO}. ${spec.visualDirection ?? ""}`.trim() }
      stormKept = true
      continue
    }
    const next = NON_STORM.find((line) => !used.has(line.toLowerCase())) ?? NON_STORM[0]!
    used.add(next.toLowerCase())
    d.spec = { ...spec, headline: next }
  }
}
