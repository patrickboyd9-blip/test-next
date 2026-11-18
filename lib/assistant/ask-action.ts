"use server"

import type { ConversationEngine } from "@/lib/campaign-creator/conversation-engine-types"
import { getSession } from "@/lib/auth/session"
import { beginMailAction } from "@/lib/ops/mail-flow"

import { answerHelp, type HelpAnswer, type HelpTurn } from "./help"

export async function askCometAction(
  question: string,
  page: string,
  step: string,
  transcript: HelpTurn[] = [],
  hasProof = false,
  proofHref = "",
): Promise<HelpAnswer> {
  const session = await getSession()
  if (!session) {
    return {
      reply: "Sign in required.",
      sample: false,
      acted: false,
      mailed: false,
      charged: false,
      links: [],
      offerPerson: false,
    }
  }
  await beginMailAction(session.userId, "ai")
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() ?? ""
  const engine = apiKey ? await liveHelpEngine(apiKey) : null
  return answerHelp(
    {
      question,
      page,
      step,
      transcript,
      hasProof,
      proofHref,
      demo: !engine,
    },
    engine,
  )
}

async function liveHelpEngine(apiKey: string): Promise<ConversationEngine | null> {
  try {
    const { AnthropicConversationEngine } = await import("@/lib/campaign-creator/anthropic-conversation-engine")
    return new AnthropicConversationEngine(apiKey)
  } catch {
    return null
  }
}
