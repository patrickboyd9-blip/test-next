import { consumeRate } from "./rate-limit"

/** The caller address from the proxy header. Used only as a rate-limit key. */
export function clientIp(request: { headers: Headers }): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? ""
  if (!forwarded || forwarded.length > 80) return "unknown"
  return forwarded
}

/** Stops a burst from one address. Null means the request may continue. */
export async function limitPublic(
  request: { headers: Headers },
  name: string,
  limit = 30,
  windowMs = 60_000,
): Promise<Response | null> {
  const result = await consumeRate(`public:${name}:${clientIp(request)}`, limit, windowMs)
  if (result.ok) return null
  return Response.json(
    { error: "Too many requests. Wait a moment and try again." },
    { status: 429, headers: { "Cache-Control": "private, no-store" } },
  )
}
