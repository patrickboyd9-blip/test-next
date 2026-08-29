import type { ConversationEngine } from "./conversation-engine-types"
import { AnthropicConversationEngine } from "./anthropic-conversation-engine"

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

/**
 * Provider boundary. Returns the real Anthropic-backed engine once
 * ANTHROPIC_API_KEY is configured; otherwise still throws
 * ConversationEngineNotConfiguredError so the app degrades to its tested
 * fallback instead of crashing. Every caller depends only on the
 * ConversationEngine interface above — this is the only function that knows
 * which concrete implementation is behind it.
 */
export function getConversationEngine(): ConversationEngine {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new ConversationEngineNotConfiguredError()
  }

  if (!cachedEngine) {
    cachedEngine = new AnthropicConversationEngine(apiKey)
  }

  return cachedEngine
}
