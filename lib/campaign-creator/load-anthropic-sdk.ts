import { requireDecodedPackage } from "./opaque-cjs"

export type AnthropicToolUseBlock = {
  type: "tool_use"
  input: unknown
}

export type AnthropicMessage = {
  content: Array<{ type: string; input?: unknown }>
}

export type AnthropicMessagesClient = {
  messages: {
    create: (params: Record<string, unknown>) => Promise<AnthropicMessage>
  }
}

type AnthropicCtor = new (opts: { apiKey: string }) => AnthropicMessagesClient

/**
 * Runtime-only SDK load. The package name is base64 so bundlers cannot
 * constant-fold a string-join and trace the SDK while compiling `/`.
 */
export function createAnthropicClient(apiKey: string): AnthropicMessagesClient {
  // QGFudGhyb3BpYy1haS9zZGs= → @anthropic-ai/sdk
  const mod = requireDecodedPackage("QGFudGhyb3BpYy1haS9zZGs=") as {
    default?: AnthropicCtor
  } & AnthropicCtor
  const Ctor = (mod.default ?? mod) as AnthropicCtor
  return new Ctor({ apiKey })
}
