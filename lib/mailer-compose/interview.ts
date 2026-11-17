/**
 * Fixture stand-in for the Campaign Creator conversation.
 * The questions are the ones documented in docs/CAMPAIGN_CREATOR.md.
 * No model is called.
 */
import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { EXAMPLE_PROMPTS } from "@/components/campaign-creator/OpeningPrompt"

export { EXAMPLE_PROMPTS }

export const ACCOMPLISH_QUESTION = "What would you like to accomplish?"

export const ACTION_QUESTION = "Got it. What would you like the people who receive it to do?"

export const ACTION_CHOICES = [
  "Book an appointment",
  "Call you",
  "Request a quote",
  "Visit your website",
  "Something else",
] as const

export const AUDIENCE_QUESTION = "Got it. Who would you like to target?"

/** Examples named in the campaign-creator conversation, not a new goal list. */
export const AUDIENCE_CHOICES = [
  "Homeowners in specific ZIP codes",
  "A certain income range",
  "Another type of household",
] as const

export interface InterviewReply {
  reply: string
  choices: readonly string[]
  /** True once the interview can propose a card. */
  ready: boolean
  brief: Partial<CampaignBrief>
}

export interface ProposedMailer {
  shop: string
  line: string
  why: string
}

export function interviewReply(customerText: string, known: Partial<CampaignBrief> = {}): InterviewReply {
  const text = customerText.replace(/\s+/g, " ").trim()
  const brief: Partial<CampaignBrief> = {
    ...known,
    businessInfo: known.businessInfo ? { ...known.businessInfo } : undefined,
    audience: known.audience ? { ...known.audience } : undefined,
  }
  if (text && !brief.goal) brief.goal = text
  else if (text && !brief.desiredRecipientAction) brief.desiredRecipientAction = text
  else if (text && !brief.audience?.description) brief.audience = { description: text }

  if (!brief.goal) {
    return { reply: ACCOMPLISH_QUESTION, choices: EXAMPLE_PROMPTS, ready: false, brief }
  }
  if (!brief.desiredRecipientAction) {
    return { reply: ACTION_QUESTION, choices: ACTION_CHOICES, ready: false, brief }
  }
  if (!brief.audience?.description) {
    return { reply: AUDIENCE_QUESTION, choices: AUDIENCE_CHOICES, ready: false, brief }
  }
  return {
    reply: proposalFor(brief).why,
    choices: ["Make it more fun", "Different photo", "Bigger offer"],
    ready: true,
    brief,
  }
}

/** The interview decides the line. It does not ask the customer to write the card. */
export function proposalFor(brief: Partial<CampaignBrief>): ProposedMailer {
  const shop = brief.businessInfo?.name?.trim() || "Your business"
  const goal = (brief.goal ?? "").toLowerCase()
  const action = (brief.desiredRecipientAction ?? "").toLowerCase()
  const pizza = /pizza|restaurant|brick oven|tony/i.test(`${shop} ${goal}`)
  if (pizza) {
    return {
      shop: /tony/i.test(shop) ? shop : "Tony's Brick Oven Pizza",
      line: "Tuesday 2-for-1 large pizzas",
      why: "Slow nights are the gap, so the card leads with one easy weeknight offer and asks them to call.",
    }
  }
  const line = action.includes("call")
    ? `${shop}: call this month`
    : action.includes("website")
      ? `${shop}: visit the page`
      : action.includes("quote")
        ? `${shop}: ask for a quote`
        : `${shop}: book a time`
  return {
    shop,
    line,
    why: "The card uses the goal you named, one action, and the people you want it to reach.",
  }
}

export interface ChatTurn {
  role: "assistant" | "customer"
  text: string
  choices?: readonly string[]
}

/** Labeled sample. Same questions, a pizza parlor's answers. */
export function reactToProposal(proposal: ProposedMailer, reaction: string): ProposedMailer {
  if (/fun/i.test(reaction)) {
    return { ...proposal, line: proposal.line.replace(/\.$/, ""), why: "Same offer, a lighter line." }
  }
  if (/photo/i.test(reaction)) {
    return { ...proposal, why: "Same words. The picture can change when you add one. No new photo is generated here." }
  }
  if (/bigger|offer/i.test(reaction)) {
    return { ...proposal, line: proposal.line, why: "The offer stays the one already on the card. A bigger deal needs you to name it." }
  }
  return proposal
}

export function tonySample(beat: number): { turns: ChatTurn[]; proposal: ProposedMailer | null } {
  const shop = "Tony's Brick Oven Pizza"
  const proposal = proposalFor({
    businessInfo: { name: shop },
    goal: "Fill slow weeknights",
    desiredRecipientAction: "Call you",
    audience: { description: "People nearby" },
  })
  const turns: ChatTurn[] = [
    { role: "assistant", text: ACCOMPLISH_QUESTION, choices: EXAMPLE_PROMPTS },
  ]
  if (beat < 1) return { turns, proposal: null }
  turns.push(
    { role: "customer", text: `${shop}. Fill slow weeknights.` },
    { role: "assistant", text: ACTION_QUESTION, choices: ACTION_CHOICES }
  )
  if (beat < 2) return { turns, proposal: null }
  turns.push(
    { role: "customer", text: "Call you" },
    { role: "assistant", text: AUDIENCE_QUESTION, choices: AUDIENCE_CHOICES }
  )
  if (beat < 3) return { turns, proposal: null }
  turns.push(
    { role: "customer", text: "Another type of household" },
    { role: "assistant", text: `${proposal.why}\n\n${proposal.line}`, choices: ["Make it more fun", "Different photo", "Bigger offer"] }
  )
  return { turns, proposal }
}
