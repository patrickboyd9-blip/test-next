import type { ConversationEngine } from "@/lib/campaign-creator/conversation-engine-types"
import type { ConversationMessage } from "@/lib/campaign-creator/types"
import { isTemplateIndustry } from "@/lib/mail-templates/types"

import { ASSISTANT_NAME, COMET_CONFIDENTIALITY_RULE } from "./comet"
import { confidentialAsk, filterCometReply } from "./confidentiality"
import { retrieveKnowledge, type KnowledgeChunk } from "./knowledge"

export interface HelpTurn {
  role: "customer" | "assistant"
  text: string
}

export interface HelpRequest {
  question: string
  page: string
  step?: string
  transcript?: HelpTurn[]
  /** A real proof is on screen. Sample proofs do not count. */
  hasProof?: boolean
  proofHref?: string
  /**
   * No model is connected. Tests use this too.
   * The reply itself never says "Sample answer."
   */
  demo?: boolean
}

export interface HelpAnswer {
  reply: string
  sample: boolean
  acted: false
  mailed: false
  charged: false
  links: { label: string; href: string }[]
  offerPerson: boolean
}

interface Trade {
  id: string
  label: string
  words: string[]
}

const TRADES: readonly Trade[] = [
  { id: "plumbing", label: "plumbing", words: ["plumber", "plumbers", "plumbing"] },
  { id: "roofing", label: "roofing", words: ["roofer", "roofers", "roofing"] },
  { id: "hvac", label: "hvac", words: ["hvac", "furnace", "heating", "air conditioning"] },
  { id: "restaurant", label: "restaurant", words: ["restaurant", "cafe", "diner", "bakery"] },
  { id: "dental", label: "dental", words: ["dentist", "dental"] },
  { id: "real_estate", label: "real estate", words: ["realtor", "real estate"] },
  { id: "landscaping", label: "landscaping", words: ["landscaper", "landscaping", "lawn"] },
  { id: "auto_repair", label: "auto repair", words: ["mechanic", "auto repair", "body shop"] },
  { id: "cleaning", label: "cleaning", words: ["cleaner", "cleaning", "maid"] },
  { id: "auto_insurance", label: "insurance", words: ["insurance"] },
  { id: "electrician", label: "electrical", words: ["electrician", "electrical"] },
  { id: "painter", label: "painting", words: ["painter", "painting"] },
  { id: "pest", label: "pest control", words: ["pest", "exterminator"] },
  { id: "pool", label: "pool", words: ["pool"] },
  { id: "solar", label: "solar", words: ["solar"] },
  { id: "salon", label: "salon", words: ["salon", "barber"] },
  { id: "florist", label: "florist", words: ["florist", "flower shop"] },
  { id: "gym", label: "gym", words: ["gym", "fitness"] },
]

const ACTION = /\b(approve|send it|mail it|charge|pay now|place the order|submit the job)\b/i
const PERSON = /\b(talk to a person|real person|a human|someone on the team|speak to someone|call me)\b/i
const CUSTOMER_PRICE = /\b(how much|what(?:'s| is) the price|price of|cost of a|what does it cost|how much is)\b/i

export function helpRefusesAction(question: string): boolean {
  return ACTION.test(question)
}

export function pageHint(page: string, step?: string): string {
  if (step === "proof" || page.includes("proof")) return "You are on the proof. Look it over, then continue to who receives it."
  if (step === "to") return "You are choosing who receives it. Pick a list, then you will see the full price."
  if (step === "what" || page.endsWith("/mail")) return "You are starting a mailer. Pick chat, an upload, a template, or a person."
  if (page === "/app" || page.endsWith("/app")) return "You are home."
  return "You can start a mailer from Home."
}

/**
 * Answers help questions. A live engine may phrase an open question.
 * Greetings, trades, price, and refusals stay short either way.
 * The reply is filtered before return. Nothing is mailed or charged.
 */
export async function answerHelp(input: HelpRequest, engine?: ConversationEngine | null, notes?: KnowledgeChunk[]): Promise<HelpAnswer> {
  const base = {
    acted: false as const,
    mailed: false as const,
    charged: false as const,
    sample: Boolean(input.demo),
  }
  const trade = detectTrade(input.question)

  if (helpRefusesAction(input.question)) {
    return {
      ...base,
      offerPerson: false,
      links: proofLink(input),
      reply: filterCometReply(
        input.question,
        `${ASSISTANT_NAME} can't approve, mail, or charge. You do that on the proof, after you see the full price. Nothing is mailed from this chat.`,
      ),
    }
  }

  if (confidentialAsk(input.question)) {
    return {
      ...base,
      offerPerson: false,
      links: [],
      reply: filterCometReply(input.question, ""),
    }
  }

  if (trade) {
    return {
      ...base,
      offerPerson: false,
      links: [{ label: "Start a mailer", href: mailerHref(trade) }],
      reply: filterCometReply(input.question, tradeReply(trade)),
    }
  }

  if (isGreeting(input.question)) {
    return {
      ...base,
      offerPerson: false,
      links: [{ label: "Start a mailer", href: "/app/mail" }],
      reply: filterCometReply(input.question, `Hi, I'm ${ASSISTANT_NAME}. What are you mailing?`),
    }
  }

  if (CUSTOMER_PRICE.test(input.question)) {
    return {
      ...base,
      offerPerson: false,
      links: input.hasProof ? proofLink(input) : [{ label: "Start a mailer", href: "/app/mail" }],
      reply: filterCometReply(
        input.question,
        "You'll see the full price before you approve. It covers printing, postage, and the list, not postage by itself. Until a price is set, it says Placeholder, and nothing is charged.",
      ),
    }
  }

  if (PERSON.test(input.question)) {
    return {
      ...base,
      offerPerson: true,
      links: [],
      reply: "I can take a note for a person. It stays on this screen and is not sent.",
    }
  }

  const found = retrieveKnowledge(input.question, notes)
  const fallback = found.length > 0 ? shortNote(found) : "I don't know that one. I can take a note for a person."
  let reply = fallback
  if (!input.demo && engine) {
    try {
      const turned = await engine.nextTurn({
        help: true,
        brief: {
          goal: "Help only",
          otherRequirements: `${COMET_CONFIDENTIALITY_RULE}\n\nWhere they are: ${pageHint(input.page, input.step)}\n\nPublic notes:\n${found.map((item) => item.text).join("\n\n") || "None."}`,
        },
        transcript: toTranscript(input),
        message: input.question,
      })
      const phrased = clamp(filterCometReply(input.question, turned.reply))
      if (phrased) reply = phrased
    } catch {
      reply = fallback
    }
  }

  const unknown = found.length === 0 && reply === fallback
  return {
    ...base,
    offerPerson: unknown,
    links: unknown ? [] : contextualLinks(input),
    reply: filterCometReply(input.question, reply),
  }
}

function toTranscript(input: HelpRequest): ConversationMessage[] {
  const prior = (input.transcript ?? []).slice(-8).map((turn, index) => ({
    id: `help-${index}`,
    role: turn.role,
    content: turn.text,
    createdAt: "1970-01-01T00:00:00.000Z",
  }))
  return [
    ...prior,
    {
      id: "help-now",
      role: "customer",
      content: input.question,
      createdAt: "1970-01-01T00:00:00.000Z",
    },
  ]
}

function isGreeting(question: string): boolean {
  const text = question
    .trim()
    .toLowerCase()
    .replace(/[!?.]+/g, "")
    .replace(/\s+/g, " ")
  return /^(hi|hello|hey|howdy|good morning|good afternoon|good evening)( there)?( comet)?$/.test(text)
}

function detectTrade(question: string): Trade | null {
  const hay = question.toLowerCase()
  for (const trade of TRADES) {
    if (trade.words.some((word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(hay))) {
      return trade
    }
  }
  const loose = hay.match(/\b(?:i'm|im|i am|we're|we are|i own|i run)\s+(?:a|an)?\s*([a-z][a-z -]{2,40})/)
  if (!loose?.[1]) return null
  const label = loose[1].split(/\b(?:in|from|near|who|that|and|with)\b/)[0]?.trim() ?? ""
  if (label.length < 3 || /^(not|just|here|looking|trying|wondering|new|small)$/.test(label)) return null
  return { id: label.replace(/\s+/g, "-"), label, words: [] }
}

function tradeReply(trade: Trade): string {
  if (trade.id === "plumbing") {
    return "Great, plumbers do well with seasonal and emergency-service postcards. Want me to start a plumbing mailer?"
  }
  return `Great, ${trade.label} businesses do well with a clear offer and a simple next step. Want me to start a ${trade.label} mailer?`
}

function mailerHref(trade: Trade): string {
  const brief =
    trade.id === "plumbing"
      ? "A plumbing mailer for seasonal and emergency service"
      : `A ${trade.label} mailer`
  const params = new URLSearchParams({ path: "ai", brief })
  if (isTemplateIndustry(trade.id)) params.set("industry", trade.id)
  return `/app/mail?${params.toString()}`
}

function shortNote(chunks: KnowledgeChunk[]): string {
  const body = chunks[0]?.text.replace(/^#.+$/gm, " ").replace(/\s+/g, " ").trim() ?? ""
  const sentences = body.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 20)
  const picked = sentences.slice(0, 2).join(" ")
  return picked.length > 320 ? `${picked.slice(0, 317).trim()}…` : picked
}

function clamp(reply: string): string {
  const clean = reply.replace(/\s+/g, " ").trim()
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean)
  return sentences.slice(0, 3).join(" ")
}

function proofLink(input: HelpRequest): { label: string; href: string }[] {
  if (!input.hasProof) return []
  return [{ label: "Open your proof", href: input.proofHref || "/app/mail?step=proof" }]
}

function contextualLinks(input: HelpRequest): { label: string; href: string }[] {
  const links = [...proofLink(input)]
  if (links.length === 0) links.push({ label: "Start a mailer", href: "/app/mail" })
  if (!input.page.endsWith("/app") && input.page !== "/app" && links.length < 2) {
    links.push({ label: "Back home", href: "/app" })
  }
  return links.slice(0, 2)
}
