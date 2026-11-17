/**
 * Preview stand-in for the Campaign Creator conversation.
 * It uses the same industry list as the editor. No model is called.
 * Every reply says Sample so it is not mistaken for a live answer.
 */
import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { industryForBrief } from "@/lib/research-library/industry"
import { EXAMPLE_PROMPTS } from "@/components/campaign-creator/OpeningPrompt"

export { EXAMPLE_PROMPTS }

export const ACCOMPLISH_QUESTION = "What would you like to accomplish?"

export const ACTION_QUESTION = "What should the people who receive it do?"

export const ACTION_CHOICES = [
  "Book an appointment",
  "Call you",
  "Request a quote",
  "Visit your website",
  "Something else",
] as const

export const AUDIENCE_QUESTION = "Who should receive it?"

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
  audience: string
  /** How many refinement passes have changed this card. */
  revision: number
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
    const trade = tradeLabel(brief)
    return {
      reply: `Sample. ${trade}. ${ACTION_QUESTION}`,
      choices: ACTION_CHOICES,
      ready: false,
      brief,
    }
  }
  if (!brief.audience?.description) {
    return {
      reply: `Sample. They should ${actionPhrase(brief.desiredRecipientAction)}. ${AUDIENCE_QUESTION}`,
      choices: AUDIENCE_CHOICES,
      ready: false,
      brief,
    }
  }
  const card = proposalFor(brief)
  return {
    reply: `${card.why}\n\n${card.line}`,
    choices: ["Make it more fun", "Different photo", "Bigger offer"],
    ready: true,
    brief,
  }
}

/** The interview decides the line from the words the customer used. */
export function proposalFor(brief: Partial<CampaignBrief>): ProposedMailer {
  const named = brief.businessInfo?.name?.trim()
  const trade = tradeLabel(brief)
  const audience = brief.audience?.description?.trim() || "the people you named"
  const action = actionPhrase(brief.desiredRecipientAction ?? "")
  const pizza = /pizza|brick oven|tony/i.test(`${named ?? ""} ${brief.goal ?? ""}`)
  if (pizza) {
    return {
      shop: /tony/i.test(named ?? "") ? named! : "Tony's Brick Oven Pizza",
      line: "Tuesday 2-for-1 large pizzas",
      audience,
      revision: 0,
      why: "Sample. Slow nights are the gap, so the card leads with one easy weeknight offer and asks them to call.",
    }
  }
  const shop = named && !/your business/i.test(named) ? named : trade
  const line = `${capitalize(action)} — ${trade.toLowerCase()} — ${audience}`
  return {
    shop,
    line,
    audience,
    revision: 0,
    why: `Sample. Business: ${trade.toLowerCase()}. Goal: ${action}. Audience: ${audience}.`,
  }
}

export interface ChatTurn {
  role: "assistant" | "customer"
  text: string
  choices?: readonly string[]
}

/** Labeled sample. Same questions, a pizza parlor's answers. */
export function reactToProposal(proposal: ProposedMailer, reaction: string): ProposedMailer {
  const revision = proposal.revision + 1
  const trade = proposal.shop
  const audience = proposal.audience
  if (/fun/i.test(reaction)) {
    const lines = [
      `${trade}: an easy time to book`,
      `${trade}: save the date, bring the neighbors`,
    ]
    const line = lines[(revision - 1) % lines.length]!
    return {
      ...proposal,
      revision,
      line,
      why: `Sample. Made the ${trade.toLowerCase()} line lighter (pass ${revision}). The appointment and ${audience} stay.`,
    }
  }
  if (/photo/i.test(reaction)) {
    const pictures = [
      "A roof in late daylight, no people and no logo.",
      "A close view of shingles after a storm, no people and no logo.",
    ]
    return {
      ...proposal,
      revision,
      line: `${proposal.line.split(" — ")[0]} — ${pictures[(revision - 1) % pictures.length]}`,
      why: `Sample. Changed the picture to pass ${revision}. ${trade} still asks them to book, for ${audience}. No new photo file is generated.`,
    }
  }
  if (/bigger|offer/i.test(reaction)) {
    const offers = [
      `${trade}: book this month, inspection included`,
      `${trade}: book this week, the inspection is on the house`,
    ]
    return {
      ...proposal,
      revision,
      line: offers[(revision - 1) % offers.length]!,
      why: `Sample. Made the offer larger (pass ${revision}). Still ${trade.toLowerCase()}, still for ${audience}.`,
    }
  }
  return { ...proposal, revision, why: `Sample. Kept the ${trade.toLowerCase()} card. I did not treat “${reaction}” as a new offer.` }
}

const TRADE_LABEL: Record<string, string> = {
  roofing: "Roofing",
  hvac: "HVAC",
  plumbing: "Plumbing",
  dental: "Dental",
  landscaping: "Landscaping",
  "restaurants-food": "Restaurant",
  "real-estate-agents": "Real estate",
  "auto-insurance": "Auto insurance",
  "home-insurance": "Home insurance",
  cleaning: "Cleaning",
  "private-chef": "Private chef",
}

function tradeLabel(brief: Partial<CampaignBrief>): string {
  const industry = industryForBrief(brief as CampaignBrief)
  if (TRADE_LABEL[industry]) return TRADE_LABEL[industry]
  if (industry && industry !== "none") return industry.replace(/-/g, " ")
  return "Your mailer"
}

function actionPhrase(action: string): string {
  const text = action.toLowerCase()
  if (/book|appointment/.test(text)) return "book an appointment"
  if (/call/.test(text)) return "call"
  if (/quote/.test(text)) return "request a quote"
  if (/website|visit/.test(text)) return "visit the website"
  return action.replace(/\s+/g, " ").trim() || "take the next step"
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
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
