import {
  COMET_PRICE_DEFLECTION,
  COMET_PROMPT_DEFLECTION,
  COMET_VENDOR_DEFLECTION,
} from "./comet"

/**
 * Server-side output filter. The denylist stays here so it is not copied into
 * the customer knowledge notes. Help and design replies both pass through it.
 */

const VENDOR_ASK = /\b(printer|print provider|who prints|which press|mail house|list provider|data provider|which model|what model|llm|hosting|vercel|anthropic|openai|replicate|imagen|click\s*2\s*mail|c2m)\b/i
const PROMPT_ASK = /\b(system prompt|your prompt|your instructions|ignore (?:your |all |previous )?instructions|show (?:me )?(?:your |the )?(?:prompt|instructions|rules))\b/i
const COST_ASK = /\b(cost you|your cost|margin|markup|wholesale|what do you pay|price breakdown|unit cost|internal price)\b/i
const LEAK = /\b(click2mail|c2m|david webster|anthropic|claude|openai|replicate|imagen|vercel|mando|c-3po|taste pack|reference corpus|system prompt|generator rule)\b/i

export type ConfidentialKind = "vendor" | "prompt" | "cost"

export function confidentialAsk(text: string): ConfidentialKind | null {
  if (PROMPT_ASK.test(text)) return "prompt"
  if (COST_ASK.test(text)) return "cost"
  if (VENDOR_ASK.test(text)) return "vendor"
  return null
}

export function leaksInternal(text: string): boolean {
  return LEAK.test(text)
}

export function deflectionFor(kind: ConfidentialKind): string {
  if (kind === "cost") return COMET_PRICE_DEFLECTION
  if (kind === "prompt") return COMET_PROMPT_DEFLECTION
  return COMET_VENDOR_DEFLECTION
}

/** Replace a reply that was asked to reveal internals, or that named them. */
export function filterCometReply(question: string, reply: string): string {
  const asked = confidentialAsk(question)
  if (asked) return deflectionFor(asked)
  if (leaksInternal(reply)) return COMET_VENDOR_DEFLECTION
  return reply
}
