import { callMcpTool, toolCatalog, type McpContext } from "./tools"

const INSTRUCTIONS =
  "Modern Mail prepares physical mailers. Create a mailer only when the customer gives a campaign name and a postcard size of 5x8 or 6x9. Show the proof and the full price. The full price covers printing, postage, and the list. Never show postage by itself, a price breakdown, a partner, or another customer's records. You cannot approve, print, or charge. Ask the customer to approve in Modern Mail. If you do not know, say so."

export async function handleMcp(body: unknown, ctx: McpContext): Promise<Record<string, unknown> | null> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return rpcError(null, -32600, "The message could not be read.")
  }
  const message = body as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown }
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(idOf(message.id), -32600, "The message could not be read.")
  }
  const id = idOf(message.id)
  if (message.method.startsWith("notifications/")) return null
  if (message.method === "initialize") {
    return rpcResult(id, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "Modern Mail", version: "1.0.0" },
      instructions: INSTRUCTIONS,
    })
  }
  if (message.method === "ping" || message.method === "logging/setLevel") return rpcResult(id, {})
  if (message.method === "tools/list") return rpcResult(id, { tools: toolCatalog() })
  if (message.method === "tools/call") {
    const params = asRecord(message.params)
    const name = typeof params.name === "string" ? params.name : ""
    if (!name) return rpcError(id, -32602, "Name the action to run.")
    const result = await callMcpTool(name, params.arguments ?? {}, ctx)
    return rpcResult(id, {
      content: [{ type: "text", text: result.text }],
      isError: result.isError,
    })
  }
  return rpcError(id, -32601, "That action is not available.")
}

function rpcResult(id: string | number | null, result: unknown): Record<string, unknown> {
  return { jsonrpc: "2.0", id, result }
}

function rpcError(id: string | number | null, code: number, message: string): Record<string, unknown> {
  return { jsonrpc: "2.0", id, error: { code, message } }
}

function idOf(value: unknown): string | number | null {
  if (typeof value === "string" || typeof value === "number") return value
  return null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}
