const hits = new Map<string, number[]>()

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests. Wait a moment and try again.")
    this.name = "RateLimitError"
  }
}

/** In-memory window. Enough to slow a loop. Not a distributed limiter. */
export function consumeRate(key: string, limit = 30, windowMs = 60_000, now = Date.now()): { ok: true } | { ok: false } {
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs)
  if (recent.length >= limit) {
    hits.set(key, recent)
    return { ok: false }
  }
  recent.push(now)
  hits.set(key, recent)
  return { ok: true }
}

export function requireRate(key: string): void {
  if (!consumeRate(key).ok) throw new RateLimitError()
}
