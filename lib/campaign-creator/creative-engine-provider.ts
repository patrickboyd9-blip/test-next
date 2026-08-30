import { AnthropicCreativeEngine } from "./anthropic-creative-engine"
import type { CreativeEngine } from "./creative-engine"
import { MockCreativeEngine } from "./mock-creative-engine"

let cached: { kind: "anthropic" | "mock"; engine: CreativeEngine } | null = null

function resolveKind(): "anthropic" | "mock" {
  if (process.env.CREATIVE_ENGINE === "mock") return "mock"
  if (process.env.ANTHROPIC_API_KEY) return "anthropic"
  return "mock"
}

/**
 * Server-only provider boundary. UI and routes must not import this file
 * or any Anthropic module — call through server actions instead.
 *
 * Anthropic when ANTHROPIC_API_KEY is set (unless CREATIVE_ENGINE=mock).
 * Mock otherwise.
 */
export function getCreativeEngine(): CreativeEngine {
  const kind = resolveKind()
  if (cached?.kind === kind) return cached.engine

  const engine =
    kind === "anthropic" && process.env.ANTHROPIC_API_KEY
      ? new AnthropicCreativeEngine(process.env.ANTHROPIC_API_KEY)
      : new MockCreativeEngine()

  cached = { kind, engine }
  return engine
}
