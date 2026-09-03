import "server-only"

import Anthropic from "@anthropic-ai/sdk"

export type AnthropicToolUseBlock = {
  type: "tool_use"
  input: unknown
}

export type AnthropicMessage = {
  content: Array<{ type: string; input?: unknown }>
}

export type AnthropicMessagesClient = Anthropic

export function createAnthropicClient(
  apiKey: string
): AnthropicMessagesClient {
  return new Anthropic({
    apiKey,
  })
}