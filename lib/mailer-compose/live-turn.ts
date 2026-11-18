"use server"

import { getSession, previewDemoAllowed } from "@/lib/auth/session"
import { getConversationEngine } from "@/lib/campaign-creator/conversation-engine"
import type { CampaignBrief, ConversationMessage } from "@/lib/campaign-creator/types"

import { proposalFor } from "./interview"

/**
 * The cockpit chat uses the same conversation engine as the full editor
 * when this is a real signed-in production session and ANTHROPIC_API_KEY is set.
 * Preview demo and a missing key stay on the local interview.
 */
export async function cometChatIsLive(): Promise<boolean> {
  return !previewDemoAllowed() && Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

export async function cometLiveTurn(input: {
  brief: Partial<CampaignBrief>
  history: { role: "customer" | "assistant"; text: string }[]
  message: string
  refining: boolean
}): Promise<
  | { live: false }
  | {
      live: true
      reply: string
      ready: boolean
      brief: Partial<CampaignBrief>
      line: string
      shop: string
      audience: string
    }
> {
  if (!(await getSession())) return { live: false }
  if (!(await cometChatIsLive())) return { live: false }
  const engine = await getConversationEngine()
  const transcript: ConversationMessage[] = input.history.map((turn, index) => ({
    id: `turn-${index}`,
    role: turn.role,
    content: turn.text,
    createdAt: new Date(0).toISOString(),
  }))
  const result = await engine.nextTurn({
    brief: input.brief as CampaignBrief,
    transcript,
    message: input.message,
  })
  const brief: Partial<CampaignBrief> = { ...input.brief, ...result.brief }
  const card = proposalFor(brief)
  const offer = result.brief.offer?.replace(/\s+/g, " ").trim()
  const spoken = result.reply.replace(/\s+/g, " ").trim()
  const line = offer || (input.refining ? spoken.slice(0, 90) : card.line)
  return {
    live: true,
    reply: result.reply,
    ready: result.readyForBriefReview || Boolean(brief.goal && brief.desiredRecipientAction && brief.audience?.description),
    brief,
    line,
    shop: card.shop,
    audience: brief.audience?.description?.trim() || card.audience,
  }
}
