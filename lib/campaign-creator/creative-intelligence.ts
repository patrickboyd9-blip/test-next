import { PLAYBOOKS, findIndustryPlaybook } from "../campaign-strategy/playbooks"
import type { CampaignBrief } from "./types"

/**
 * Non-persisted, campaign-local knowledge pack for the Creative Engine.
 * Not CampaignStrategy. Not evidence. Not a Campaign field.
 */
export interface CreativeIntelligenceContext {
  principles: readonly CreativePrinciple[]
}

export const CREATIVE_PRINCIPLE_KINDS = [
  "heuristic",
  "observed_pattern",
  "unknown",
] as const

export type CreativePrincipleKind = (typeof CREATIVE_PRINCIPLE_KINDS)[number]

export const CREATIVE_PRINCIPLE_APPLIES_TO = [
  "offer",
  "urgency",
  "trust",
  "imagery",
  "cta",
  "hierarchy",
] as const

export type CreativePrincipleAppliesTo =
  (typeof CREATIVE_PRINCIPLE_APPLIES_TO)[number]

export interface CreativePrinciple {
  id: string
  statement: string
  kind: CreativePrincipleKind
  verticalCluster?: string
  appliesTo?: readonly CreativePrincipleAppliesTo[]
}

/**
 * Creative-relevant general direct-mail principles.
 * Heuristics only — not measured outcomes.
 */
export const CREATIVE_DIRECT_MAIL_PRINCIPLES: readonly CreativePrinciple[] = [
  {
    id: "dm-one-objective",
    kind: "heuristic",
    appliesTo: ["cta", "hierarchy"],
    statement:
      "Give the mailer one primary objective and one desired action.",
  },
  {
    id: "dm-lead-offer",
    kind: "heuristic",
    appliesTo: ["offer", "hierarchy"],
    statement:
      "Lead with the offer; decoration should not outrank a clear offer.",
  },
  {
    id: "dm-headline-value",
    kind: "heuristic",
    appliesTo: ["offer", "hierarchy"],
    statement: "The headline should communicate value immediately.",
  },
  {
    id: "dm-glance",
    kind: "heuristic",
    appliesTo: ["hierarchy"],
    statement:
      "The recipient decides in seconds — make the message obvious at a glance.",
  },
  {
    id: "dm-findable-paths",
    kind: "heuristic",
    appliesTo: ["cta", "offer"],
    statement:
      "Phone, QR, URL, and offer should be easy to find when they exist on the brief.",
  },
  {
    id: "dm-one-action",
    kind: "heuristic",
    appliesTo: ["cta"],
    statement:
      "Make responding one easy action. Do not ask for several important things at once.",
  },
  {
    id: "dm-concrete-language",
    kind: "heuristic",
    appliesTo: ["offer"],
    statement: "Prefer specific, concrete language over vague claims.",
  },
  {
    id: "dm-urgency-frame",
    kind: "heuristic",
    appliesTo: ["urgency"],
    statement:
      "When the brief includes a real deadline, season, or time-bound offer, urgency is an appropriate creative frame. Do not invent urgency. Do not treat urgency as a predicted result.",
  },
  {
    id: "dm-brief-trust",
    kind: "heuristic",
    appliesTo: ["trust"],
    statement:
      "Use trust signals that already appear on the brief (years, reviews, credentials, local ownership, guarantees).",
  },
  {
    id: "dm-why-care-trust-act",
    kind: "heuristic",
    appliesTo: ["hierarchy"],
    statement: "The piece should answer: why care, why trust, why act now.",
  },
  {
    id: "dm-single-objective",
    kind: "heuristic",
    appliesTo: ["hierarchy"],
    statement:
      "Every design choice should support the single objective. Drop what does not.",
  },
  {
    id: "dm-recipient-property-not-neighborhood",
    kind: "observed_pattern",
    appliesTo: ["imagery"],
    statement:
      "Recipient-specific property imagery — a photograph of that recipient's own house or lot — is a personalization pattern, not generic neighborhood stock. imageryRole neighborhood means a local or community setting, not an address-level picture. Do not invent recipient-property imagery the brief does not support.",
  },
]

/**
 * Hand-curated home-services cluster. Generalized guidance only.
 * Not a playbook dump. Not research examples, slogans, layouts, or ROI.
 */
export const HOME_SERVICES_PRINCIPLES: readonly CreativePrinciple[] = [
  {
    id: "hs-offer-classes",
    kind: "heuristic",
    verticalCluster: "home-services",
    appliesTo: ["offer", "urgency"],
    statement:
      "When the brief supports more than one reading, give the three directions distinct offer classes: gateway diagnostic, value-add or clincher, seasonal or trigger framing, or trust/proof. Do not invent an offer. Do not turn weather or seasonality into a second offer.",
  },
  {
    id: "hs-consequence-imagery",
    kind: "observed_pattern",
    verticalCluster: "home-services",
    appliesTo: ["imagery"],
    statement:
      "Problem-led or consequence imagery is a recurring creative role in emergency and repair home services. Name that role only; do not invent a photograph, job-site fact, or visual the brief does not support.",
  },
  {
    id: "hs-trust-near-action",
    kind: "observed_pattern",
    verticalCluster: "home-services",
    appliesTo: ["trust", "cta"],
    statement:
      "Home-service mailers commonly place trust or proof near the response path. Use only credentials, reviews, years, or guarantees that already appear on the brief.",
  },
  {
    id: "hs-crew-imagery",
    kind: "observed_pattern",
    verticalCluster: "home-services",
    appliesTo: ["imagery", "trust"],
    statement:
      "Work or crew photography is a recurring visual trust or proof role in home-service mailers. When credibility is the creative job, imageryRole crew is an appropriate name for that role. Name the role only; do not invent a team, job-site, or customer-property photograph the brief does not support.",
  },
  {
    id: "hs-front-back",
    kind: "observed_pattern",
    verticalCluster: "home-services",
    appliesTo: ["hierarchy"],
    statement:
      "On a two-faced postcard, a recurring pattern is problem, offer, or hero on the non-address face, and supporting proof or contact near the reserved address-face roles. Do not invent back-of-card production geometry.",
  },
  {
    id: "hs-one-action",
    kind: "heuristic",
    verticalCluster: "home-services",
    appliesTo: ["cta"],
    statement:
      "Keep one primary recipient action. Phone and QR may both appear when the brief includes them; they should serve the same action.",
  },
  {
    id: "hs-claim-discipline",
    kind: "heuristic",
    verticalCluster: "home-services",
    statement:
      "Explain why the direction is strategically different. Do not claim conversion, bookings, lift, ROI, or that the direction will outperform another.",
  },
]

const PLUMBING_PRINCIPLES: readonly CreativePrinciple[] = [
  {
    id: "pl-problem-not-company",
    kind: "heuristic",
    verticalCluster: "plumbing",
    appliesTo: ["hierarchy"],
    statement: "Lead with the homeowner's problem, not the company.",
  },
  {
    id: "pl-one-offer",
    kind: "heuristic",
    verticalCluster: "plumbing",
    appliesTo: ["offer"],
    statement: "Make one clear offer.",
  },
  {
    id: "pl-one-action",
    kind: "heuristic",
    verticalCluster: "plumbing",
    appliesTo: ["cta"],
    statement: "Give recipients one clear action.",
  },
  {
    id: "pl-trust-before-sale",
    kind: "heuristic",
    verticalCluster: "plumbing",
    appliesTo: ["trust"],
    statement: "Build trust before asking for the sale.",
  },
  {
    id: "pl-localized",
    kind: "heuristic",
    verticalCluster: "plumbing",
    appliesTo: ["hierarchy"],
    statement: "Keep messaging simple and highly localized.",
  },
  {
    id: "pl-brief-trust-builders",
    kind: "heuristic",
    verticalCluster: "plumbing",
    appliesTo: ["trust"],
    statement:
      "When the brief includes them, use trust builders such as licensed, bonded, insured, reviews, years in business, family-owned, or a satisfaction guarantee.",
  },
  {
    id: "pl-avoid-gaps",
    kind: "heuristic",
    verticalCluster: "plumbing",
    appliesTo: ["cta", "urgency", "trust"],
    statement:
      "Avoid a weak call-to-action, missing urgency when the offer is time-bound, and missing social proof when the brief has it.",
  },
]

const PLUMBING_OFFER_PATTERNS_WHEN_BRIEF_HAS_NONE: CreativePrinciple = {
  id: "pl-offer-patterns",
  kind: "heuristic",
  verticalCluster: "plumbing",
  appliesTo: ["offer"],
  statement:
    "The brief has no offer. Industry offer frames to consider as patterns only — do not invent that this business provides them: free inspection, discounted drain cleaning, water heater specials, emergency service, first-time customer discount.",
}

const HOME_SERVICES_PATTERNS = [
  /\broof(?:er|ing|s)?\b/i,
  /\bhvac\b/i,
  /\bair condition(?:ing|er)s?\b/i,
  /\bheating and cooling\b/i,
  /\bfurnace\b/i,
  /\bplumb(?:er|ing)?\b/i,
  /\bdrains?\b/i,
  /\bwater heaters?\b/i,
  /\belectricians?\b/i,
  /\belectrical contractors?\b/i,
  /\bpest(?: control)?\b/i,
  /\blandscap(?:e|ing|er)s?\b/i,
  /\blawn care\b/i,
  /\bgutters?\b/i,
  /\bfoundation repair\b/i,
  /\bwaterproof(?:ing)?\b/i,
]

export function buildCreativeIntelligenceContext(
  brief: CampaignBrief
): CreativeIntelligenceContext {
  return {
    principles: [
      ...CREATIVE_DIRECT_MAIL_PRINCIPLES,
      ...(isHomeServicesBrief(brief) ? HOME_SERVICES_PRINCIPLES : []),
      ...plumbingPrinciplesFor(brief),
    ],
  }
}

export function formatCreativeIntelligenceContext(
  context: CreativeIntelligenceContext
): string {
  const general = context.principles.filter((principle) => !principle.verticalCluster)
  const homeServices = context.principles.filter(
    (principle) => principle.verticalCluster === "home-services"
  )
  const plumbing = context.principles.filter(
    (principle) => principle.verticalCluster === "plumbing"
  )

  const homeServicesBlock =
    homeServices.length > 0
      ? `Home-services principles:
${formatPrincipleList(homeServices)}`
      : `Home-services principles:
None. This campaign is not in the home-services cluster. Do not invent home-services knowledge.`

  const plumbingBlock =
    plumbing.length > 0
      ? `Plumbing principles (matched vertical only):
${formatPrincipleList(plumbing)}`
      : `Plumbing principles:
None. No plumbing playbook matched this campaign. Do not invent plumbing knowledge.`

  return `Creative Intelligence principles — decision guidance only.

Knowledge classification:
- Campaign facts: supplied separately as the Campaign Brief JSON. Those are customer-specific facts. Prioritize them over principles.
- Physical constraints: supplied separately as the Physical canvas. That canvas is authoritative. Do not choose a different mail piece, catalog product, dimensions, bleed, reserved-zone geometry, or vendor option, and do not override the canvas.
- Principles below are guidance, not campaign facts.
- kind=heuristic: Modern Mail guidance. NOT measured performance data or campaign outcomes.
- kind=observed_pattern: Recurring pattern noted in external research. NOT Modern Mail performance evidence.
- kind=unknown: Not established. Leave unknown. Do not invent a value.

How to use this knowledge:
- Consider applicable principles when choosing angle, offer class, imagery role, trust, urgency, CTA, hierarchy, layout variant, and copy.
- Do not blindly follow every principle.
- Do not claim that a principle is measured performance data.
- Do not invent offers, proof, or images the brief does not contain.
- Rationale may explain strategic difference. It must not claim conversion, bookings, lift, ROI, or that a direction will outperform.

General direct-mail principles:
${formatPrincipleList(general)}

${homeServicesBlock}

${plumbingBlock}`
}

export function isHomeServicesBrief(brief: CampaignBrief): boolean {
  const text = briefSearchText(brief)
  if (findIndustryPlaybook(text) === PLAYBOOKS.plumbing) return true
  return HOME_SERVICES_PATTERNS.some((pattern) => pattern.test(text))
}

function plumbingPrinciplesFor(brief: CampaignBrief): readonly CreativePrinciple[] {
  const playbook = findIndustryPlaybook(briefSearchText(brief))
  if (playbook !== PLAYBOOKS.plumbing) return []

  if (!brief.offer?.trim()) {
    return [...PLUMBING_PRINCIPLES, PLUMBING_OFFER_PATTERNS_WHEN_BRIEF_HAS_NONE]
  }

  return PLUMBING_PRINCIPLES
}

function briefSearchText(brief: CampaignBrief): string {
  return [
    brief.goal,
    brief.audience?.description,
    brief.businessInfo?.name,
    brief.offer,
    brief.otherRequirements,
    brief.desiredRecipientAction,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
}

function formatPrincipleList(principles: readonly CreativePrinciple[]): string {
  return principles.map(formatPrinciple).join("\n")
}

function formatPrinciple(principle: CreativePrinciple): string {
  const meta = [`[${principle.id}]`, `kind=${principle.kind}`]
  if (principle.verticalCluster) {
    meta.push(`vertical=${principle.verticalCluster}`)
  }
  if (principle.appliesTo && principle.appliesTo.length > 0) {
    meta.push(`appliesTo=${principle.appliesTo.join(",")}`)
  }
  return `- ${meta.join(" ")} ${principle.statement}`
}
