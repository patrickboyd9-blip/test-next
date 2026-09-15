import type { CreativeEngine } from "./creative-engine"
import { MockCreativeEngine } from "./mock-creative-engine"

let cached: { kind: "anthropic" | "mock"; engine: CreativeEngine } | null = null

function resolveKind(): "anthropic" | "mock" {
  if (process.env.CREATIVE_ENGINE === "mock") return "mock"
  if (process.env.ANTHROPIC_API_KEY) return "anthropic"
  return "mock"
}

async function loadAnthropicEngine() {
  return await import("./anthropic-creative-engine")
}

/**
 * Server-only provider boundary. UI and routes must not import this file
 * or any Anthropic module — call through server actions instead.
 *
 * Anthropic when ANTHROPIC_API_KEY is set (unless CREATIVE_ENGINE=mock).
 * Mock otherwise.
 *
 * The Anthropic SDK is required only on first live generation. A static
 * import evaluates the SDK while Next is compiling `/` and hangs the request.
 * Load the engine with a literal dynamic import so Turbopack can resolve it
 * without tracing the SDK into `/`.
 */
export async function getCreativeEngine(): Promise<CreativeEngine> {
  const kind = resolveKind()
  if (cached?.kind === kind) return cached.engine

  let engine: CreativeEngine
  if (kind === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    const { AnthropicCreativeEngine } = await loadAnthropicEngine()
    engine = new AnthropicCreativeEngine(process.env.ANTHROPIC_API_KEY)
  } else {
    engine = new MockCreativeEngine()
  }

  cached = { kind, engine }
  return engine
}
