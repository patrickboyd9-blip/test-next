import { createHash } from "node:crypto"

import type { ReviewedSource } from "./sources"
import { REVIEWED_SOURCES, sourceUsable } from "./sources"

export interface CustomerFacts {
  businessName: string
  offer: string
  phone: string
  serviceAction: string
  trade: string
}

export interface StrategyPlan {
  id: string
  role: "recommendation" | "alternative"
  objection: string
  offerFraming: string
  scene: string
  back: string
  rationale: string
  inference: string
  sourceIds: string[]
}

export interface ClaimFlag {
  phrase: string
  note: string
}

export interface StrategyGuidance {
  status: "sourced" | "limited"
  trade: "roofing" | "hvac" | "other"
  limitedReason: string | null
  missingInputs: string[]
  facts: CustomerFacts
  plans: StrategyPlan[]
  flags: ClaimFlag[]
  sourceVersion: string
  sourcesChanged: boolean
  savedAt: string | null
}

const FLAG_RULES: { pattern: RegExp; note: string }[] = [
  { pattern: /insurance will pay|we(?:'|’)ll get it covered|claim is approved/i, note: "A coverage or approval claim is not checked here. Confirm it before it is printed. This is not legal approval." },
  { pattern: /\b(licensed|warranty|guaranteed|#1|number one|best in)\b/i, note: "A credential, warranty, or ranking is not verified here. Print it only if you can show it. This is not legal approval." },
  { pattern: /\bmedicare\b|\bcms\b/i, note: "Medicare wording is not reviewed here. This screen is not a compliance approval." },
]

export function customerFacts(input: Partial<CustomerFacts>): CustomerFacts {
  return {
    businessName: clean(input.businessName),
    offer: clean(input.offer),
    phone: clean(input.phone),
    serviceAction: clean(input.serviceAction),
    trade: clean(input.trade) || "unknown",
  }
}

export function detectTrade(facts: CustomerFacts, goal = ""): "roofing" | "hvac" | "other" {
  const blob = `${facts.trade} ${facts.serviceAction} ${goal}`.toLowerCase()
  if (/\bpizza\b|\bbakery\b|\bsalon\b|\bunknown\b/.test(blob) && !/\broof/.test(blob) && !/\bhvac\b|\bfurnace\b|\bair condition/.test(blob)) {
    return "other"
  }
  if (/\broof/.test(blob)) return "roofing"
  if (/\bhvac\b|\bfurnace\b|\bair condition|\btune-up\b|\btune up\b/.test(blob)) return "hvac"
  if (facts.trade.toLowerCase() === "unknown" || facts.trade === "") return "other"
  return "other"
}

export function claimFlags(text: string): ClaimFlag[] {
  return FLAG_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => ({
    phrase: text.match(rule.pattern)?.[0] ?? "claim",
    note: rule.note,
  }))
}

export function advise(input: {
  facts: CustomerFacts
  goal?: string
  files: Readonly<Record<string, string>>
}): StrategyGuidance {
  const facts = input.facts
  const trade = detectTrade(facts, input.goal ?? "")
  const flags = claimFlags([facts.offer, facts.serviceAction, facts.businessName].join(" \n "))
  const usable = REVIEWED_SOURCES.filter((source) => {
    const file = input.files[source.file]
    return Boolean(file) && sourceUsable(source, file).ok
  })
  const base = {
    trade,
    facts,
    flags,
    sourcesChanged: false,
    savedAt: null as string | null,
    sourceVersion: sourceVersion(usable),
  }
  if (trade === "other") {
    return {
      ...base,
      status: "limited",
      limitedReason: "This library has no reviewed postcard record that supports this trade. Nothing below is a research finding, and it is not a home-service plan.",
      missingInputs: [
        "A reviewed roofing or HVAC entry is not a match for this campaign.",
        "Restaurant and unknown-trade notes in the library are not postcard tests of your offer, so they are not cited.",
      ],
      plans: [],
    }
  }
  const tradeSources = usable.filter((source) => source.trade === trade)
  if (tradeSources.length === 0) {
    return {
      ...base,
      status: "limited",
      limitedReason: "The reviewed campaign notes for this trade are missing or were rejected as data. No plan was invented in their place.",
      missingInputs: [`No usable ${trade} record remains in the reviewed files.`],
      plans: [],
    }
  }
  const plans = trade === "roofing" ? roofingPlans(facts, usable) : hvacPlans(facts, usable)
  if (plans.length === 0) {
    return {
      ...base,
      status: "limited",
      limitedReason: "The reviewed files no longer contain the records this guidance can cite.",
      missingInputs: ["The source file is missing the URL or the anchor phrase for every matching record."],
      plans: [],
    }
  }
  return {
    ...base,
    status: "sourced",
    limitedReason: null,
    missingInputs: facts.offer ? [] : ["You have not confirmed an offer. No price or discount was added."],
    plans,
  }
}

export function keepSavedOffer(saved: StrategyGuidance, fresh: StrategyGuidance): StrategyGuidance {
  if (saved.sourceVersion === fresh.sourceVersion) return saved
  return {
    ...saved,
    sourcesChanged: true,
    sourceVersion: saved.sourceVersion,
  }
}

function roofingPlans(facts: CustomerFacts, usable: ReviewedSource[]): StrategyPlan[] {
  const ids = (wanted: string[]) => wanted.filter((id) => usable.some((source) => source.id === id))
  const primary = ids(["library-roofing-roof-smarter", "principle-attention-pieters-2004", "principle-outcome-gutman-1982"])
  const repeat = ids(["library-roofing-owens-pink"])
  const quote = ids(["library-roofing-atlas-hp42"])
  const plans: StrategyPlan[] = []
  if (primary.length > 0) {
    plans.push({
      id: "roof-finished-house",
      role: "recommendation",
      objection: "A roof is easy to put off when the only picture is a product spec.",
      offerFraming: facts.offer || "No offer is confirmed yet. This plan does not invent one.",
      scene: "One photo of a finished roof on a house you have permission to show.",
      back: "Words only, so the offer you typed is not competing with a second photograph.",
      rationale: "The Roof Smarter note describes a roof as something a homeowner could picture on the house. The eye-tracking paper is about attention in print ads, not replies.",
      inference: "Applying that lesson to your card is an inference. It is not a measured result for your mailing.",
      sourceIds: primary,
    })
  }
  if (repeat.length > 0) {
    plans.push({
      id: "roof-repeat-mark",
      role: "alternative",
      objection: "A one-off clever line is forgotten by the next piece.",
      offerFraming: facts.offer || "No offer is confirmed yet. This plan does not invent one.",
      scene: "Use the same logo or color you already uploaded. Do not invent a mascot.",
      back: "Keep the back you already liked. This alternative does not replace it.",
      rationale: "The Pink Panther note is about repeating one brand asset. The library found no verified results for the roofing spots.",
      inference: "Repeating your real logo is the part you can do. The mascot itself is theirs, not yours.",
      sourceIds: repeat,
    })
  }
  if (quote.length > 0) {
    plans.push({
      id: "roof-real-quote",
      role: "alternative",
      objection: "A joke without a real customer is easy to doubt.",
      offerFraming: facts.offer || "No offer is confirmed yet. This plan does not invent one.",
      scene: "A short quote only if you type the words and have permission to use them.",
      back: "Words only if you add that quote. Otherwise leave this alternative unused.",
      rationale: "The Atlas note records a memorable line plus contractor quotes, aimed at contractors.",
      inference: "A homeowner quote is not supplied by the source. Do not invent one.",
      sourceIds: quote,
    })
  }
  return plans.slice(0, 3)
}

function hvacPlans(facts: CustomerFacts, usable: ReviewedSource[]): StrategyPlan[] {
  const ids = (wanted: string[]) => wanted.filter((id) => usable.some((source) => source.id === id))
  const plans: StrategyPlan[] = []
  const credential = ids(["library-hvac-carrier", "principle-outcome-gutman-1982"])
  const machine = ids(["library-hvac-trane", "principle-attention-pieters-2004"])
  const badge = ids(["library-hvac-energy-star"])
  if (credential.length > 0) {
    plans.push({
      id: "hvac-one-credential",
      role: "recommendation",
      objection: "Equipment claims blur together until one true credential is visible.",
      offerFraming: facts.offer || "No offer is confirmed yet. This plan does not invent one.",
      scene: facts.serviceAction || "The outdoor equipment, if that is the work you named.",
      back: "Words only for the offer you typed.",
      rationale: "The Carrier note says to lead with one true credential. It does not publish a response rate.",
      inference: "Which credential is true for your company is yours to confirm. This screen does not check it.",
      sourceIds: credential,
    })
  }
  if (machine.length > 0) {
    plans.push({
      id: "hvac-one-machine",
      role: "alternative",
      objection: "A list of features is hard to picture.",
      offerFraming: facts.offer || "No offer is confirmed yet. This plan does not invent one.",
      scene: "One photo of the real equipment. No dramatized test unless it is true.",
      back: "Keep the front photo. The back can stay words only.",
      rationale: "The Trane note is a durability demonstration built on one image. No published results.",
      inference: "A torture-test scene is not assumed. Use a photo you have the right to mail.",
      sourceIds: machine,
    })
  }
  if (badge.length > 0) {
    plans.push({
      id: "hvac-real-badge",
      role: "alternative",
      objection: "An efficiency claim is easy to overstate.",
      offerFraming: facts.offer || "No offer is confirmed yet. This plan does not invent a rebate.",
      scene: "A certification mark only if you are allowed to print it.",
      back: "Do not add the mark to the back unless you confirm the right to use it.",
      rationale: "The ENERGY STAR note says a real mark can lower the risk of choosing, and not to imply you are the government.",
      inference: "No rebate amount is in your facts, so none is shown.",
      sourceIds: badge,
    })
  }
  return plans.slice(0, 3)
}

function sourceVersion(sources: ReviewedSource[]): string {
  return createHash("sha256")
    .update(sources.map((source) => `${source.id}|${source.url}|${source.documentDate}|${source.supports}`).join("\n"))
    .digest("hex")
    .slice(0, 16)
}

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

export function sourcesFor(ids: readonly string[]): ReviewedSource[] {
  return ids.map((id) => REVIEWED_SOURCES.find((source) => source.id === id)).filter((source): source is ReviewedSource => Boolean(source))
}
