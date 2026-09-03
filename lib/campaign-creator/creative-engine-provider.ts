import type { CreativeEngine } from "./creative-engine"
import { MockCreativeEngine } from "./mock-creative-engine"
import { requireDecodedLocal } from "./opaque-cjs"

let cached: { kind: "anthropic" | "mock"; engine: CreativeEngine } | null = null

function resolveKind(): "anthropic" | "mock" {
  if (process.env.CREATIVE_ENGINE === "mock") return "mock"
  if (process.env.ANTHROPIC_API_KEY) return "anthropic"
  return "mock"
}

type AnthropicEngineModule = {
  AnthropicCreativeEngine: new (apiKey: string) => CreativeEngine
}

/**
 * Load behind a constructed path so Turbopack/webpack do not trace
 * anthropic-creative-engine.ts (and the SDK) while compiling `/`.
 */
function loadAnthropicEngine(): AnthropicEngineModule {
  // YW50aHJvcGljLWNyZWF0aXZlLWVuZ2luZQ== → anthropic-creative-engine
  return requireDecodedLocal(
    "YW50aHJvcGljLWNyZWF0aXZlLWVuZ2luZQ=="
  ) as AnthropicEngineModule
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

  let engine: CreativeEngine
  if (kind === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    const { AnthropicCreativeEngine } = loadAnthropicEngine()
    engine = new AnthropicCreativeEngine(process.env.ANTHROPIC_API_KEY)
  } else {
    engine = new MockCreativeEngine()
  }

  cached = { kind, engine }
  return engine
}
