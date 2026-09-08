import "server-only"

import Anthropic from "@anthropic-ai/sdk"

export type AnthropicToolUseBlock = Extract<
  Anthropic.ContentBlock,
  { type: "tool_use" }
>

export type AnthropicMessage = Anthropic.Message

export type AnthropicMessagesClient = Anthropic

export function createAnthropicClient(
  apiKey: string
): AnthropicMessagesClient {
  return new Anthropic({
    apiKey,
  })
}