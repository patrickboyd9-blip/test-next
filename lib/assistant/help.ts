import type { ConversationEngine } from "@/lib/campaign-creator/conversation-engine-types"

import { ASSISTANT_NAME, COMET_CONFIDENTIALITY_RULE, COMET_UNKNOWN } from "./comet"
import { confidentialAsk, filterCometReply } from "./confidentiality"
import { retrieveKnowledge, type KnowledgeChunk } from "./knowledge"

export interface HelpRequest {
  question: string
  page: string
  step?: string
  /** Demo and tests stay on the sample answer. They do not call a model. */
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

const ACTION = /\b(approve|send it|mail it|charge|pay now|place the order|submit the job)\b/i

export function helpRefusesAction(question: string): boolean {
  return ACTION.test(question)
}

export function pageHint(page: string, step?: string): string {
  if (step === "proof" || page.includes("proof")) return "You are on the proof. Look it over, then continue to who receives it."
  if (step === "to") return "You are choosing who receives it. Pick a list, then you will see the full price."
  if (step === "what" || page.endsWith("/mail")) return "You are starting a mailer. Pick chat, an upload, a template, or a person."
  if (page === "/app" || page.endsWith("/app")) return "You are home. A proof that is ready is the thing to open next."
  return "You can start a mailer from Home."
}

/**
 * Answers from public notes only. An optional engine may phrase the reply.
 * The engine is not called in demo mode. The reply is filtered before return.
 */
export async function answerHelp(
  input: HelpRequest,
  engine?: ConversationEngine | null,
  notes?: KnowledgeChunk[],
): Promise<HelpAnswer> {
  const links = linksFor(input.page, input.step)
  const base = { acted: false as const, mailed: false as const, charged: false as const, links, sample: Boolean(input.demo) }

  if (helpRefusesAction(input.question)) {
    return {
      ...base,
      offerPerson: false,
      reply: say(input, `${ASSISTANT_NAME} can't approve, mail, or charge. You do that on the proof and the last step. Nothing is mailed from this chat.`),
    }
  }

  if (confidentialAsk(input.question)) {
    return { ...base, offerPerson: false, reply: say(input, "") }
  }

  const found = retrieveKnowledge(input.question, notes)
  if (found.length === 0) {
    return { ...base, offerPerson: true, reply: say(input, COMET_UNKNOWN) }
  }

  const grounded = `${pageHint(input.page, input.step)} ${summarize(found)}`
  let reply = grounded
  if (!input.demo && engine) {
    const turned = await engine.nextTurn({
      brief: {
        goal: "Help only",
        otherRequirements: `${COMET_CONFIDENTIALITY_RULE}\n\nPublic notes:\n${found.map((item) => item.text).join("\n")}`,
      },
      transcript: [],
      message: `${pageHint(input.page, input.step)}\n${input.question}`,
    })
    reply = turned.reply
  }
  return { ...base, offerPerson: false, reply: say(input, reply) }
}

function say(input: HelpRequest, reply: string): string {
  const safe = filterCometReply(input.question, reply)
  return input.demo ? `Sample answer. ${safe}` : safe
}

function summarize(chunks: KnowledgeChunk[]): string {
  return chunks
    .map((chunk) => chunk.text.replace(/^#.+$/m, "").replace(/\s+/g, " ").trim())
    .join(" ")
    .slice(0, 700)
}

function linksFor(page: string, step?: string): { label: string; href: string }[] {
  const links = [{ label: "Start a mailer", href: "/app/mail" }]
  if (step !== "proof") links.push({ label: "Open your proof", href: "/app/mail?step=proof&path=ai&brief=Sample%20proof%20for%20a%20tune-up" })
  if (!page.endsWith("/app") && page !== "/app") links.unshift({ label: "Back home", href: "/app" })
  return links.slice(0, 2)
}
