/**
 * Last gate on anything an assistant is allowed to see.
 * Partners, costs, prompts, research notes, and other people's records stay here.
 */

const LEAK =
  /\b(click\s*2\s*mail|click2mail|c2m|anthropic|openai|replicate|imagen|vercel|neon|stripe|mando|david webster|taste pack|reference corpus|system prompt|sourcepattern|sk_live_|sk_test_|wholesale|markup|unit cost|internal cost|gold\/)\b/i

const HIDDEN_KEYS = new Set([
  "prompt",
  "systemPrompt",
  "sourcePatternId",
  "layoutRecipe",
  "margin",
  "costCents",
  "vendor",
  "postage",
  "perPieceCents",
  "scheduleId",
  "termsVersion",
  "csv",
  "token",
  "secret",
  "password",
  "ownerId",
])

const SAFE = "That detail stays inside Modern Mail. Nothing was mailed or charged."

export function leaksInternalText(text: string): boolean {
  return LEAK.test(text)
}

/** A customer-safe copy. A leak replaces the whole value. */
export function toPublic<T>(value: T): T {
  const walked = walk(value)
  const text = JSON.stringify(walked)
  if (text && (leaksInternalText(text) || /mm_[A-Za-z0-9_-]{20,}/.test(text))) {
    return { message: SAFE, mailed: false, charged: false } as T
  }
  return walked as T
}

function walk(value: unknown): unknown {
  if (typeof value === "string") {
    if (leaksInternalText(value) || /mm_[A-Za-z0-9_-]{20,}/.test(value)) return SAFE
    return value
  }
  if (Array.isArray(value)) return value.map((item) => walk(item))
  if (!value || typeof value !== "object") return value
  const out: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (HIDDEN_KEYS.has(key)) continue
    if (key === "postageOnly" && child === true) {
      return { message: SAFE, mailed: false, charged: false }
    }
    out[key] = walk(child)
  }
  return out
}
