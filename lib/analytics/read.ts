export type DeviceKind = "phone" | "tablet" | "computer" | "unknown"

export function deviceFromAgent(agent: string | null): DeviceKind {
  const value = agent ?? ""
  if (/ipad|tablet/i.test(value)) return "tablet"
  if (/mobile|iphone|android/i.test(value)) return "phone"
  if (/mozilla|chrome|safari/i.test(value)) return "computer"
  return "unknown"
}

/** City, region, or postal code only when the host already provided them. The raw IP is not stored. */
export function coarsePlace(headers: Headers): string | null {
  const parts = ["x-vercel-ip-city", "x-vercel-ip-country", "x-vercel-ip-postal-code"]
    .map((name) => headers.get(name)?.trim() ?? "")
    .filter((part) => part.length > 0 && part.length < 80)
  return parts.length > 0 ? parts.join(", ") : null
}

export const VISITOR_COOKIE = "mm_visitor"

export function visitorFromCookie(header: string | null): { id: string; repeat: boolean } {
  const match = header?.match(new RegExp(`${VISITOR_COOKIE}=([A-Za-z0-9_-]{8,80})`))
  if (match?.[1]) return { id: match[1], repeat: true }
  return { id: mintVisitor(), repeat: false }
}

function mintVisitor(): string {
  return `v${Math.random().toString(36).slice(2, 12)}`
}
