import type { ConversationEngine } from "./conversation-engine-types"
import { requireDecodedLocal } from "./opaque-cjs"

export type {
  ConversationEngine,
  ConversationTurnInput,
  ConversationTurnResult,
} from "./conversation-engine-types"

export class ConversationEngineNotConfiguredError extends Error {
  constructor() {
    super(
      "No ConversationEngine implementation is configured. An LLM provider must be " +
        "selected and connected behind this interface before Campaign Creator can " +
        "hold a real conversation with customers."
    )
    this.name = "ConversationEngineNotConfiguredError"
  }
}

let cachedEngine: ConversationEngine | null = null

type AnthropicConversationModule = {
  AnthropicConversationEngine: new (apiKey: string) => ConversationEngine
}

function loadAnthropicConversationEngine(): AnthropicConversationModule {
  // YW50aHJvcGljLWNvbnZlcnNhdGlvbi1lbmdpbmU= → anthropic-conversation-engine
  return requireDecodedLocal(
    "YW50aHJvcGljLWNvbnZlcnNhdGlvbi1lbmdpbmU="
  ) as AnthropicConversationModule
}

/**
 * Provider boundary. Returns the real Anthropic-backed engine once
 * ANTHROPIC_API_KEY is configured; otherwise still throws
 * ConversationEngineNotConfiguredError so the app degrades to its tested
 * fallback instead of crashing.
 *
 * The Anthropic SDK is required only on the first live turn. A static import
 * evaluates the SDK while Next is compiling `/` and hangs the request.
 */
export function getConversationEngine(): ConversationEngine {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new ConversationEngineNotConfiguredError()
  }

  if (!cachedEngine) {
    const { AnthropicConversationEngine } = loadAnthropicConversationEngine()
    cachedEngine = new AnthropicConversationEngine(apiKey)
  }

  return cachedEngine
}
