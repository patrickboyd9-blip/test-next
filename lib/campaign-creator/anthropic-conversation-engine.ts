import { randomUUID } from "crypto"

import type {
  ConversationEngine,
  ConversationTurnInput,
  ConversationTurnResult,
} from "./conversation-engine-types"
import type { CampaignBrief, PrimarySuccessMetricType } from "./types"
import { createAnthropicClient, type AnthropicToolUseBlock } from "./load-anthropic-sdk"

const MODEL = "claude-sonnet-5"
const MAX_TOKENS = 1024

const PRIMARY_SUCCESS_METRIC_TYPES: PrimarySuccessMetricType[] = [
  "appointment",
  "phone_call",
  "qr_scan",
  "coupon_redemption",
  "website_visit",
  "purchase",
  "form_submission",
  "event_registration",
  "physical_visit",
  "delivery",
  "donation",
  "other",
]

const UPDATE_BRIEF_TOOL_NAME = "update_campaign_brief"

/**
 * Structured-output schema the model must fill in. Forcing tool_choice to this
 * tool guarantees a predictable, parseable shape every turn — never freeform
 * text we'd have to guess-parse into a Campaign Brief.
 */
const updateBriefTool = {
  name: UPDATE_BRIEF_TOOL_NAME,
  description:
    "Record your reply to the customer and any new or corrected understanding of their campaign.",
  input_schema: {
    type: "object",
    properties: {
      reply: {
        type: "string",
        description:
          "Your natural-language reply to the customer for this turn — plain English, " +
          "one focused question, an acknowledgment, or a transition into summarizing " +
          "once ready. Never mention tools, schemas, or that you are an AI model.",
      },
      readyForBriefReview: {
        type: "boolean",
        description:
          "True only once you have enough for a strong first Campaign Brief — not a " +
          "perfect or exhaustive one. False while a genuinely necessary piece (like the " +
          "desired recipient action or target audience) is still missing.",
      },
      brief: {
        type: "object",
        description:
          "Only include a field here if you have new or corrected information about it " +
          "this turn. Omit fields you have no new information about.",
        properties: {
          goal: { type: "string", description: "What the customer wants to accomplish." },
          desiredRecipientAction: {
            type: "string",
            description: "What the recipient should do (call, scan a QR code, visit, etc).",
          },
          primarySuccessMetric: {
            type: "object",
            properties: {
              type: { type: "string", enum: PRIMARY_SUCCESS_METRIC_TYPES },
              description: { type: "string" },
            },
          },
          supportingMetrics: {
            type: "array",
            items: { type: "string" },
            description: "The complete list as currently understood, not just new ones.",
          },
          audience: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
            },
          },
          businessInfo: {
            type: "object",
            properties: {
              name: { type: "string" },
              website: { type: "string" },
              phone: { type: "string" },
              address: { type: "string" },
              socialHandle: { type: "string" },
            },
          },
          brandAssets: {
            type: "array",
            items: { type: "string" },
            description:
              "The complete list of assets the customer wants included, as descriptions " +
              "(e.g. 'logo', 'a coupon for 20% off') — not just newly mentioned ones.",
          },
          emotionalTone: { type: "string" },
          offer: { type: "string" },
          qrDestination: { type: "string" },
          phone: { type: "string" },
          website: { type: "string" },
          otherRequirements: { type: "string" },
        },
      },
    },
    required: ["reply", "readyForBriefReview", "brief"],
  },
}

function buildSystemPrompt(brief: CampaignBrief): string {
  return `You are Modern Mail's Campaign Creator — a knowledgeable marketing strategist \
helping a small business turn an idea into a physical mail campaign. You are having a \
real conversation, not administering a form.

Each turn:
1. Read what the customer has told you and what you already know (the Campaign Brief \
below).
2. Ask the single most useful next question — never ask about something you already \
know, and never ask about something irrelevant to this campaign.
3. Update the Campaign Brief with anything new or corrected the customer just told you.
4. Reply in plain, warm, confident English, like a strategist — never like a chatbot, \
and never mention tools, schemas, or that you are an AI.

You are gathering enough to confidently produce a first draft covering: the campaign \
goal, the desired recipient action / Primary Success Metric, the target audience, \
business/brand information needed for the campaign, required creative assets, and the \
desired emotional response or tone.

Recognize when a single answer covers more than one of these at once — do not re-ask \
for something already answered.

CRITICAL — never invent customer-specific facts. For example, if the customer says "I \
want to send 1,000 mailers to HVAC customers," you know the rough goal and audience, \
but you do NOT know the desired recipient action, the business name, or many other \
details — do not fabricate them. Only include something in the brief if the customer \
actually said it, or it is an unmistakable, safe inference from what they said. When in \
doubt, ask instead of assuming.

Set readyForBriefReview to true only once you have enough for a strong first \
recommendation — not a perfect or exhaustive brief. It is fine for optional details to \
stay unknown. Keep it false while a genuinely necessary piece of information (like the \
desired recipient action or target audience) is still missing.

For the brief field of your tool call: only include a field if you have new or \
corrected information about it this turn. For list fields (supportingMetrics, \
brandAssets), give the complete list as currently understood. For grouped fields \
(primarySuccessMetric, audience, businessInfo), include only the sub-fields you're \
updating — they will be merged with what's already known.

Current Campaign Brief (JSON, may be incomplete):
${JSON.stringify(brief, null, 2)}`
}

function toAnthropicMessages(
  transcript: ConversationTurnInput["transcript"]
): Array<{ role: "user" | "assistant"; content: string }> {
  return transcript
    .filter((message) => message.role === "customer" || message.role === "assistant")
    .map((message) => ({
      role: message.role === "customer" ? "user" : "assistant",
      content: message.content,
    }))
}

/** Merges the model's proposed changes over the existing brief, field by field, so a
 * partial nested update (e.g. just `audience.description`) never wipes out sibling
 * fields the repository's shallow merge would otherwise drop. */
function mergeBriefPatch(
  current: CampaignBrief,
  incoming: Partial<CampaignBrief>
): Partial<CampaignBrief> {
  const patch: Partial<CampaignBrief> = { ...incoming }

  if (incoming.primarySuccessMetric) {
    patch.primarySuccessMetric = {
      type:
        incoming.primarySuccessMetric.type ??
        current.primarySuccessMetric?.type ??
        "other",
      description:
        incoming.primarySuccessMetric.description ?? current.primarySuccessMetric?.description,
    }
  }

  if (incoming.audience) {
    patch.audience = {
      description: incoming.audience.description ?? current.audience?.description ?? "",
      quantity: incoming.audience.quantity ?? current.audience?.quantity,
    }
  }

  if (incoming.businessInfo) {
    patch.businessInfo = { ...current.businessInfo, ...incoming.businessInfo }
  }

  return patch
}

interface RawToolOutput {
  reply?: unknown
  readyForBriefReview?: unknown
  brief?: {
    brandAssets?: unknown
    [key: string]: unknown
  }
}

function coerceBrandAssets(raw: unknown): CampaignBrief["brandAssets"] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((description) => ({ id: randomUUID(), type: "other" as const, description }))
}

export class AnthropicConversationEngine implements ConversationEngine {
  private client: ReturnType<typeof createAnthropicClient>

  constructor(apiKey: string) {
    this.client = createAnthropicClient(apiKey)
  }

  async nextTurn(input: ConversationTurnInput): Promise<ConversationTurnResult> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(input.brief),
      messages: toAnthropicMessages(input.transcript),
      tools: [updateBriefTool],
      tool_choice: { type: "tool", name: UPDATE_BRIEF_TOOL_NAME },
    })

    const toolUse = response.content.find(
      (block): block is AnthropicToolUseBlock => block.type === "tool_use"
    )

    if (!toolUse) {
      throw new Error("Conversation engine did not return a structured brief update.")
    }

    const raw = toolUse.input as RawToolOutput
    const rawBrief = raw.brief ?? {}

    const incomingBrief: Partial<CampaignBrief> = {
      ...(rawBrief as Partial<CampaignBrief>),
      brandAssets: coerceBrandAssets(rawBrief.brandAssets),
    }
    if (incomingBrief.brandAssets === undefined) delete incomingBrief.brandAssets

    return {
      reply:
        typeof raw.reply === "string" && raw.reply.trim()
          ? raw.reply
          : "Could you tell me a bit more about what you're looking to accomplish?",
      readyForBriefReview: raw.readyForBriefReview === true,
      brief: mergeBriefPatch(input.brief, incomingBrief),
    }
  }
}
