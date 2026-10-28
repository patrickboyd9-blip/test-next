import { estimateUsd, logTokenCost } from "./cost"
import {
  patternFitsOffer,
  type CopyPattern,
  type OfferType,
} from "./blueprint-tags"

/**
 * Reviews filled blueprint copy for grammar, logic, and fit with the offer.
 * A rules check always runs, so a deadline-loss line is never kept on a free
 * inspection. When ANTHROPIC_API_KEY is set, a copy editor reads the same lines
 * and may rewrite them or reject the pattern.
 */

const MODEL = "claude-sonnet-5"

export interface CopyDraft {
  headline: string
  subheadline?: string
  offer: string
  offerType?: OfferType
  pattern: CopyPattern
  goal?: string
}

export interface CopyEdit {
  ok: boolean
  headline?: string
  subheadline?: string
  reason?: string
}

export type CopyEditor = (draft: CopyDraft) => Promise<CopyEdit>

export function rulesCopyEdit(input: CopyDraft): CopyEdit {
  const headline = input.headline.replace(/\s+/g, " ").trim()
  const subheadline = input.subheadline?.replace(/\s+/g, " ").trim() || undefined
  const text = [headline, subheadline].filter(Boolean).join(" ")
  if (!headline || /\[[A-Za-z]/.test(text)) {
    return { ok: false, reason: "The line still has an empty slot." }
  }
  if (input.pattern === "deadline_warning" && !patternFitsOffer("deadline_warning", input.offerType)) {
    return { ok: false, reason: "A deadline-loss pattern does not fit this offer." }
  }
  if (lossFraming(text) && !lossFitsOffer(input.offer, input.offerType)) {
    return { ok: false, reason: "Loss framing does not fit this offer. The reader cannot lose something they never had." }
  }
  return { ok: true, headline, subheadline }
}

export function parseCopyEdit(raw: unknown): CopyEdit | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as { ok?: unknown; headline?: unknown; subheadline?: unknown; reason?: unknown }
  if (row.ok === false) {
    return { ok: false, reason: typeof row.reason === "string" ? clip(row.reason, 180) : "The copy editor rejected this pattern." }
  }
  if (row.ok !== true || typeof row.headline !== "string" || !row.headline.trim()) return null
  const headline = clip(row.headline, 120)
  const subheadline = typeof row.subheadline === "string" && row.subheadline.trim() ? clip(row.subheadline, 140) : undefined
  return { ok: true, headline, subheadline }
}

export async function editFilledCopy(input: CopyDraft & {
  env?: NodeJS.ProcessEnv
  edit?: CopyEditor
}): Promise<CopyEdit> {
  const rules = rulesCopyEdit(input)
  if (!rules.ok) return rules
  const edited = input.edit
    ? await input.edit(input)
    : await requestCopyEdit({ ...input, env: input.env ?? process.env })
  if (!edited) return rules
  if (!edited.ok) return { ok: false, reason: edited.reason || "The copy editor rejected this pattern." }
  const checked = rulesCopyEdit({
    ...input,
    headline: edited.headline ?? "",
    subheadline: edited.subheadline,
  })
  return checked
}

export async function requestCopyEdit(input: CopyDraft & { env: NodeJS.ProcessEnv }): Promise<CopyEdit | null> {
  const apiKey = input.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return null
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: input.env.DESIGN_MODEL?.trim() || MODEL,
      max_tokens: 400,
      system: [
        "You edit one postcard after a template has been filled.",
        "Check grammar, logic, and whether the lines fit the offer.",
        "A reader cannot lose an offer they never had. Deadline-loss framing does not fit a free inspection, a free quote, a free consultation, or a gift.",
        "Return JSON only.",
        "When the lines are sound, or need a small rewrite that keeps the offer, return {\"ok\": true, \"headline\": \"...\", \"subheadline\": \"...\"}.",
        "When the pattern should be replaced, return {\"ok\": false, \"reason\": \"...\"}.",
        "Do not add a brand name, a phone number, a price that was not in the offer, or a slogan from a reference mailer.",
      ].join(" "),
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            pattern: input.pattern,
            offerType: input.offerType ?? "",
            offer: input.offer,
            goal: input.goal ?? "",
            headline: input.headline,
            subheadline: input.subheadline ?? "",
          }),
        },
      ],
    })
    const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n")
    logTokenCost({
      cardId: "blueprint-copy",
      step: "copy-edit",
      model: response.model,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      estimatedUsd: estimateUsd(response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0, input.env),
    })
    return parseCopyEdit(parseJson(text))
  } catch (error) {
    console.info(`[design-intelligence] ${JSON.stringify({ step: "copy-edit", error: error instanceof Error ? error.message : "copy edit failed" })}`)
    return null
  }
}

function lossFraming(text: string): boolean {
  return /don'?t lose|do not lose|before you lose/i.test(text)
}

function lossFitsOffer(offer: string, offerType: OfferType | undefined): boolean {
  if (offerType && !patternFitsOffer("deadline_warning", offerType)) return false
  if (/\bfree\b|\$0|\bcomplimentary\b|\bgift\b|\bbonus\b/i.test(offer)) return false
  if (/\d+\s*%|%\s*off|\$\s?[1-9]/i.test(offer)) return false
  if (offerType === "enrollment_window" || offerType === "see_if_you_qualify") return true
  return /\byour\b/i.test(offer)
}

function clip(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim()
  return text.length > max ? text.slice(0, max).trim() : text
}

function parseJson(text: string): unknown {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}
